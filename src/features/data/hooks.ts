import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import type { Album, AlbumRatingSummary, Comment, HomeFeedItem, Profile, ProfileOverview, Rating } from '@/types/domain';

const LISTEN_LATER_ACTIVITY_DELAY_MS = 5_000;

export const queryKeys = {
  home: ['home-feed'] as const,
  comments: (activityId: string) => ['activity-comments', activityId] as const,
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
  comments_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
  my_rating_value: number | null;
  rating_listen_number: number | null;
};

export type ProfileRating = Rating & { album: Album };
export type SavedAlbum = { album: Album; album_id: string; created_at: string; id: string; user_id: string };
export type ActivityComment = Comment & {
  author: Pick<Profile, 'avatar_path' | 'display_name' | 'id' | 'username'>;
  liked_by_me: boolean;
  likes_count: number;
};

export type ActivityComments = {
  activityAuthorId: string;
  items: ActivityComment[];
};

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

export function useActivityComments(activityId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.comments(activityId ?? ''),
    enabled: Boolean(activityId && session),
    queryFn: async () => {
      const [eventResult, commentsResult] = await Promise.all([
        supabase.from('activity_events').select('actor_id').eq('id', activityId!).maybeSingle(),
        supabase.from('comments')
          .select('id, user_id, activity_event_id, parent_comment_id, body, created_at, updated_at, author:profiles!comments_user_id_fkey(id, username, display_name, avatar_path), comment_likes(count)')
          .eq('activity_event_id', activityId!)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }),
      ]);
      if (eventResult.error) throw eventResult.error;
      if (!eventResult.data) throw new Error('This activity is no longer available.');
      if (commentsResult.error) throw commentsResult.error;

      type CommentQueryRow = Comment & {
        author: Pick<Profile, 'avatar_path' | 'display_name' | 'id' | 'username'>;
        comment_likes: { count: number }[];
      };
      const rows = commentsResult.data as unknown as CommentQueryRow[];
      const commentIds = rows.map((comment) => comment.id);
      const myLikesResult = commentIds.length
        ? await supabase.from('comment_likes').select('comment_id')
          .eq('user_id', session!.user.id).in('comment_id', commentIds)
        : { data: [], error: null };
      if (myLikesResult.error) throw myLikesResult.error;
      const likedCommentIds = new Set(myLikesResult.data.map((like) => like.comment_id));

      return {
        activityAuthorId: eventResult.data.actor_id,
        items: rows.map(({ comment_likes: commentLikes, ...comment }) => ({
          ...comment,
          liked_by_me: likedCommentIds.has(comment.id),
          likes_count: commentLikes[0]?.count ?? 0,
        })),
      } satisfies ActivityComments;
    },
  });
}

export function useCreateCommentMutation(activityId: string) {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, parentCommentId }: { body: string; parentCommentId?: string | null }) => {
      if (!session) throw new Error('Sign in required.');
      const { data, error } = await supabase.from('comments').insert({
        activity_event_id: activityId,
        body: body.trim(),
        parent_comment_id: parentCommentId ?? null,
        user_id: session.user.id,
      }).select('id, parent_comment_id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.comments(activityId) }),
      client.invalidateQueries({ queryKey: queryKeys.home }),
      client.invalidateQueries({ queryKey: ['profile-feed'] }),
      client.invalidateQueries({ queryKey: ['album-activity'] }),
    ]),
  });
}

export function useCommentLikeMutation(activityId: string) {
  const { session } = useAuth();
  const client = useQueryClient();
  const key = queryKeys.comments(activityId);
  return useMutation({
    mutationFn: async ({ commentId, shouldLike }: { commentId: string; shouldLike: boolean }) => {
      if (!session) throw new Error('Sign in required.');
      const result = shouldLike
        ? await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: session.user.id })
        : await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', session.user.id);
      if (result.error) throw result.error;
    },
    onMutate: async ({ commentId, shouldLike }) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<ActivityComments>(key);
      client.setQueryData<ActivityComments>(key, (current) => current ? {
        ...current,
        items: current.items.map((comment) => comment.id === commentId ? {
          ...comment,
          liked_by_me: shouldLike,
          likes_count: Math.max(0, comment.likes_count + (shouldLike ? 1 : -1)),
        } : comment),
      } : current);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
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

export function useAlbumActivity(albumId?: string, pinnedRatingId?: string | null, enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.albumActivity(albumId ?? ''), pinnedRatingId ?? null],
    enabled: Boolean(albumId && session && enabled),
    queryFn: async () => {
      const select = 'id, activity_type, album_id, created_at, actor:profiles!activity_events_actor_id_fkey(id, username, display_name, avatar_path), album:albums(*), rating:ratings(*), likes(count)';
      const feedPromise = supabase.from('activity_events')
        .select(select)
        .eq('album_id', albumId!)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(20);
      const pinnedPromise = pinnedRatingId
        ? supabase.from('activity_events').select(select).eq('rating_id', pinnedRatingId).maybeSingle()
        : Promise.resolve({ data: null, error: null });
      const [feedResult, pinnedResult] = await Promise.all([feedPromise, pinnedPromise]);
      if (feedResult.error) throw feedResult.error;
      if (pinnedResult.error) throw pinnedResult.error;
      const items = feedResult.data as unknown as SocialActivity[];
      const pinnedItem = pinnedResult.data as unknown as SocialActivity | null;
      if (pinnedItem && !items.some((item) => item.id === pinnedItem.id)) items.push(pinnedItem);
      return enrichSocialActivities(items, session!.user.id);
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
        .select('id, activity_type, album_id, created_at, actor:profiles!activity_events_actor_id_fkey(id, username, display_name, avatar_path), album:albums(*), rating:ratings(*), likes(count)')
        .eq('actor_id', profileId!).order('created_at', { ascending: false }).limit(30);
      if (error) throw error;
      return enrichSocialActivities(data as unknown as SocialActivity[], session!.user.id);
    },
  });
}

