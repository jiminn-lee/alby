import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyMusicBrainzReleaseGroup,
  coverArtUrl,
  isMusicBrainzReleaseGroupId,
  normalizeMusicBrainzReleaseGroup,
  normalizeMusicBrainzSearchInput,
  parseMusicBrainzGenres,
  parseMusicBrainzSearchResponse,
} from '../_shared/musicbrainz-catalog.ts';
import {
  buildMusicBrainzSearchQuery,
  createMusicBrainzClient,
  MusicBrainzUpstreamError,
} from '../_shared/musicbrainz-client.ts';
import { formatGenreName } from '../../../src/lib/genres.ts';

const validId = '12345678-1234-4234-8234-123456789012';

function releaseGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: validId,
    title: 'Kind of Blue',
    'primary-type': 'Album',
    'secondary-types': [],
    'first-release-date': '1959-08-17',
    genres: [],
    'artist-credit': [
      { name: 'Miles Davis', joinphrase: ' feat. ' },
      { name: 'Guest Artist' },
    ],
    ...overrides,
  };
}

test('release-group IDs require a canonical MusicBrainz UUID', () => {
  assert.equal(isMusicBrainzReleaseGroupId(validId), true);
  assert.equal(isMusicBrainzReleaseGroupId('1234567890123456789012'), false);
  assert.equal(isMusicBrainzReleaseGroupId('12345678-1234-0234-8234-123456789012'), false);
});

test('search requests normalize whitespace and enforce the 2 to 100 character boundary', () => {
  assert.equal(normalizeMusicBrainzSearchInput('  Kind   of Blue  '), 'Kind of Blue');
  assert.throws(() => normalizeMusicBrainzSearchInput(null), /must be text/);
  assert.throws(() => normalizeMusicBrainzSearchInput('x'), /2 to 100/);
  assert.throws(() => normalizeMusicBrainzSearchInput('x'.repeat(101)), /2 to 100/);
});

test('albums and EPs are supported while compilations and singles are excluded', () => {
  assert.equal(normalizeMusicBrainzReleaseGroup(releaseGroup())?.releaseType, 'album');
  assert.equal(normalizeMusicBrainzReleaseGroup(releaseGroup({ 'primary-type': 'EP' }))?.releaseType, 'ep');
  assert.equal(normalizeMusicBrainzReleaseGroup(releaseGroup({ 'primary-type': 'Single' })), null);
  assert.equal(normalizeMusicBrainzReleaseGroup(releaseGroup({ 'secondary-types': ['Compilation'] })), null);
  assert.equal(classifyMusicBrainzReleaseGroup(releaseGroup({ 'primary-type': 'Single' })).status, 'unsupported');
  assert.equal(classifyMusicBrainzReleaseGroup({ id: validId }).status, 'malformed');
});

test('normalization preserves credited artist joins, partial dates, and deterministic artwork', () => {
  assert.deepEqual(normalizeMusicBrainzReleaseGroup(releaseGroup({ 'first-release-date': '1959-08' })), {
    releaseGroupId: validId,
    title: 'Kind of Blue',
    artistName: 'Miles Davis feat. Guest Artist',
    coverUrl: coverArtUrl(validId),
    releaseDate: '1959-08',
    releaseType: 'album',
    musicBrainzUrl: `https://musicbrainz.org/release-group/${validId}`,
  });
  assert.equal(normalizeMusicBrainzReleaseGroup(releaseGroup({ 'first-release-date': '1959' }))?.releaseDate, '1959');
  assert.equal(normalizeMusicBrainzReleaseGroup(releaseGroup({ 'first-release-date': '1959-02-31' }))?.releaseDate, null);
});

test('malformed items are discarded and malformed search envelopes throw', () => {
  assert.equal(normalizeMusicBrainzReleaseGroup(releaseGroup({ id: 'short' })), null);
  assert.equal(parseMusicBrainzSearchResponse({ 'release-groups': [releaseGroup(), { nope: true }] }).length, 1);
  assert.throws(() => parseMusicBrainzSearchResponse({}), /malformed/);
});

