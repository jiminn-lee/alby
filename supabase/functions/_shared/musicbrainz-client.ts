export type MusicBrainzClientOptions = {
  fetchImpl?: typeof fetch;
  beforeRequest?: () => Promise<void>;
  userAgent: string;
};

export class MusicBrainzUpstreamError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter?: string;

  constructor(message: string, status: number, code: string, retryAfter?: string) {
    super(message);
    this.name = 'MusicBrainzUpstreamError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export function buildMusicBrainzSearchQuery(query: string) {
  const luceneReserved = new Set('+ - & | ! ( ) { } [ ] ^ " ~ * ? : \\ /'.split(' '));
  const escaped = [...query].map((character) => (
    luceneReserved.has(character) ? `\\${character}` : character
  )).join('');
  return `${escaped} AND primarytype:(album OR ep) AND NOT secondarytype:compilation`;
}

export function createMusicBrainzClient(options: MusicBrainzClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request(path: string): Promise<unknown> {
    await options.beforeRequest?.();

    let response: Response;
    try {
      response = await fetchImpl(`https://musicbrainz.org${path}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': options.userAgent,
        },
      });
    } catch {
      throw new MusicBrainzUpstreamError(
        'MusicBrainz is temporarily unavailable.',
        502,
        'musicbrainz_unavailable',
      );
    }

    const retryAfter = response.headers.get('Retry-After') ?? undefined;
    if (response.status === 429) {
      throw new MusicBrainzUpstreamError(
        'MusicBrainz is rate limiting requests. Try again shortly.',
        429,
        'musicbrainz_rate_limited',
        retryAfter ?? '2',
      );
    }
    if (response.status === 404) {
      throw new MusicBrainzUpstreamError(
        'That MusicBrainz release group is unavailable.',
        404,
        'musicbrainz_release_group_not_found',
      );
    }
    if (response.status === 503) {
      throw new MusicBrainzUpstreamError(
        'MusicBrainz is temporarily unavailable.',
        503,
        'musicbrainz_unavailable',
        retryAfter ?? '2',
      );
    }
    if (!response.ok) {
      throw new MusicBrainzUpstreamError(
        'MusicBrainz is temporarily unavailable.',
        502,
        'musicbrainz_unavailable',
        retryAfter,
      );
    }

    try {
      return await response.json();
    } catch {
      throw new MusicBrainzUpstreamError(
        'MusicBrainz returned an invalid response.',
        502,
        'musicbrainz_invalid_response',
      );
    }
  }

  return {
    searchReleaseGroups(query: string) {
      const parameters = new URLSearchParams({
        query: buildMusicBrainzSearchQuery(query),
        fmt: 'json',
        limit: '10',
      });
      return request(`/ws/2/release-group?${parameters}`);
    },
    getReleaseGroup(releaseGroupId: string) {
      const parameters = new URLSearchParams({
        inc: 'artist-credits',
        fmt: 'json',
      });
      return request(`/ws/2/release-group/${encodeURIComponent(releaseGroupId)}?${parameters}`);
    },
  };
}
