import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { User, UserRole } from '@/types';

const AuthContext = createContext<{ loading: boolean }>({ loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const { setAuth } = useAuthStore();

  useEffect(() => {
    // 1. Get initial session
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          const persistedAuth = useAuthStore.getState().user;
          if (!persistedAuth) {
            setAuth(null);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Error getting session:', error);
        setLoading(false);
      }
    };

    initSession();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        if (event === 'SIGNED_OUT') {
          setAuth(null);
        } else {
          const persistedAuth = useAuthStore.getState().user;
          if (!persistedAuth) {
            setAuth(null);
          }
        }
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setAuth]);

  const fetchProfile = async (userId: string) => {
    try {
      // Try direct select first (works when authenticated RLS policy exists)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setAuth(data as User);
        setLoading(false);
        return;
      }

      // Fallback: no profile found yet (trigger may not have fired)
      console.warn('Profile not found for user:', userId, error?.message);
      setLoading(false);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
