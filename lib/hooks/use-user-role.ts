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
