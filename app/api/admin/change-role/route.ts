/**
 * app/api/admin/change-role/route.ts
 *
 * Server-side endpoint for changing a profile's role between 'ustadz' and 'admin'.
 * Uses the service role key so it bypasses RLS, but validates that:
 *   1. The requesting user is authenticated.
 *   2. The requesting user's role in profiles is 'admin'.
 *   3. The target role is one of the allowed values.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  // Instantiated here (not at module level) so env vars are available at request time
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Validate the caller's session from the Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Confirm the caller is an admin
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError || callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: caller is not an admin' }, { status: 403 });
    }

    // Parse body
    const { targetId, newRole } = await req.json();
    if (!targetId || !['ustadz', 'admin'].includes(newRole)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Perform the update
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetId);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
