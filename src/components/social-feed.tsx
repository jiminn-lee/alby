import { router } from 'expo-router';
import { Alert } from 'react-native';

import {
  useDeleteRatingMutation,
  useLikeMutation,
  useListenLaterMutation,
  type DeleteRatingTarget,
  type SocialActivity,
} from '@/features/data/hooks';
import { getMediaUrl } from '@/lib/media';
import { useAuth } from '@/providers/auth-provider';
import type { HomeFeedItem } from '@/types/domain';

import {
  RatingPost,
  SavedPost,
  type PostActionsData,
  type RatingPostData,
  type SavedPostData,
} from './feed-activity';

export function HomeFeed({ items }: { items: HomeFeedItem[] }) {
  const like = useLikeMutation();
  const listenLater = useListenLaterMutation();
  const confirmDeleteRating = useConfirmDeleteRating();
  const { session } = useAuth();

  return <>{items.map((item) => {
    const isOwnActivity = item.actor_id === session?.user.id;
    const onOpenAlbum = () => router.push({ pathname: '/albums/[albumId]', params: { albumId: item.album_id } });
    const onRate = () => router.push({ pathname: '/albums/[albumId]/rate', params: { albumId: item.album_id } });
    const onOpenComments = () => router.push({ pathname: '/comments/[activityId]', params: { activityId: item.id } });
    const actions: PostActionsData = {
      onRate,
      rateLabel: item.my_rating_value == null ? 'Rate it' : 'Rate again',
      save: item.my_rating_value == null ? {
        initiallySaved: item.saved_by_me,
        onToggle: (shouldSave) => listenLater.mutate({ albumId: item.album_id, shouldSave }),
      } : undefined,
    };
    const common = {
      action: actionLabel(item.activity_type, item.rating_value),
      album: item.album_title,
      artist: item.artist_name,
      avatar: getMediaUrl(item.actor_avatar_path) ?? undefined,
      comments: item.comments_count,
      initial: (item.actor_display_name || item.actor_username || '?')[0].toUpperCase(),
      initiallyLiked: item.liked_by_me,
      likes: item.likes_count,
      onLike: (liked: boolean) => like.mutate({ activityId: item.id, liked: !liked }),
      onOpenComments,
      onOpenAlbum,
      time: relativeTime(item.created_at),
      user: isOwnActivity ? 'You' : item.actor_display_name || item.actor_username || 'Alby user',
    };

    if (item.rating_value != null) {
      const post: RatingPostData = {
        ...common,
        actions,
        context: 'feed',
        cover: getMediaUrl(item.cover_path) ?? '',
        kind: 'rating',
        listenNumber: item.rating_listen_number ?? undefined,
        menu: isOwnActivity ? {
          onDelete: () => confirmDeleteRating({ activityId: item.id, albumId: item.album_id }),
        } : undefined,
        note: item.rating_note ?? undefined,
        rating: item.rating_value,
        ratingTone: tone(item.rating_value),
      };
      return <RatingPost key={item.id} post={post} />;
    }

    const post: SavedPostData = {
      ...common,
      actions,
      context: 'feed',
      cover: getMediaUrl(item.cover_path) ?? '',
      kind: 'saved',
    };
    return <SavedPost key={item.id} post={post} />;
  })}</>;
}

