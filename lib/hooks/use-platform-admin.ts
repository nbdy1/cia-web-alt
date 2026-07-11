/**
 * lib/hooks/use-platform-admin.ts
 *
 * Returns whether the current user is a company-level platform super-admin,
 * i.e. has a row in public.platform_admins. This is the SAME source of truth
 * the super-admin server actions enforce via is_platform_admin(), so page
 * access and action access always agree.
 *
 * RLS note: the platform_admins policy only returns rows to an actual platform
 * admin, so a non-admin's query comes back empty → not an admin.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import { supabase } from '@/lib/supabase';

export function useIsPlatformAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (authLoading) return;

    if (!user) {
      setIsPlatformAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setIsPlatformAdmin(!!data);
        setLoading(false);
      });

    return () => { active = false; };
  }, [user, authLoading]);

  return { isPlatformAdmin, loading: authLoading || loading };
}
