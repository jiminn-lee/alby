import type { Album } from './domain';

export type SpotifyAlbumSearchResult = {
  spotifyId: string;
  title: string;
  artistName: string;
  coverUrl: string | null;
  releaseDate: string | null;
  trackCount: number;
  releaseType: 'album' | 'ep';
  spotifyUrl: string;
};

export type SpotifySearchResponse = { albums: SpotifyAlbumSearchResult[] };
export type SpotifyMaterializationResponse = {
  album: Album;
  outcome: 'existing' | 'reconciled' | 'created';
};