export function ActivityFeed({ albumDetail = false, items, pinnedRatingId }: {
  albumDetail?: boolean;
  items: SocialActivity[];
  pinnedRatingId?: string;
}) {
  const like = useLikeMutation();
  const listenLater = useListenLaterMutation();
  const confirmDeleteRating = useConfirmDeleteRating();
  const { session } = useAuth();
  const chronologicalItems = albumDetail ? [...items].sort((a, b) => (
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id.localeCompare(a.id)
  )) : items;
  const pinnedItem = albumDetail && pinnedRatingId ? chronologicalItems.find((item) => (
    item.actor.id === session?.user.id && item.rating?.id === pinnedRatingId
  )) : undefined;
  const orderedItems = pinnedItem
    ? [pinnedItem, ...chronologicalItems.filter((item) => item.id !== pinnedItem.id)]
    : chronologicalItems;

  return <>{orderedItems.map((item) => {
    const isOwnActivity = item.actor.id === session?.user.id;
    const isOwnRating = isOwnActivity && Boolean(item.rating);
    const pinned = item.id === pinnedItem?.id;
    const onOpenAlbum = albumDetail ? undefined : () => router.push({ pathname: '/albums/[albumId]', params: { albumId: item.album_id } });
    const onRate = () => router.push({ pathname: '/albums/[albumId]/rate', params: { albumId: item.album_id } });
    const onOpenComments = () => router.push({ pathname: '/comments/[activityId]', params: { activityId: item.id } });
    const feedActions: PostActionsData = {
      onRate,
      rateLabel: item.my_rating_value == null ? 'Rate it' : 'Rate again',
      save: item.my_rating_value == null ? {
        initiallySaved: item.saved_by_me,
        onToggle: (shouldSave) => listenLater.mutate({ albumId: item.album_id, shouldSave }),
      } : undefined,
    };
    const common = {
      action: actionLabel(item.activity_type, item.rating?.value),
      album: item.album.title,
      artist: item.album.artist_name,
      avatar: getMediaUrl(item.actor.avatar_path) ?? undefined,
      comments: item.comments_count,
      initial: (item.actor.display_name || item.actor.username || '?')[0].toUpperCase(),
      initiallyLiked: item.liked_by_me,
      likes: item.likes[0]?.count ?? 0,
      onLike: (liked: boolean) => like.mutate({ activityId: item.id, liked: !liked }),
      onOpenComments,
      onOpenAlbum,
      time: relativeTime(item.created_at),
      user: isOwnActivity ? 'You' : item.actor.display_name || item.actor.username || 'Alby user',
    };

    if (item.rating) {
      const ratingData = {
        ...common,
        kind: 'rating' as const,
        listenNumber: item.rating_listen_number ?? undefined,
        menu: isOwnRating ? {
          onDelete: () => confirmDeleteRating({ albumId: item.album_id, ratingId: item.rating!.id }),
        } : undefined,
        note: item.rating.note ?? undefined,
        rating: item.rating.value,
        ratingTone: tone(item.rating.value),
      };
      const post: RatingPostData = albumDetail ? {
        ...ratingData,
        actions: isOwnRating && !pinned ? { onRate, rateLabel: 'Rate again' } : undefined,
        context: 'album',
        pinned,
      } : {
        ...ratingData,
        actions: feedActions,
        context: 'feed',
        cover: getMediaUrl(item.album.cover_path) ?? '',
      };
      return <RatingPost key={item.id} post={post} />;
    }

    const savedData = {
      ...common,
      kind: 'saved' as const,
    };
    const post: SavedPostData = albumDetail ? {
      ...savedData,
      context: 'album',
    } : {
      ...savedData,
      actions: feedActions,
      context: 'feed',
      cover: getMediaUrl(item.album.cover_path) ?? '',
    };
    return <SavedPost key={item.id} post={post} />;
  })}</>;
}

function useConfirmDeleteRating() {
  const removeRating = useDeleteRatingMutation();

  return (target: DeleteRatingTarget) => Alert.alert(
    'Delete rating?',
    'This removes this rating and its activity. An older rating will become your current rating if one exists.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeRating.mutate(target, {
          onError: (error) => Alert.alert('Couldn’t delete rating', error.message || 'Please try again.'),
        }),
      },
    ],
  );
}

function actionLabel(type: string, value?: number | null) {
  if (type === 'listen_later_added') return 'saved for later...';
  if ((value ?? 0) >= 4) return 'really liked...';
  if ((value ?? 0) >= 2.5) return 'enjoyed...';
  return 'struggled with...';
}

function tone(value?: number | null): 'gold' | 'silver' | 'copper' {
  return (value ?? 0) >= 3.5 ? 'gold' : (value ?? 0) >= 2.5 ? 'silver' : 'copper';
}

export function relativeTime(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