test('release-group genres are filtered, deduplicated, deterministically ranked, and capped at five', () => {
  const duplicateId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const result = parseMusicBrainzGenres(releaseGroup({
    genres: [
      { id: duplicateId, name: 'house', count: 3 },
      { id: duplicateId, name: 'House', count: 5 },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'zeta', count: 4 },
      { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'alpha', count: 4 },
      { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'electronic', count: 3 },
      { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: 'dance', count: 2 },
      { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', name: 'disco', count: 1 },
      { id: '11111111-1111-4111-8111-111111111111', name: 'zero votes', count: 0 },
      { id: '22222222-2222-4222-8222-222222222222', name: 'fractional', count: 1.5 },
      { id: 'not-a-uuid', name: 'invalid id', count: 10 },
      { id: '33333333-3333-4333-8333-333333333333', name: ' ', count: 10 },
    ],
    'artist-credit': [{
      name: 'Miles Davis',
      artist: { genres: [{ id: '44444444-4444-4444-8444-444444444444', name: 'jazz', count: 99 }] },
    }],
  }));

  assert.deepEqual(result, [
    { externalId: duplicateId, name: 'house', voteCount: 5, rank: 1 },
    { externalId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'alpha', voteCount: 4, rank: 2 },
    { externalId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'zeta', voteCount: 4, rank: 3 },
    { externalId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'electronic', voteCount: 3, rank: 4 },
    { externalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: 'dance', voteCount: 2, rank: 5 },
  ]);
});

test('release-group genre parsing supports confirmed-empty data and rejects malformed envelopes', () => {
  assert.deepEqual(parseMusicBrainzGenres(releaseGroup()), []);
  assert.throws(() => parseMusicBrainzGenres({}), /malformed genre data/);
  assert.throws(() => parseMusicBrainzGenres({ genres: null }), /malformed genre data/);
});

test('genre display casing preserves canonical acronyms and title-case conventions', () => {
  assert.equal(formatGenreName('contemporary r&b'), 'Contemporary R&B');
  assert.equal(formatGenreName('drum and bass'), 'Drum and Bass');
  assert.equal(formatGenreName('uk hip-hop/electronic'), 'UK Hip-Hop/Electronic');
});

test('search escapes Lucene syntax and sends the contactable User-Agent after reserving a slot', async () => {
  let reserved = 0;
  let request: Request | null = null;
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    request = new Request(input, init);
    return Response.json({ 'release-groups': [] });
  };
  const client = createMusicBrainzClient({
    beforeRequest: async () => { reserved += 1; },
    fetchImpl: fetchImpl as typeof fetch,
    userAgent: 'Alby/1.0.0 (https://github.com/jiminn-lee/alby)',
  });

  await client.searchReleaseGroups('blue:kind');

  assert.equal(reserved, 1);
  assert.equal(request?.headers.get('User-Agent'), 'Alby/1.0.0 (https://github.com/jiminn-lee/alby)');
  assert.match(decodeURIComponent(request?.url ?? ''), /blue\\:kind/);
  assert.match(buildMusicBrainzSearchQuery('blue'), /primarytype:\(album OR ep\)/);
});

test('429 and 503 errors preserve or supply Retry-After', async () => {
  for (const [status, header, expected] of [[429, '17', '17'], [503, null, '2']] as const) {
    const client = createMusicBrainzClient({
      fetchImpl: (async () => new Response(null, {
        status,
        headers: header ? { 'Retry-After': header } : undefined,
      })) as typeof fetch,
      userAgent: 'Alby/Test (https://example.test)',
    });
    await assert.rejects(
      () => client.searchReleaseGroups('blue'),
      (error) => error instanceof MusicBrainzUpstreamError
        && error.status === status
        && error.retryAfter === expected,
    );
  }
});

test('release-group lookups request artist credits and genres, encode IDs, and map missing releases', async () => {
  let requestedUrl = '';
  const client = createMusicBrainzClient({
    fetchImpl: (async (input) => {
      requestedUrl = String(input);
      return new Response(null, { status: 404 });
    }) as typeof fetch,
    userAgent: 'Alby/Test (https://example.test)',
  });
  await assert.rejects(
    () => client.getReleaseGroup(validId),
    (error) => error instanceof MusicBrainzUpstreamError
      && error.code === 'musicbrainz_release_group_not_found',
  );
  assert.match(requestedUrl, new RegExp(validId));
  assert.equal(new URL(requestedUrl).searchParams.get('inc'), 'artist-credits+genres');
});
