/**
 * lib/usage/quota.ts
 *
 * Hard-cap quota enforcement. Before an AI/voice action runs, checkQuota()
 * consults the DB function organization_quota_status(org) and reports whether
 * the org may proceed.
 *
 * Fail-open by design: if the org can't be resolved or the check errors, we
 * ALLOW the action. A metering bug must never block a paying customer.
 */
import { cookies } from 'next/headers';
import { getServerSupabase } from '@/lib/supabase-server';

const ACTIVE_ORG_COOKIE = 'cia_active_organization';

export type QuotaReason = 'inactive' | 'reports' | 'voice_disabled' | 'voice_quota';
export type QuotaCheck = { ok: true } | { ok: false; reason: QuotaReason; message: string };

async function resolveOrg(
  db: Awaited<ReturnType<typeof getServerSupabase>>,
  studentId?: string | null,
  organizationId?: string | null,
): Promise<string | null> {
  if (organizationId) return organizationId;
  if (studentId) {
    const { data } = await db
      .from('students')
      .select('organization_id')
      .eq('id', studentId)
      .single();
    if (data?.organization_id) return data.organization_id as string;
  }
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
}

export async function checkQuota(
  kind: 'report' | 'voice',
  opts: { studentId?: string | null; organizationId?: string | null } = {},
): Promise<QuotaCheck> {
  try {
    const db = await getServerSupabase();
    const orgId = await resolveOrg(db, opts.studentId, opts.organizationId);
    if (!orgId) return { ok: true }; // can't resolve → don't block

    const { data, error } = await db.rpc('organization_quota_status', { target_org: orgId });
    const q = Array.isArray(data) ? data[0] : data;
    if (error || !q) return { ok: true }; // fail-open

    if (q.status !== 'active' && q.status !== 'trialing') {
      return {
        ok: false,
        reason: 'inactive',
        message: 'Langganan organisasi ini sedang tidak aktif. Hubungi admin untuk mengaktifkannya kembali.',
      };
    }

    if (kind === 'report') {
      if (q.reports_limit != null && q.reports_used >= q.reports_limit) {
        return {
          ok: false,
          reason: 'reports',
          message: `Kuota laporan bulan ini sudah tercapai (${q.reports_used}/${q.reports_limit}). Tingkatkan paket untuk melanjutkan.`,
        };
      }
    } else {
      if (!q.voice_enabled) {
        return { ok: false, reason: 'voice_disabled', message: 'Fitur suara tidak tersedia pada paket Anda.' };
      }
      if (q.voice_limit != null && q.voice_used >= q.voice_limit) {
        return { ok: false, reason: 'voice_quota', message: 'Kuota suara bulan ini sudah tercapai.' };
      }
    }

    return { ok: true };
  } catch (err) {
    console.error('[quota] check failed (allowing through):', err);
    return { ok: true };
  }
}
