import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { SpotifyMaterializationResponse, SpotifySearchResponse } from '@/types/spotify';

export class SpotifyApiError extends Error {
  readonly code: string;
  readonly retryAfter: string | null;
  readonly status: number;

  constructor(message: string, status: number, code: string, retryAfter: string | null = null) {
    super(message);
    this.name = 'SpotifyApiError';
    this.code = code;
    this.retryAfter = retryAfter;
    this.status = status;
  }
}

function normalizeSearch(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [delay, value]);
  return debounced;
}

async function invokeSpotify<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<T>('spotify-albums', { body });
  if (!error && data !== null) return data;
  if (!error) throw new SpotifyApiError('Spotify returned an empty response.', 502, 'spotify_invalid_response');

  if (error instanceof FunctionsHttpError) {
    const response = error.context;
    const payload = await response.clone().json().catch(() => null) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new SpotifyApiError(
      payload?.error?.message ?? 'Spotify could not complete this request.',
      response.status,
      payload?.error?.code ?? 'spotify_request_failed',
      response.headers.get('Retry-After'),
    );
  }

  throw new SpotifyApiError('Could not reach Spotify. Check your connection and try again.', 0, 'network_error');
}

export function useSpotifyAlbumSearch(search: string) {
  const normalized = useMemo(() => normalizeSearch(search), [search]);
  const debounced = useDebouncedValue(normalized, 350);
  const query = useQuery({
    queryKey: ['spotify-album-search', debounced],
    enabled: debounced.length >= 2,
    staleTime: 5 * 60 * 1000,
    queryFn: () => invokeSpotify<SpotifySearchResponse>({ action: 'search', query: debounced }),
    retry: (failureCount, error) => failureCount < 1
      && error instanceof SpotifyApiError
      && (error.status === 0 || (error.status >= 500 && error.code !== 'spotify_not_configured')),
  });

  return { ...query, normalizedSearch: normalized, debouncedSearch: debounced };
}

export function useMaterializeSpotifyAlbum() {
  return useMutation({
    mutationFn: (spotifyId: string) => invokeSpotify<SpotifyMaterializationResponse>({ action: 'materialize', spotifyId }),
  });
}
