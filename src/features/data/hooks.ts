import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import type { Album, AlbumRatingSummary, HomeFeedItem, ProfileOverview, Rating } from '@/types/domain';

export const queryKeys = {
  home: ['home-feed'] as const,
  album: (id: string) => ['album', id] as const,
  albumActivity: (id: string) => ['album-activity', id] as const,
  profile: (username: string) => ['profile', username] as const,
  profileFeed: (id: string) => ['profile-feed', id] as const,
  profileRatings: (id: string) => ['profile-ratings', id] as const,
  profileSaved: (id: string) => ['profile-saved', id] as const,
};

export type SocialActivity = {
  activity_type: 'rating_created' | 'rating_updated' | 'listen_later_added';
  actor: { avatar_path: string | null; display_name: string | null; id: string; username: string | null };
  album: Album;
  album_id: string;
  created_at: string;
  id: string;
  rating: Rating | null;
  likes: { count: number }[];
  comments: { count: number }[];
  liked_by_me: boolean;
  saved_by_me: boolean;
  my_rating_value: number | null;
};

export type ProfileRating = Rating & { album: Album };
export type SavedAlbum = { album: Album; album_id: string; created_at: string; id: string; user_id: string };

export function useHomeFeed() {
  return useQuery({
    queryKey: queryKeys.home,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_home_feed', { page_size: 30 });
      if (error) throw error;
      return data as HomeFeedItem[];
    },
  });
}

export function useAlbum(albumId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.album(albumId ?? ''),
    enabled: Boolean(albumId && session),
    queryFn: async () => {
      const [albumResult, summaryResult, ratingsResult, savedResult] = await Promise.all([
        supabase.from('albums').select('*').eq('id', albumId!).single(),
        supabase.rpc('get_album_rating_summary', { target_album_id: albumId! }).single(),
        supabase.from('ratings').select('*').eq('album_id', albumId!).eq('user_id', session!.user.id)
          .order('created_at', { ascending: false }).order('id', { ascending: false }),
        supabase.from('listen_later_items').select('id').eq('album_id', albumId!).eq('user_id', session!.user.id).maybeSingle(),
      ]);
      if (albumResult.error) throw albumResult.error;
      if (summaryResult.error) throw summaryResult.error;
      if (ratingsResult.error) throw ratingsResult.error;
      if (savedResult.error) throw savedResult.error;
      return {
        album: albumResult.data,
        summary: summaryResult.data as AlbumRatingSummary,
        myRating: ratingsResult.data[0] ?? null,
        myRatings: ratingsResult.data,
        isSaved: Boolean(savedResult.data),
      };
    },
  });
}

export function useAlbumActivity(albumId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.albumActivity(albumId ?? ''),
    enabled: Boolean(albumId),
    queryFn: async () => {
      const { data, error } = await supabase.from('activity_events')
        .select('id, activity_type, album_id, created_at, actor:profiles!activity_events_actor_id_fkey(id, username, display_name, avatar_path), album:albums(*), rating:ratings(*), likes(count), comments(count)')
        .eq('album_id', albumId!).order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return enrichSocialActivities(data as unknown as SocialActivity[], session!.user.id);
    },
  });
}

export function useProfileOverview(username?: string) {
  return useQuery({
    queryKey: queryKeys.profile(username ?? ''),
    enabled: Boolean(username),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_profile_overview', { profile_username: username! }).maybeSingle();
      if (error) throw error;
      return data as ProfileOverview | null;
    },
  });
}

export function useProfileFeed(profileId?: string, enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.profileFeed(profileId ?? ''), enabled: Boolean(profileId && enabled),
    queryFn: async () => {
      const { data, error } = await supabase.from('activity_events')
        .select('id, activity_type, album_id, created_at, actor:profiles!activity_events_actor_id_fkey(id, username, display_name, avatar_path), album:albums(*), rating:ratings(*), likes(count), comments(count)')
        .eq('actor_id', profileId!).order('created_at', { ascending: false }).limit(30);
      if (error) throw error;
      return enrichSocialActivities(data as unknown as SocialActivity[], session!.user.id);
    },
  });
}

