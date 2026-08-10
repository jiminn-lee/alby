import { withSupabase } from 'npm:@supabase/server@^1';

import { isSpotifyAlbumId, normalizeSpotifyAlbum, parseSpotifySearchResponse } from '../_shared/spotify-catalog.ts';
import { createSpotifyClient, SpotifyUpstreamError } from '../_shared/spotify-client.ts';

class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter?: string;

  constructor(
    message: string,
    status: number,
    code: string,
    retryAfter?: string,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

let spotifyClient: ReturnType<typeof createSpotifyClient> | null = null;

function getSpotifyClient() {
  if (spotifyClient) return spotifyClient;

  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  const market = Deno.env.get('SPOTIFY_MARKET') ?? 'US';
  if (!clientId || !clientSecret || !/^[A-Z]{2}$/.test(market)) {
    throw new ApiError('Spotify is not configured for this environment.', 503, 'spotify_not_configured');
  }

  spotifyClient = createSpotifyClient({ clientId, clientSecret, market });
  return spotifyClient;
}

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers });
}

function normalizeQuery(value: unknown) {
  if (typeof value !== 'string') throw new ApiError('Search query must be text.', 400, 'invalid_query');
  const query = value.trim().replace(/\s+/g, ' ');
  if (query.length < 2 || query.length > 100) {
    throw new ApiError('Search query must contain 2 to 100 characters.', 400, 'invalid_query');
  }
  return query;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new ApiError('Request body must be valid JSON.', 400, 'invalid_request');
  }
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, context) => {
    try {
      if (request.method !== 'POST') throw new ApiError('Method not allowed.', 405, 'method_not_allowed');

      const body = await readBody(request);

      if (body.action === 'search') {
        const query = normalizeQuery(body.query);
        const client = getSpotifyClient();
        const payload = await client.searchAlbums(query);
        try {
          return json({ albums: parseSpotifySearchResponse(payload) });
        } catch {
          throw new ApiError('Spotify returned an invalid response.', 502, 'spotify_invalid_response');
        }
      }

      if (body.action === 'materialize') {
        if (!isSpotifyAlbumId(body.spotifyId)) {
          throw new ApiError('A valid Spotify album ID is required.', 400, 'invalid_spotify_id');
        }

        const existingResult = await context.supabaseAdmin
          .from('albums')
          .select('*')
          .eq('spotify_id', body.spotifyId)
          .maybeSingle();
        if (existingResult.error) throw existingResult.error;
        if (existingResult.data) return json({ album: existingResult.data, outcome: 'existing' });

        const client = getSpotifyClient();
        const spotifyPayload = await client.getAlbum(body.spotifyId);
        const canonicalAlbum = normalizeSpotifyAlbum(spotifyPayload);
        if (!canonicalAlbum) {
          throw new ApiError('That release is outside Alby’s album and EP catalog.', 422, 'unsupported_release');
        }

        const materializeResult = await context.supabaseAdmin.rpc('materialize_spotify_album', {
          spotify_album_id: canonicalAlbum.spotifyId,
          album_title: canonicalAlbum.title,
          album_artist_name: canonicalAlbum.artistName,
          album_cover_path: canonicalAlbum.coverUrl,
          album_release_date: canonicalAlbum.releaseDate,
          album_track_count: canonicalAlbum.trackCount,
          album_release_type: canonicalAlbum.releaseType,
          album_spotify_url: canonicalAlbum.spotifyUrl,
        }).single();
        if (materializeResult.error) throw materializeResult.error;

        const albumResult = await context.supabaseAdmin
          .from('albums')
          .select('*')
          .eq('id', materializeResult.data.album_id)
          .single();
        if (albumResult.error) throw albumResult.error;

        return json({ album: albumResult.data, outcome: materializeResult.data.outcome });
      }

      throw new ApiError('Action must be search or materialize.', 400, 'invalid_action');
    } catch (error) {
      const apiError = error instanceof ApiError
        ? error
        : error instanceof SpotifyUpstreamError
          ? new ApiError(error.message, error.status, error.code, error.retryAfter)
          : new ApiError('The request could not be completed.', 500, 'internal_error');
      console.error(JSON.stringify({ code: apiError.code, status: apiError.status }));
      const headers = apiError.retryAfter ? { 'Retry-After': apiError.retryAfter } : undefined;
      return json({ error: { code: apiError.code, message: apiError.message } }, apiError.status, headers);
    }
  }),
};
