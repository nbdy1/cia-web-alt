"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (mounted) {
          setUser(session?.user ?? null);
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
    router.push('/login');
  };

  if (loading || (!user && pathname !== '/login')) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-emerald-600/20 rounded-3xl border border-emerald-500/30 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20 animate-pulse">
            <span className="text-emerald-400 font-extrabold text-3xl tracking-tighter">CIA.</span>
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
    <AuthContext.Provider value={{ user, loading, signOut }}>
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