async function enrichSocialActivities(items: SocialActivity[], userId: string) {
  if (!items.length) return items;
  const albumIds = [...new Set(items.map((item) => item.album_id))];
  const [likesResult, savesResult, ratingsResult] = await Promise.all([
    supabase.from('likes').select('activity_event_id').eq('user_id', userId).in('activity_event_id', items.map((item) => item.id)),
    supabase.from('listen_later_items').select('album_id').eq('user_id', userId).in('album_id', albumIds),
    supabase.from('ratings').select('album_id, value, created_at, id').eq('user_id', userId).in('album_id', albumIds)
      .order('created_at', { ascending: false }).order('id', { ascending: false }),
  ]);
  if (likesResult.error) throw likesResult.error;
  if (savesResult.error) throw savesResult.error;
  if (ratingsResult.error) throw ratingsResult.error;
  const liked = new Set(likesResult.data.map((item) => item.activity_event_id));
  const saved = new Set(savesResult.data.map((item) => item.album_id));
  const ratings = new Map<string, number>();
  ratingsResult.data.forEach((item) => {
    if (!ratings.has(item.album_id)) ratings.set(item.album_id, item.value);
  });
  return items.map((item) => ({ ...item, liked_by_me: liked.has(item.id), saved_by_me: saved.has(item.album_id), my_rating_value: ratings.get(item.album_id) ?? null }));
}

export function useProfileRatings(profileId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.profileRatings(profileId ?? ''), enabled: Boolean(profileId && enabled),
    queryFn: async () => {
      const { data, error } = await supabase.from('ratings').select('*, album:albums(*)').eq('user_id', profileId!).order('updated_at', { ascending: false });
      if (error) throw error;
      return data as unknown as ProfileRating[];
    },
  });
}

export function useProfileSaved(profileId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.profileSaved(profileId ?? ''), enabled: Boolean(profileId && enabled),
    queryFn: async () => {
      const { data, error } = await supabase.from('listen_later_items').select('*, album:albums(*)').eq('user_id', profileId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as SavedAlbum[];
    },
  });
}

function useInvalidateSocial() {
  const client = useQueryClient();
  return async (albumId?: string) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.home }),
      client.invalidateQueries({ queryKey: ['profile'] }),
      client.invalidateQueries({ queryKey: ['profile-feed'] }),
      client.invalidateQueries({ queryKey: ['profile-ratings'] }),
      client.invalidateQueries({ queryKey: ['profile-saved'] }),
      ...(albumId ? [client.invalidateQueries({ queryKey: queryKeys.album(albumId) }), client.invalidateQueries({ queryKey: queryKeys.albumActivity(albumId) })] : []),
    ]);
  };
}

export function useFollowMutation() {
  const { session } = useAuth();
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: async ({ targetId, following }: { targetId: string; following: boolean }) => {
      if (!session) throw new Error('Sign in required.');
      const result = following
        ? await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('followed_id', targetId)
        : await supabase.from('follows').insert({ follower_id: session.user.id, followed_id: targetId });
      if (result.error) throw result.error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useRatingMutation() {
  const { session } = useAuth();
  const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: async ({ albumId, note, value }: { albumId: string; note?: string | null; value: number }) => {
      if (!session) throw new Error('Sign in required.');
      const { error } = await supabase.from('ratings').insert({
        album_id: albumId, user_id: session.user.id, value, note: note?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => invalidate(variables.albumId),
  });
}

export function useDeleteRatingMutation() {
  const { session } = useAuth(); const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: async ({ albumId, ratingId }: { albumId: string; ratingId: string }) => {
      if (!session) throw new Error('Sign in required.');
      const { error } = await supabase.from('ratings').delete().eq('id', ratingId).eq('user_id', session.user.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => invalidate(variables.albumId),
  });
}

export function useListenLaterMutation() {
  const { session } = useAuth(); const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: async ({ albumId, saved }: { albumId: string; saved: boolean }) => {
      if (!session) throw new Error('Sign in required.');
      const result = saved
        ? await supabase.from('listen_later_items').delete().eq('album_id', albumId).eq('user_id', session.user.id)
        : await supabase.from('listen_later_items').insert({ album_id: albumId, user_id: session.user.id });
      if (result.error) throw result.error;
    },
    onSuccess: (_data, variables) => invalidate(variables.albumId),
  });
}

export function useLikeMutation() {
  const { session } = useAuth(); const invalidate = useInvalidateSocial();
  return useMutation({
    mutationFn: async ({ activityId, liked }: { activityId: string; liked: boolean }) => {
      if (!session) throw new Error('Sign in required.');
      const result = liked
        ? await supabase.from('likes').delete().eq('activity_event_id', activityId).eq('user_id', session.user.id)
        : await supabase.from('likes').insert({ activity_event_id: activityId, user_id: session.user.id });
      if (result.error) throw result.error;
    },
    onSuccess: () => invalidate(),
  });
}
