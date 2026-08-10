import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { queryClient } from '@/lib/query-client';
import { appScheme, isStaging } from '@/lib/app-env';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/domain';

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  isLoading: boolean;
  isProfileComplete: boolean;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  session: Session | null;
  signInDemo: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    if (!nextSession) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', nextSession.user.id).maybeSingle();
    if (error) throw error;
    setProfile(data);
  }, []);

  const refreshProfile = useCallback(async () => loadProfile(session), [loadProfile, session]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      try {
        await loadProfile(data.session);
      } finally {
        if (mounted) setIsLoading(false);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setTimeout(() => void loadProfile(nextSession).finally(() => setIsLoading(false)), 0);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithApple = useCallback(async () => {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const state = Crypto.randomUUID();
    const credential = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      state,
    });
    if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
    if (credential.state !== state) throw new Error('Apple returned an invalid authentication state.');
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    const { data, error } = await supabase.auth.signInWithIdToken({
      nonce: rawNonce, provider: 'apple', token: credential.identityToken,
    });
    if (error) throw error;
    if (fullName && data.user) {
      await supabase.auth.updateUser({ data: { full_name: fullName, name: fullName } });
      await supabase.from('profiles').update({ display_name: fullName }).eq('id', data.user.id);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = makeRedirectUri({ scheme: appScheme, path: 'auth/callback' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google', options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error('Google did not return an authorization URL.');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return;
    const code = new URL(result.url).searchParams.get('code');
    if (!code) throw new Error('Google callback did not include an authorization code.');
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
  }, []);

  const signInDemo = useCallback(async () => {
    if (!isStaging) throw new Error('The mock account is available only in staging.');
    const { error } = await supabase.auth.signInWithPassword({ email: 'jimin@alby.local', password: 'password' });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    queryClient.clear();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    isLoading,
    isProfileComplete: Boolean(profile?.username && profile.display_name),
    profile,
    refreshProfile,
    session,
    signInDemo,
    signInWithApple,
    signInWithGoogle,
    signOut,
  }), [isLoading, profile, refreshProfile, session, signInDemo, signInWithApple, signInWithGoogle, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
