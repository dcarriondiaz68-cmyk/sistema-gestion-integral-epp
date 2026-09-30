import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AuthContext, type AuthContextValue } from '@/hooks/useAuth';
import type { UserRole } from '@/constants/roles.constants';
import type { Profile } from '@/types/profile.types';
import { getAuthErrorMessage } from '@/lib/errors';
import { setCachedData, getCachedData, clearCachedData } from '@/lib/data-cache';

const PROFILE_CACHE_KEY = 'user_profile';

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, avatar_url, phone, active, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error al cargar perfil:', error.message);
    const cached = await getCachedData<Profile>(PROFILE_CACHE_KEY);
    return cached;
  }

  const profile = data as Profile | null;
  if (profile) {
    await setCachedData(PROFILE_CACHE_KEY, profile);
  }
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const fetched = await fetchProfile(user.id);
    setProfile(fetched);
  }, [user]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);

      if (data.session?.user) {
        fetchProfile(data.session.user.id)
          .then((p) => {
            if (mounted) {
              setProfile(p);
              setLoading(false);
            }
          })
          .catch(() => {
            if (mounted) setLoading(false);
          });
      } else {
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        (async () => {
          const p = await fetchProfile(newSession.user.id);
          if (mounted) setProfile(p);
        })();
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { error: getAuthErrorMessage(error) };
      }
      return { error: null };
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    await clearCachedData(PROFILE_CACHE_KEY);
  }, []);

  const role: UserRole | null = profile?.role ?? null;

  const value: AuthContextValue = {
    session,
    user,
    profile,
    role,
    loading,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
