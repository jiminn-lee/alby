export type SpotifyClientOptions = {
  clientId: string;
  clientSecret: string;
  market: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export class SpotifyUpstreamError extends Error {
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
    this.name = 'SpotifyUpstreamError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

type AccessToken = { value: string; expiresAt: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createSpotifyClient(options: SpotifyClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  let cachedToken: AccessToken | null = null;

  async function getToken(forceRefresh = false) {
    if (!forceRefresh && cachedToken && cachedToken.expiresAt > now()) return cachedToken.value;

    let response: Response;
    try {
      response = await fetchImpl('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${options.clientId}:${options.clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
    } catch {
      throw new SpotifyUpstreamError('Spotify authentication is temporarily unavailable.', 502, 'spotify_auth_unavailable');
    }

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload) || typeof payload.access_token !== 'string' || typeof payload.expires_in !== 'number') {
      throw new SpotifyUpstreamError('Spotify authentication is temporarily unavailable.', 502, 'spotify_auth_unavailable');
    }

    cachedToken = {
      value: payload.access_token,
      expiresAt: now() + Math.max(0, payload.expires_in - 60) * 1000,
    };
    return cachedToken.value;
  }

  async function request(path: string, retriedAfterUnauthorized = false): Promise<unknown> {
    const token = await getToken(retriedAfterUnauthorized);
    let response: Response;
    try {
      response = await fetchImpl(`https://api.spotify.com${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      throw new SpotifyUpstreamError('Spotify is temporarily unavailable.', 502, 'spotify_unavailable');
    }

    if (response.status === 401 && !retriedAfterUnauthorized) {
      cachedToken = null;
      return request(path, true);
    }
    if (response.status === 429) {
      throw new SpotifyUpstreamError(
        'Spotify is rate limiting requests. Try again shortly.',
        429,
        'spotify_rate_limited',
        response.headers.get('Retry-After') ?? undefined,
      );
    }
    if (response.status === 404) {
      throw new SpotifyUpstreamError('That Spotify album is unavailable.', 404, 'spotify_album_not_found');
    }
    if (!response.ok) {
      throw new SpotifyUpstreamError('Spotify is temporarily unavailable.', 502, 'spotify_unavailable');
    }

    try {
      return await response.json();
    } catch {
      throw new SpotifyUpstreamError('Spotify returned an invalid response.', 502, 'spotify_invalid_response');
    }
  }

  return {
    searchAlbums(query: string) {
      const parameters = new URLSearchParams({
        q: query,
        type: 'album',
        market: options.market,
        limit: '10',
      });
      return request(`/v1/search?${parameters}`);
    },
    getAlbum(spotifyId: string) {
      const parameters = new URLSearchParams({ market: options.market });
      return request(`/v1/albums/${encodeURIComponent(spotifyId)}?${parameters}`);
    },
  };
}
