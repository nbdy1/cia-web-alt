/**
 * lib/context/auth-context.tsx
 *
 * Global authentication state for the app.
 *
 * Wraps the entire app in <AuthProvider> (see app/layout.tsx). It subscribes
 * to Supabase's onAuthStateChange so the auth state stays in sync across tabs
 * and after token refresh. Unauthenticated users are redirected to /login
 * automatically; a full-screen loading screen is shown while auth resolves
 * on first mount so child pages never render stale state.
 *
 * Exports:
 *   AuthProvider  – wrap the app in this once at the root
 *   useAuth()     – returns { user, loading, signOut } from any client component
 */
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Cookies from 'js-cookie';

export const CIA_ACTIVE_ORG_COOKIE = "cia_active_organization";

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  activeOrganizationId: string | null;
  setActiveOrganizationId: (id: string) => void;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganizationId, setActiveOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const setActiveOrganizationId = (id: string) => {
    setActiveOrgId(id);
    Cookies.set(CIA_ACTIVE_ORG_COOKIE, id, { path: '/', expires: 365, sameSite: 'lax' });
    // Reload to ensure all data is fetched for the new organization
    window.location.reload();
  };

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (mounted) {
          const u = session?.user ?? null;
          setUser(u);

          if (u) {
            // Fetch organizations for user
            const { data: orgsData } = await supabase
              .from('organization_members')
              .select(`
                role,
                organizations (
                  id,
                  name,
                  slug
                )
              `)
              .eq('user_id', u.id);

            const mappedOrgs = (orgsData ?? []).map((row: any) => ({
              id: row.organizations.id,
              name: row.organizations.name,
              slug: row.organizations.slug,
              role: row.role,
            }));
            
            setOrganizations(mappedOrgs);

            if (mappedOrgs.length > 0) {
              const savedOrgId = Cookies.get(CIA_ACTIVE_ORG_COOKIE);
              const isValidSaved = mappedOrgs.some((o: Organization) => o.id === savedOrgId);
              if (isValidSaved && savedOrgId) {
                setActiveOrgId(savedOrgId);
              } else {
                setActiveOrgId(mappedOrgs[0].id);
                Cookies.set(CIA_ACTIVE_ORG_COOKIE, mappedOrgs[0].id, { path: '/', expires: 365, sameSite: 'lax' });
              }
            } else {
              setActiveOrgId(null);
            }
          } else {
            setOrganizations([]);
            setActiveOrgId(null);
          }

          setLoading(false);
        }
      } catch (err) {
        console.error("Error getting auth session:", err);
        if (mounted) setLoading(false);
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (mounted) {
          setUser(session?.user ?? null);
          setLoading(false);
          if (_event === 'SIGNED_OUT') {
            router.push('/login');
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [loading, user, pathname, router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    Cookies.remove(CIA_ACTIVE_ORG_COOKIE);
    setUser(null);
    setOrganizations([]);
    setActiveOrgId(null);
    router.push('/login');
  };

  if (loading || (!user && pathname !== '/login')) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-emerald-600/20 rounded-3xl border border-emerald-500/30 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20 animate-pulse">
            <span className="text-emerald-400 font-extrabold text-3xl tracking-tighter">CIA</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-emerald-400/80 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
            <span>Verifying credentials...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, organizations, activeOrganizationId, setActiveOrganizationId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
