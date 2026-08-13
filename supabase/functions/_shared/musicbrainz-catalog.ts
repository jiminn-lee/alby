export type AlbumReleaseType = 'album' | 'ep';

export type MusicBrainzAlbumSearchResult = {
  releaseGroupId: string;
  title: string;
  artistName: string;
  coverUrl: string;
  releaseDate: string | null;
  releaseType: AlbumReleaseType;
  musicBrainzUrl: string;
};

export type MusicBrainzGenre = {
  externalId: string;
  name: string;
  voteCount: number;
  rank: number;
};

export type MusicBrainzReleaseGroupClassification =
  | { status: 'supported'; album: MusicBrainzAlbumSearchResult }
  | { status: 'unsupported' }
  | { status: 'malformed' };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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

function artistCreditName(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return null;

  const credits = value.map((credit, index) => {
    if (!isRecord(credit)) return null;
    const name = stringValue(credit.name)
      ?? (isRecord(credit.artist) ? stringValue(credit.artist.name) : null);
    if (!name) return null;
    const fallbackJoin = index < value.length - 1 ? ', ' : '';
    const joinPhrase = typeof credit.joinphrase === 'string' ? credit.joinphrase : fallbackJoin;
    return `${name}${joinPhrase}`;
  });

  return credits.every((credit): credit is string => credit !== null)
    ? credits.join('').trim()
    : null;
}

function releaseTypeFor(value: unknown): AlbumReleaseType | null {
  const primaryType = stringValue(value)?.toLowerCase();
  if (primaryType === 'album') return 'album';
  if (primaryType === 'ep') return 'ep';
  return null;
}

function isCompilation(value: unknown) {
  return Array.isArray(value)
    && value.some((type) => stringValue(type)?.toLowerCase() === 'compilation');
}

export function isMusicBrainzReleaseGroupId(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeMusicBrainzSearchInput(value: unknown) {
  if (typeof value !== 'string') throw new Error('Search query must be text.');
  const query = value.trim().replace(/\s+/g, ' ');
  if (query.length < 2 || query.length > 100) {
    throw new Error('Search query must contain 2 to 100 characters.');
  }
  return query;
}

export function parseMusicBrainzGenres(value: unknown): MusicBrainzGenre[] {
  if (!isRecord(value) || !Array.isArray(value.genres)) {
    throw new Error('MusicBrainz returned malformed genre data.');
  }

  const genresById = new Map<string, Omit<MusicBrainzGenre, 'rank'>>();
  for (const genre of value.genres) {
    if (!isRecord(genre)) continue;
    const externalId = stringValue(genre.id);
    const name = stringValue(genre.name);
    const voteCount = genre.count;
    if (!externalId || !isMusicBrainzReleaseGroupId(externalId)
        || !name || !Number.isInteger(voteCount) || Number(voteCount) < 1) {
      continue;
    }

    const candidate = { externalId, name: name.toLocaleLowerCase('en-US'), voteCount: Number(voteCount) };
    const existing = genresById.get(externalId);
    if (!existing || candidate.voteCount > existing.voteCount
        || (candidate.voteCount === existing.voteCount && candidate.name < existing.name)) {
      genresById.set(externalId, candidate);
    }
  }

  return [...genresById.values()]
    .sort((left, right) => right.voteCount - left.voteCount
      || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    .slice(0, 5)
    .map((genre, index) => ({ ...genre, rank: index + 1 }));
}

export function coverArtUrl(releaseGroupId: string) {
  return `https://coverartarchive.org/release-group/${releaseGroupId}/front-500`;
}

export function normalizeMusicBrainzReleaseGroup(value: unknown): MusicBrainzAlbumSearchResult | null {
  const classification = classifyMusicBrainzReleaseGroup(value);
  return classification.status === 'supported' ? classification.album : null;
}

export function classifyMusicBrainzReleaseGroup(
  value: unknown,
): MusicBrainzReleaseGroupClassification {
  if (!isRecord(value)) return { status: 'malformed' };

  const releaseGroupId = stringValue(value.id);
  const title = stringValue(value.title);
  const primaryType = stringValue(value['primary-type']);
  const releaseType = releaseTypeFor(value['primary-type']);
  const artistName = artistCreditName(value['artist-credit']);

  if (!releaseGroupId || !isMusicBrainzReleaseGroupId(releaseGroupId)
      || !title || !primaryType || !artistName) {
    return { status: 'malformed' };
  }
  if (!releaseType || isCompilation(value['secondary-types'])) {
    return { status: 'unsupported' };
  }

  return {
    status: 'supported',
    album: {
      releaseGroupId,
      title,
      artistName,
      coverUrl: coverArtUrl(releaseGroupId),
      releaseDate: normalizeReleaseDate(value['first-release-date']),
      releaseType,
      musicBrainzUrl: `https://musicbrainz.org/release-group/${releaseGroupId}`,
    },
  };
}

export function parseMusicBrainzSearchResponse(value: unknown): MusicBrainzAlbumSearchResult[] {
  if (!isRecord(value) || !Array.isArray(value['release-groups'])) {
    throw new Error('MusicBrainz returned a malformed search response.');
  }

  return value['release-groups']
    .map(normalizeMusicBrainzReleaseGroup)
    .filter((album): album is MusicBrainzAlbumSearchResult => album !== null)
    .slice(0, 10);
}
