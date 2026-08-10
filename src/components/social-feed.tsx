import { router } from 'expo-router';

import { useLikeMutation, useListenLaterMutation, type SocialActivity } from '@/features/data/hooks';
import { getMediaUrl } from '@/lib/media';
import { useAuth } from '@/providers/auth-provider';
import type { HomeFeedItem } from '@/types/domain';

import { FeedActivity, type FeedActivityData } from './feed-activity';

export function HomeFeed({ items }: { items: HomeFeedItem[] }) {
  const like = useLikeMutation(); const listenLater = useListenLaterMutation();
  return <>{items.map((item) => {
    const data: FeedActivityData = {
      action: actionLabel(item.activity_type, item.rating_value), album: item.album_title, artist: item.artist_name,
      avatar: getMediaUrl(item.actor_avatar_path) ?? undefined, comments: item.comments_count, cover: getMediaUrl(item.cover_path) ?? '',
      coverSize: item.activity_type === 'listen_later_added' ? 64 : 96,
      initial: (item.actor_display_name || item.actor_username || '?')[0].toUpperCase(), initiallyLiked: item.liked_by_me,
      initiallySaved: item.saved_by_me, likes: item.likes_count, note: item.rating_note ?? undefined,
      linkAlbumTitle: true,
      rateActionLabel: item.my_rating_value == null ? 'Rate it' : 'Rate again', rating: item.rating_value ?? undefined,
      ratingTone: tone(item.rating_value), secondaryAction: item.my_rating_value == null ? item.saved_by_me ? 'Saved' : 'Listen later' : undefined, time: relativeTime(item.created_at),
      user: item.actor_id ? (item.actor_display_name || item.actor_username || 'Alby user') : 'Alby user',
      onLike: (liked) => like.mutate({ activityId: item.id, liked: !liked }),
      onSave: item.my_rating_value == null ? (saved) => listenLater.mutate({ albumId: item.album_id, saved: !saved }) : undefined,
      onOpenAlbum: () => router.push({ pathname: '/albums/[albumId]', params: { albumId: item.album_id } }),
      onRate: () => router.push({ pathname: '/albums/[albumId]/rate', params: { albumId: item.album_id } }),
    };
    return <FeedActivity activity={data} key={item.id} />;
  })}</>;
}

export function ActivityFeed({ albumDetail = false, items, onDeleteRating }: {
  albumDetail?: boolean;
  items: SocialActivity[];
  onDeleteRating?: (ratingId: string) => void;
}) {
  const like = useLikeMutation(); const listenLater = useListenLaterMutation();
  const { session } = useAuth();
  const orderedItems = albumDetail ? [...items].sort((a, b) => {
    const aOwn = a.actor.id === session?.user.id ? 1 : 0;
    const bOwn = b.actor.id === session?.user.id ? 1 : 0;
    return bOwn - aOwn || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }) : items;
  return <>{orderedItems.map((item) => {
    const isOwnRating = item.actor.id === session?.user.id && Boolean(item.rating);
    return <FeedActivity key={item.id} activity={{
    action: actionLabel(item.activity_type, item.rating?.value), album: item.album.title, artist: item.album.artist_name,
    avatar: getMediaUrl(item.actor.avatar_path) ?? undefined, comments: item.comments[0]?.count ?? 0,
    cover: getMediaUrl(item.album.cover_path) ?? '', initial: (item.actor.display_name || item.actor.username || '?')[0].toUpperCase(),
    coverSize: item.activity_type === 'listen_later_added' ? 64 : 96,
    initiallyLiked: item.liked_by_me, initiallySaved: item.saved_by_me,
    linkAlbumTitle: !albumDetail,
    likes: item.likes[0]?.count ?? 0, note: item.rating?.note ?? undefined, rateActionLabel: item.my_rating_value == null ? 'Rate it' : 'Rate again',
    hideCover: albumDetail, rating: item.rating?.value, ratingTone: tone(item.rating?.value),
    hideActions: albumDetail,
    secondaryAction: item.my_rating_value == null ? item.saved_by_me ? 'Saved' : 'Listen later' : undefined,
    time: relativeTime(item.created_at), user: item.actor.display_name || item.actor.username || 'Alby user',
    onLike: (liked) => like.mutate({ activityId: item.id, liked: !liked }),
    onSave: item.my_rating_value == null ? (saved) => listenLater.mutate({ albumId: item.album_id, saved: !saved }) : undefined,
    onOpenAlbum: albumDetail ? undefined : () => router.push({ pathname: '/albums/[albumId]', params: { albumId: item.album_id } }),
    onMenu: isOwnRating && item.rating ? () => onDeleteRating?.(item.rating!.id) : undefined,
    onRate: () => router.push({ pathname: '/albums/[albumId]/rate', params: { albumId: item.album_id } }),
  }} />;
  })}</>;
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
