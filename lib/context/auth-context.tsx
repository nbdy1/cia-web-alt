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

import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Cookies from 'js-cookie';
import { applyBrandScale, generateBrandScale, BRAND_SCALE_STORAGE_KEY } from '@/lib/theme/colors';

export const CIA_ACTIVE_ORG_COOKIE = "cia_active_organization";

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  logoUrl: string | null;
  primaryColor: string;
}

interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  activeOrganizationId: string | null;
  activeOrganization: Organization | null;
  setActiveOrganizationId: (id: string) => void;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


export function AuthProvider({ children }: { children: React.ReactNode }) {
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

  // Fetch the user's organizations + resolve the active org. Runs on EVERY auth
  // resolution (see effect below), so a fresh login populates orgs immediately
  // instead of requiring a manual page refresh.
  const loadOrganizations = useCallback(async (u: User) => {
    const { data: orgsData, error: orgsError } = await supabase
      .from('organization_members')
      .select(`
        role,
        organizations (
          id,
          name,
          slug,
          logo_url,
          primary_color
        )
      `)
      .eq('user_id', u.id);

    // Surface RLS / grant problems instead of silently showing an empty portal.
    // "permission denied for schema public" (42501) means the DB role grants are
    // missing; 0 rows for a user who has a membership means auth.uid() is null.
    if (orgsError) {
      console.error('[Auth] organization_members fetch failed:', orgsError);
    } else if ((orgsData ?? []).length === 0) {
      console.warn(
        `[Auth] No organization memberships returned for user ${u.id} (${u.email}).`
      );
    }

    const mappedOrgs = (orgsData ?? []).map((row: any) => ({
      id: row.organizations.id,
      name: row.organizations.name,
      slug: row.organizations.slug,
      role: row.role,
      logoUrl: row.organizations.logo_url ?? null,
      primaryColor: row.organizations.primary_color ?? '#10b981',
    }));

    setOrganizations(mappedOrgs);

    if (mappedOrgs.length > 0) {
      const savedOrgId = Cookies.get(CIA_ACTIVE_ORG_COOKIE);
      const isValidSaved = !!savedOrgId && mappedOrgs.some((o: Organization) => o.id === savedOrgId);
      if (isValidSaved) {
        setActiveOrgId(savedOrgId!);
      } else {
        setActiveOrgId(mappedOrgs[0].id);
        Cookies.set(CIA_ACTIVE_ORG_COOKIE, mappedOrgs[0].id, { path: '/', expires: 365, sameSite: 'lax' });
      }
    } else {
      setActiveOrgId(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // onAuthStateChange fires an INITIAL_SESSION event on subscribe (cold load /
    // tab reopen, restored from the cookie), plus SIGNED_IN on login and
    // TOKEN_REFRESHED on refresh. Handling all of them here — and loading orgs
    // each time — is what removes the "need to refresh after login" quirk.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      const u = session?.user ?? null;
      setUser(u);

      if (u) {
        // Fire-and-forget: awaiting other supabase calls directly inside the
        // auth callback can deadlock GoTrue, so we don't await here.
        loadOrganizations(u).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setOrganizations([]);
        setActiveOrgId(null);
        setLoading(false);
        if (event === 'SIGNED_OUT') {
          router.push('/login');
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadOrganizations, router]);

  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [loading, user, pathname, router]);

  const activeOrganization = organizations.find((o) => o.id === activeOrganizationId) ?? null;

  // Apply the active organization's brand color as CSS variables so every
  // `*-brand-*` Tailwind utility across the app repaints to match. Also
  // cached to localStorage so the next page load can apply it before React
  // hydrates (see appearanceScript in app/layout.tsx), avoiding a flash of
  // the default emerald theme.
  useEffect(() => {
    if (!activeOrganization) return;
    const scale = generateBrandScale(activeOrganization.primaryColor);
    applyBrandScale(scale);
    try {
      window.localStorage.setItem(BRAND_SCALE_STORAGE_KEY, JSON.stringify(scale));
    } catch {
      // localStorage unavailable (private browsing) — safe to skip caching.
    }
  }, [activeOrganization?.primaryColor]);

  const signOut = async () => {
    await supabase.auth.signOut();
    // Deliberately keep CIA_ACTIVE_ORG_COOKIE so the next login on this
    // browser resumes the same organization instead of falling back to
    // whichever org the membership query happens to return first.
    // loadOrganizations() already validates the saved id against the
    // logged-in user's own memberships, so a stale/foreign id is harmless.
    setUser(null);
    setOrganizations([]);
    setActiveOrgId(null);
    router.push('/login');
  };

  if (loading || (!user && pathname !== '/login')) {
    return (
      <div className="min-h-screen w-full bg-paper flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-brand-50 rounded-3xl border-2 border-brand-100 flex items-center justify-center mx-auto animate-pulse" style={{ boxShadow: "0 4px 0 0 var(--brand-200)" }}>
            <span className="text-brand-600 font-black text-3xl tracking-tighter">CIA</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-brand-600 text-sm font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
            <span>Verifying credentials...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, organizations, activeOrganizationId, activeOrganization, setActiveOrganizationId, loading, signOut }}>
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
