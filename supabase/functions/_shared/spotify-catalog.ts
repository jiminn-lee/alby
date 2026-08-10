export type AlbumReleaseType = 'album' | 'ep';

export type SpotifyAlbumSearchResult = {
  spotifyId: string;
  title: string;
  artistName: string;
  coverUrl: string | null;
  releaseDate: string | null;
  trackCount: number;
  releaseType: AlbumReleaseType;
  spotifyUrl: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function releaseTypeFor(albumType: string, trackCount: number): AlbumReleaseType | null {
  if (albumType === 'album') return 'album';
  if (albumType === 'single' && trackCount >= 4 && trackCount <= 6) return 'ep';
  return null;
}

function normalizeReleaseDate(value: unknown) {
  const date = stringValue(value);
  if (!date) return null;
  const match = /^(\d{4})(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/.exec(date);
  if (!match) return null;
  if (!match[3]) return date;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysByMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysByMonth[month - 1] ? date : null;
}

export function isSpotifyAlbumId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9]{22}$/.test(value);
}

export function normalizeSpotifyAlbum(value: unknown): SpotifyAlbumSearchResult | null {
  if (!isRecord(value)) return null;

  const spotifyId = value.id;
  const title = stringValue(value.name);
  const albumType = stringValue(value.album_type);
  const trackCount = value.total_tracks;

  if (!isSpotifyAlbumId(spotifyId) || !title || !albumType || !Number.isInteger(trackCount) || (trackCount as number) < 1) {
    return null;
  }

  const releaseType = releaseTypeFor(albumType, trackCount as number);
  if (!releaseType || !Array.isArray(value.artists)) return null;

  const artistNames = value.artists
    .map((artist) => isRecord(artist) ? stringValue(artist.name) : null)
    .filter((name): name is string => Boolean(name));
  if (!artistNames.length) return null;

  const images = Array.isArray(value.images) ? value.images : [];
  const coverUrl = images
    .filter(isRecord)
    .map((image) => ({ url: stringValue(image.url), width: typeof image.width === 'number' ? image.width : 0 }))
    .filter((image): image is { url: string; width: number } => Boolean(image.url))
    .sort((left, right) => right.width - left.width)[0]?.url ?? null;

  const externalUrls = isRecord(value.external_urls) ? value.external_urls : null;
  const spotifyUrl = stringValue(externalUrls?.spotify) ?? `https://open.spotify.com/album/${spotifyId}`;

  return {
    spotifyId,
    title,
    artistName: artistNames.join(', '),
    coverUrl,
    releaseDate: normalizeReleaseDate(value.release_date),
    trackCount: trackCount as number,
    releaseType,
    spotifyUrl,
  };
}

export function parseSpotifySearchResponse(value: unknown): SpotifyAlbumSearchResult[] {
  if (!isRecord(value) || !isRecord(value.albums) || !Array.isArray(value.albums.items)) {
    throw new Error('Spotify returned a malformed search response.');
  }

  return value.albums.items
    .map(normalizeSpotifyAlbum)
    .filter((album): album is SpotifyAlbumSearchResult => album !== null);
}
