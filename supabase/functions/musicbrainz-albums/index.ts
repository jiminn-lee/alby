import { withSupabase } from 'npm:@supabase/server@^1';

import {
  classifyMusicBrainzReleaseGroup,
  isMusicBrainzReleaseGroupId,
  normalizeMusicBrainzSearchInput,
  parseMusicBrainzGenres,
  parseMusicBrainzSearchResponse,
} from '../_shared/musicbrainz-catalog.ts';
import { createMusicBrainzClient, MusicBrainzUpstreamError } from '../_shared/musicbrainz-client.ts';

const MUSICBRAINZ_USER_AGENT = 'Alby/1.0.0 (https://github.com/jiminn-lee/alby)';

class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter?: string;

  constructor(message: string, status: number, code: string, retryAfter?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers });
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
      const reserveRequestSlot = async () => {
        const slotResult = await context.supabaseAdmin.rpc('reserve_catalog_request_slot', {
          catalog_provider: 'musicbrainz',
          minimum_interval_ms: 1100,
          maximum_wait_ms: 5000,
        });
        if (slotResult.error) throw slotResult.error;
        if (typeof slotResult.data !== 'number') {
          throw new ApiError('The catalog request queue is unavailable.', 503, 'catalog_queue_unavailable');
        }
        if (slotResult.data < 0) {
          throw new ApiError(
            'MusicBrainz is busy. Try again shortly.',
            429,
            'musicbrainz_rate_limited',
            '5',
          );
        }
        if (slotResult.data > 0) {
          await new Promise((resolve) => setTimeout(resolve, slotResult.data));
        }
      };
      const client = createMusicBrainzClient({
        beforeRequest: reserveRequestSlot,
        userAgent: MUSICBRAINZ_USER_AGENT,
      });

      if (body.action === 'search') {
        let query: string;
        try {
          query = normalizeMusicBrainzSearchInput(body.query);
        } catch (error) {
          throw new ApiError(
            error instanceof Error ? error.message : 'Search query is invalid.',
            400,
            'invalid_query',
          );
        }
        const payload = await client.searchReleaseGroups(query);
        try {
          return json({ albums: parseMusicBrainzSearchResponse(payload) });
        } catch {
          throw new ApiError('MusicBrainz returned an invalid response.', 502, 'musicbrainz_invalid_response');
        }
      }

      if (body.action === 'materialize') {
        if (!isMusicBrainzReleaseGroupId(body.releaseGroupId)) {
          throw new ApiError(
            'A valid MusicBrainz release-group ID is required.',
            400,
            'invalid_musicbrainz_release_group_id',
          );
        }
        const releaseGroupId = body.releaseGroupId.toLowerCase();

        const existingSourceResult = await context.supabaseAdmin
          .from('album_catalog_sources')
          .select('album_id, genres_synced_at')
          .eq('provider', 'musicbrainz')
          .eq('external_id', releaseGroupId)
          .maybeSingle();
        if (existingSourceResult.error) throw existingSourceResult.error;

        if (existingSourceResult.data?.genres_synced_at) {
          const existingAlbumResult = await context.supabaseAdmin
            .from('albums')
            .select('*')
            .eq('id', existingSourceResult.data.album_id)
            .single();
          if (existingAlbumResult.error) throw existingAlbumResult.error;
          return json({ album: existingAlbumResult.data, outcome: 'existing' });
        }

        const musicBrainzPayload = await client.getReleaseGroup(releaseGroupId);
        const classification = classifyMusicBrainzReleaseGroup(musicBrainzPayload);
        if (classification.status === 'malformed') {
          throw new ApiError(
            'MusicBrainz returned an invalid response.',
            502,
            'musicbrainz_invalid_response',
          );
        }
        if (classification.status === 'unsupported') {
          throw new ApiError(
            'That release is outside Alby’s album and EP catalog.',
            422,
            'unsupported_release',
          );
        }
        const canonicalAlbum = classification.album;
        if (canonicalAlbum.releaseGroupId.toLowerCase() !== releaseGroupId) {
          throw new ApiError(
            'MusicBrainz returned an invalid response.',
            502,
            'musicbrainz_invalid_response',
          );
        }

        let genres;
        try {
          genres = parseMusicBrainzGenres(musicBrainzPayload);
        } catch {
          throw new ApiError(
            'MusicBrainz returned an invalid response.',
            502,
            'musicbrainz_invalid_response',
          );
        }

        let albumId = existingSourceResult.data?.album_id;
        let outcome = 'existing';
        if (!albumId) {
          const materializeResult = await context.supabaseAdmin.rpc('materialize_catalog_album', {
            catalog_provider: 'musicbrainz',
            catalog_external_id: canonicalAlbum.releaseGroupId,
            catalog_external_url: canonicalAlbum.musicBrainzUrl,
            album_title: canonicalAlbum.title,
            album_artist_name: canonicalAlbum.artistName,
            album_cover_path: canonicalAlbum.coverUrl,
            album_release_date: canonicalAlbum.releaseDate,
            album_track_count: null,
            album_release_type: canonicalAlbum.releaseType,
          }).single();
          if (materializeResult.error) throw materializeResult.error;
          albumId = materializeResult.data.album_id;
          outcome = materializeResult.data.outcome;
        }

        const genreSyncResult = await context.supabaseAdmin.rpc('sync_catalog_album_genres', {
          target_album_id: albumId,
          catalog_provider: 'musicbrainz',
          genre_payload: genres.map((genre) => ({
            external_id: genre.externalId,
            name: genre.name,
            vote_count: genre.voteCount,
            rank: genre.rank,
          })),
        });
        if (genreSyncResult.error) throw genreSyncResult.error;

        const albumResult = await context.supabaseAdmin
          .from('albums')
          .select('*')
          .eq('id', albumId)
          .single();
        if (albumResult.error) throw albumResult.error;

        return json({ album: albumResult.data, outcome });
      }

      throw new ApiError('Action must be search or materialize.', 400, 'invalid_action');
    } catch (error) {
      const apiError = error instanceof ApiError
        ? error
        : error instanceof MusicBrainzUpstreamError
          ? new ApiError(error.message, error.status, error.code, error.retryAfter)
          : new ApiError('The request could not be completed.', 500, 'internal_error');
      console.error(JSON.stringify({ code: apiError.code, status: apiError.status }));
      const headers = apiError.retryAfter ? { 'Retry-After': apiError.retryAfter } : undefined;
      return json({ error: { code: apiError.code, message: apiError.message } }, apiError.status, headers);
    }
  }),
};