async function enrichSocialActivities(items: SocialActivity[], userId: string) {
  if (!items.length) return items;
  const albumIds = [...new Set(items.map((item) => item.album_id))];
  const ratingIds = items.flatMap((item) => item.rating ? [item.rating.id] : []);
  const listenNumbersPromise = ratingIds.length
    ? supabase.from('rating_listen_numbers').select('rating_id, listen_number').in('rating_id', ratingIds)
    : Promise.resolve({ data: [], error: null });
  const commentsPromise = supabase.from('comments').select('activity_event_id')
    .in('activity_event_id', items.map((item) => item.id));
  const [likesResult, savesResult, ratingsResult, listenNumbersResult, commentsResult] = await Promise.all([
    supabase.from('likes').select('activity_event_id').eq('user_id', userId).in('activity_event_id', items.map((item) => item.id)),
    supabase.from('listen_later_items').select('album_id').eq('user_id', userId).in('album_id', albumIds),
    supabase.from('ratings').select('album_id, value, created_at, id').eq('user_id', userId).in('album_id', albumIds)
      .order('created_at', { ascending: false }).order('id', { ascending: false }),
    listenNumbersPromise,
    commentsPromise,
  ]);
  if (likesResult.error) throw likesResult.error;
  if (savesResult.error) throw savesResult.error;
  if (ratingsResult.error) throw ratingsResult.error;
  if (listenNumbersResult.error) throw listenNumbersResult.error;
  if (commentsResult.error) throw commentsResult.error;
  const liked = new Set(likesResult.data.map((item) => item.activity_event_id));
  const saved = new Set(savesResult.data.map((item) => item.album_id));
  const ratings = new Map<string, number>();
  const listenNumbers = new Map(listenNumbersResult.data.map((item) => [item.rating_id, item.listen_number]));
  const commentCounts = new Map<string, number>();
  commentsResult.data.forEach((comment) => {
    commentCounts.set(comment.activity_event_id, (commentCounts.get(comment.activity_event_id) ?? 0) + 1);
  });
  ratingsResult.data.forEach((item) => {
    if (!ratings.has(item.album_id)) ratings.set(item.album_id, item.value);
  });
  return items.map((item) => ({
    ...item,
    liked_by_me: liked.has(item.id),
    saved_by_me: saved.has(item.album_id),
    my_rating_value: ratings.get(item.album_id) ?? null,
    rating_listen_number: item.rating ? listenNumbers.get(item.rating.id) ?? null : null,
    comments_count: commentCounts.get(item.id) ?? 0,
  }));
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

function useInvalidateActivityFeeds() {
  const client = useQueryClient();
  return async (albumId: string) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.home }),
      client.invalidateQueries({ queryKey: ['profile-feed'] }),
      client.invalidateQueries({ queryKey: queryKeys.albumActivity(albumId) }),
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
  const invalidateActivityFeeds = useInvalidateActivityFeeds();
  return useMutation({
    mutationFn: async ({ albumId, shouldSave }: { albumId: string; shouldSave: boolean }) => {
      if (!session) throw new Error('Sign in required.');
      const result = shouldSave
        ? await supabase.from('listen_later_items').insert({ album_id: albumId, user_id: session.user.id })
        : await supabase.from('listen_later_items').delete().eq('album_id', albumId).eq('user_id', session.user.id);
      if (result.error) throw result.error;
    },
    onSuccess: (_data, variables) => {
      if (variables.shouldSave) {
        setTimeout(() => {
          void invalidateActivityFeeds(variables.albumId);
        }, LISTEN_LATER_ACTIVITY_DELAY_MS);
      }
      return invalidate(variables.albumId);
    },
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
