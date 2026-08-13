import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type {
  MusicBrainzMaterializationResponse,
  MusicBrainzSearchResponse,
} from '@/types/musicbrainz';

export class MusicBrainzApiError extends Error {
  readonly code: string;
  readonly retryAfter: string | null;
  readonly status: number;

  constructor(message: string, status: number, code: string, retryAfter: string | null = null) {
    super(message);
    this.name = 'MusicBrainzApiError';
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

async function invokeMusicBrainz<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<T>('musicbrainz-albums', { body });
  if (!error && data !== null) return data;
  if (!error) {
    throw new MusicBrainzApiError(
      'MusicBrainz returned an empty response.',
      502,
      'musicbrainz_invalid_response',
    );
  }

  if (error instanceof FunctionsHttpError) {
    const response = error.context;
    const payload = await response.clone().json().catch(() => null) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new MusicBrainzApiError(
      payload?.error?.message ?? 'MusicBrainz could not complete this request.',
      response.status,
      payload?.error?.code ?? 'musicbrainz_request_failed',
      response.headers.get('Retry-After'),
    );
  }

  throw new MusicBrainzApiError(
    'Could not reach MusicBrainz. Check your connection and try again.',
    0,
    'network_error',
  );
}

function shouldRetry(failureCount: number, error: Error) {
  return failureCount < 1
    && error instanceof MusicBrainzApiError
    && (error.status === 0 || error.status === 429 || error.status >= 500);
}

function retryDelay(_attemptIndex: number, error: Error) {
  if (error instanceof MusicBrainzApiError && error.retryAfter) {
    const retryAfterSeconds = Number(error.retryAfter);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
      return Math.min(10_000, Math.max(1_000, retryAfterSeconds * 1000));
    }
  }
  return 1_000;
}

export function useMusicBrainzAlbumSearch(search: string) {
  const normalized = useMemo(() => normalizeSearch(search), [search]);
  const debounced = useDebouncedValue(normalized, 350);
  const query = useQuery({
    queryKey: ['musicbrainz-album-search', debounced],
    enabled: debounced.length >= 2,
    staleTime: 10 * 60 * 1000,
    queryFn: () => invokeMusicBrainz<MusicBrainzSearchResponse>({ action: 'search', query: debounced }),
    retry: shouldRetry,
    retryDelay,
  });

  return { ...query, normalizedSearch: normalized, debouncedSearch: debounced };
}

export function useMaterializeMusicBrainzAlbum() {
  return useMutation({
    mutationFn: (releaseGroupId: string) => invokeMusicBrainz<MusicBrainzMaterializationResponse>({
      action: 'materialize',
      releaseGroupId,
    }),
    retry: shouldRetry,
    retryDelay,
  });
}
