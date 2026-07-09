/**
 * lib/hooks/use-user-role.ts
 *
 * Provides the current user's organization role ("owner" | "admin" | "ustadz")
 * for their currently active organization.
 * The role drives all access-control decisions in the UI:
 *   - "admin"  → can see all students, access /admin/* routes
 *   - "ustadz" → sees only students assigned to them via assigned_ustadz_id
 *
 * Returns { role: string | null, organizationId: string | null, loading: boolean }.
 * Returns null/loading while the user session hasn't resolved yet.
 */
import { useAuth } from '@/lib/context/auth-context';

export const useUserRole = () => {
  const { user, loading, organizations, activeOrganizationId } = useAuth();

  if (loading || !user || !activeOrganizationId) {
    return { role: null, organizationId: null, loading: true };
  }

  const activeOrg = organizations.find(o => o.id === activeOrganizationId);

  return {
    role: activeOrg?.role ?? null,
    organizationId: activeOrganizationId,
    loading: false,
  };
};
