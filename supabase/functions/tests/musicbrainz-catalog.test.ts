import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyMusicBrainzReleaseGroup,
  coverArtUrl,
  isMusicBrainzReleaseGroupId,
  normalizeMusicBrainzReleaseGroup,
  normalizeMusicBrainzSearchInput,
  parseMusicBrainzSearchResponse,
} from '../_shared/musicbrainz-catalog.ts';
import {
  buildMusicBrainzSearchQuery,
  createMusicBrainzClient,
  MusicBrainzUpstreamError,
} from '../_shared/musicbrainz-client.ts';

const validId = '12345678-1234-4234-8234-123456789012';

function releaseGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: validId,
    title: 'Kind of Blue',
    'primary-type': 'Album',
    'secondary-types': [],
    'first-release-date': '1959-08-17',
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

test('release-group lookups encode IDs and map missing releases', async () => {
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
});
