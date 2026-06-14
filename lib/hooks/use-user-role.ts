/**
 * lib/hooks/use-user-role.ts
 *
 * Fetches the current user's role ("admin" | "ustadz") from the `profiles`
 * table in Supabase. The role drives all access-control decisions in the UI:
 *   - "admin"  → can see all students, access /admin/* routes
 *   - "ustadz" → sees only students assigned to them via assigned_ustadz_id
 *
 * Returns { role: string | null, loading: boolean }.
 * Returns null/loading while the user session hasn't resolved yet.
 */
import React from 'react';
import { useAuth } from '@/lib/context/auth-context';
import { supabase } from '@/lib/supabase';

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (user?.id) {
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) setRole(data.role);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [user]);

  return { role, loading };
};
