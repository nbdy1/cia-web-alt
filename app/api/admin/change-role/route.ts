/**
 * app/api/admin/change-role/route.ts
 *
 * Server-side endpoint for changing a profile's role between 'ustadz' and 'admin'.
 *
 * Auth pattern (Supabase v2 standard):
 *   - Anon client + user JWT  → validates who is calling
 *   - Service role client     → bypasses RLS for the actual write
 *
 * Also calls auth.admin.updateUserById to keep raw_user_meta_data in sync,
 * which prevents any DB trigger that mirrors metadata from interfering.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    // ── 1. Validate caller's session ─────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    // Use anon client with the user's JWT — the standard Supabase v2 pattern
    // for server-side session validation.
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Service-role client for admin operations ──────────────────────────
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Confirm the caller's own profile has role = 'admin'
    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError || callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── 3. Parse and validate request body ───────────────────────────────────
    const { targetId, newRole } = await req.json();
    if (!targetId || !['ustadz', 'admin'].includes(newRole)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // ── 4. Update auth metadata first (avoids trigger conflicts) ─────────────
    // Any DB trigger that syncs profiles ← auth metadata won't fight us
    // because we're setting auth metadata before touching the profiles row.
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
      targetId,
      { user_metadata: { role: newRole } }
    );
    if (authUpdateError) {
      console.error('[change-role] auth metadata update failed:', authUpdateError.message);
      // Non-fatal — continue to update profiles table regardless
    }

    // ── 5. Update the profiles table ─────────────────────────────────────────
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
