import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSpotifyAlbum, parseSpotifySearchResponse } from '../_shared/spotify-catalog.ts';
import { createSpotifyClient, SpotifyUpstreamError } from '../_shared/spotify-client.ts';

const validId = '1234567890123456789012';

function album(overrides: Record<string, unknown> = {}) {
  return {
    id: validId,
    name: 'Kind of Blue',
    album_type: 'album',
    total_tracks: 5,
    release_date: '1959-08-17',
    artists: [{ name: 'Miles Davis' }, { name: 'Guest Artist' }],
    images: [
      { url: 'https://image.test/small.jpg', width: 64 },
      { url: 'https://image.test/wide.jpg', width: 640 },
    ],
    external_urls: { spotify: `https://open.spotify.com/album/${validId}` },
    ...overrides,
  };
}

test('albums and four-to-six-track singles are supported', () => {
  assert.equal(normalizeSpotifyAlbum(album())?.releaseType, 'album');
  assert.equal(normalizeSpotifyAlbum(album({ album_type: 'single', total_tracks: 4 }))?.releaseType, 'ep');
  assert.equal(normalizeSpotifyAlbum(album({ album_type: 'single', total_tracks: 6 }))?.releaseType, 'ep');
});

test('compilations and singles outside the EP boundary are excluded', () => {
  assert.equal(normalizeSpotifyAlbum(album({ album_type: 'compilation' })), null);
  assert.equal(normalizeSpotifyAlbum(album({ album_type: 'single', total_tracks: 3 })), null);
  assert.equal(normalizeSpotifyAlbum(album({ album_type: 'single', total_tracks: 7 })), null);
});

test('normalization joins artists, preserves partial dates, and selects widest artwork', () => {
  const normalized = normalizeSpotifyAlbum(album({ release_date: '1959-08' }));
  assert.deepEqual(normalized, {
    spotifyId: validId,
    title: 'Kind of Blue',
    artistName: 'Miles Davis, Guest Artist',
    coverUrl: 'https://image.test/wide.jpg',
    releaseDate: '1959-08',
    trackCount: 5,
    releaseType: 'album',
    spotifyUrl: `https://open.spotify.com/album/${validId}`,
  });
  assert.equal(normalizeSpotifyAlbum(album({ release_date: '1959' }))?.releaseDate, '1959');
  assert.equal(normalizeSpotifyAlbum(album({ release_date: '1959-02-31' }))?.releaseDate, null);
});

test('malformed items are discarded and malformed search envelopes throw', () => {
  assert.equal(normalizeSpotifyAlbum(album({ id: 'short' })), null);
  assert.deepEqual(parseSpotifySearchResponse({ albums: { items: [album(), { nope: true }] } }).length, 1);
  assert.throws(() => parseSpotifySearchResponse({ albums: {} }), /malformed/);
});

test('access tokens are cached until their safety-window expiry', async () => {
  let tokenCalls = 0;
  const fetchImpl = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/api/token')) {
      tokenCalls += 1;
      return Response.json({ access_token: `token-${tokenCalls}`, expires_in: 3600 });
    }
    return Response.json({ albums: { items: [] } });
  };
  const client = createSpotifyClient({ clientId: 'id', clientSecret: 'secret', market: 'US', fetchImpl: fetchImpl as typeof fetch });
  await client.searchAlbums('blue');
  await client.searchAlbums('jazz');
  assert.equal(tokenCalls, 1);
});

test('an upstream 401 refreshes the token exactly once', async () => {
  let tokenCalls = 0;
  let apiCalls = 0;
  const fetchImpl = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/api/token')) {
      tokenCalls += 1;
      return Response.json({ access_token: `token-${tokenCalls}`, expires_in: 3600 });
    }
    apiCalls += 1;
    return apiCalls === 1 ? new Response(null, { status: 401 }) : Response.json({ albums: { items: [] } });
  };
  const client = createSpotifyClient({ clientId: 'id', clientSecret: 'secret', market: 'US', fetchImpl: fetchImpl as typeof fetch });
  await client.searchAlbums('blue');
  assert.equal(tokenCalls, 2);
  assert.equal(apiCalls, 2);
});

test('429 errors preserve Retry-After', async () => {
  const fetchImpl = async (input: string | URL | Request) => {
    if (String(input).includes('/api/token')) return Response.json({ access_token: 'token', expires_in: 3600 });
    return new Response(null, { status: 429, headers: { 'Retry-After': '17' } });
  };
  const client = createSpotifyClient({ clientId: 'id', clientSecret: 'secret', market: 'US', fetchImpl: fetchImpl as typeof fetch });
  await assert.rejects(
    () => client.searchAlbums('blue'),
    (error) => error instanceof SpotifyUpstreamError && error.status === 429 && error.retryAfter === '17',
  );
});
