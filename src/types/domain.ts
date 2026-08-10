import type { Database, Tables } from './database';

export type Profile = Tables<'profiles'>;
export type Album = Tables<'albums'>;
export type Rating = Tables<'ratings'>;
export type ListenLaterItem = Tables<'listen_later_items'>;
export type ActivityEvent = Tables<'activity_events'>;
export type ActivityType = Database['public']['Enums']['activity_type'];
export type HomeFeedItem = Database['public']['Functions']['get_home_feed']['Returns'][number];
export type ProfileOverview = Database['public']['Functions']['get_profile_overview']['Returns'][number];
export type AlbumRatingSummary = Database['public']['Functions']['get_album_rating_summary']['Returns'][number];
