import type { Album } from './domain';

export type MusicBrainzAlbumSearchResult = {
  releaseGroupId: string;
  title: string;
  artistName: string;
  coverUrl: string;
  releaseDate: string | null;
  releaseType: 'album' | 'ep';
  musicBrainzUrl: string;
};

export type MusicBrainzSearchResponse = { albums: MusicBrainzAlbumSearchResult[] };
export type MusicBrainzMaterializationResponse = {
  album: Album;
  outcome: 'existing' | 'reconciled' | 'created';
};
