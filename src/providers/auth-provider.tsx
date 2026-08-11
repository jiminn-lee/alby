import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { isRunningInExpoGo } from 'expo';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { queryClient } from '@/lib/query-client';
import { appScheme } from '@/lib/app-env';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/domain';

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  authError: string | null;
  isLoading: boolean;
  isProfileComplete: boolean;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  retryAuth: () => Promise<void>;
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function callbackParams(url: URL) {
  const params = new URLSearchParams(url.search);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  hashParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return params;
}

function assertExpectedCallback(callbackUrl: URL, redirectTo: string) {
  const expectedUrl = new URL(redirectTo);
  if (
    callbackUrl.protocol !== expectedUrl.protocol
    || callbackUrl.host !== expectedUrl.host
    || callbackUrl.pathname !== expectedUrl.pathname
  ) {
    throw new Error('Google returned to an unexpected callback URL.');
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [authError, setAuthError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const retryVersionRef = useRef(0);
  const syncVersionRef = useRef(0);

  const synchronizeSession = useCallback(async (nextSession: Session | null, showLoading = false) => {
    if (!mountedRef.current) return;
    const syncVersion = ++syncVersionRef.current;
    const nextUserId = nextSession?.user.id ?? null;
    const userChanged = currentUserIdRef.current !== nextUserId;

    if (showLoading || userChanged) setIsLoading(true);
    if (userChanged) {
      queryClient.clear();
      setProfile(null);
    }

    currentUserIdRef.current = nextUserId;
    setSession(nextSession);

    if (!nextSession) {
      if (mountedRef.current && syncVersion === syncVersionRef.current) {
        setAuthError(null);
        setIsLoading(false);
      }
      return;
    }

    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', nextSession.user.id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Your Alby profile could not be loaded.');
      if (!mountedRef.current || syncVersion !== syncVersionRef.current) return;
      setProfile(data);
      setAuthError(null);
    } catch (error) {
      if (mountedRef.current && syncVersion === syncVersionRef.current) {
        setAuthError(errorMessage(error, 'Alby could not load your account.'));
      }
      throw error;
    } finally {
      if (mountedRef.current && syncVersion === syncVersionRef.current) setIsLoading(false);
    }
  }, []);

  const retryAuth = useCallback(async () => {
    const retryVersion = ++retryVersionRef.current;
    setAuthError(null);
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!mountedRef.current || retryVersion !== retryVersionRef.current) return;
      await synchronizeSession(data.session, true);
    } catch (error) {
      if (mountedRef.current && retryVersion === retryVersionRef.current) {
        setAuthError(errorMessage(error, 'Alby could not restore your session.'));
        setIsLoading(false);
      }
    }
  }, [synchronizeSession]);

  const refreshProfile = useCallback(async () => {
    await synchronizeSession(session);
  }, [session, synchronizeSession]);

  useEffect(() => {
    mountedRef.current = true;
    const bootstrapTimer = setTimeout(() => void retryAuth(), 0);

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const userChanged = currentUserIdRef.current !== (nextSession?.user.id ?? null);
      setTimeout(() => {
        if (!mountedRef.current) return;
        void synchronizeSession(nextSession, userChanged).catch(() => undefined);
      }, 0);
    });

    return () => {
      clearTimeout(bootstrapTimer);
      mountedRef.current = false;
      retryVersionRef.current += 1;
      syncVersionRef.current += 1;
      data.subscription.unsubscribe();
    };
  }, [retryAuth, synchronizeSession]);

  const signInWithGoogle = useCallback(async () => {
    if (Platform.OS === 'web') throw new Error('Google sign-in is currently available only in the Alby mobile app.');
    if (isRunningInExpoGo()) {
      throw new Error('Google sign-in requires an Alby development build. Run npm run ios or npm run android.');
    }

    const redirectTo = makeRedirectUri({ scheme: appScheme, path: 'auth/callback' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error('Google did not return an authorization URL.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return;

    const callbackUrl = new URL(result.url);
    assertExpectedCallback(callbackUrl, redirectTo);
    const params = callbackParams(callbackUrl);
    const providerError = params.get('error_description') ?? params.get('error_code') ?? params.get('error');
    if (providerError) throw new Error(providerError);

    const code = params.get('code');
    if (!code) throw new Error('Google callback did not include an authorization code.');
    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    if (!sessionData.session) throw new Error('Google sign-in did not create an Alby session.');
    await synchronizeSession(sessionData.session, true);
  }, [synchronizeSession]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await synchronizeSession(null, true);
  }, [synchronizeSession]);

  const value = useMemo<AuthContextValue>(() => ({
    authError,
    isLoading,
    isProfileComplete: Boolean(profile?.username && profile.display_name),
    profile,
    refreshProfile,
    retryAuth,
    session,
    signInWithGoogle,
    signOut,
  }), [authError, isLoading, profile, refreshProfile, retryAuth, session, signInWithGoogle, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
