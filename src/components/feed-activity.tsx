import { Image, type ImageSource } from 'expo-image';
import type { Icon, IconWeight } from 'phosphor-react-native';
import { BookmarkSimpleIcon } from 'phosphor-react-native/src/icons/BookmarkSimple';
import { ChatCircleIcon } from 'phosphor-react-native/src/icons/ChatCircle';
import { DotsThreeIcon } from 'phosphor-react-native/src/icons/DotsThree';
import { HeartIcon } from 'phosphor-react-native/src/icons/Heart';
import { PlusCircleIcon } from 'phosphor-react-native/src/icons/PlusCircle';
import { RepeatIcon } from 'phosphor-react-native/src/icons/Repeat';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Palette, PressedOpacity } from '@/constants/theme';

import { ExpandableNote } from './expandable-note';
import { MarqueeText } from './marquee-text';
import { DiscTone, RatingDisc } from './rating-disc';

export type PostActionsData = {
  onRate?: () => void;
  rateLabel: 'Rate it' | 'Rate again';
  save?: {
    initiallySaved: boolean;
    onToggle?: (saved: boolean) => void;
  };
};

type PostBaseData = {
  action: string;
  album: string;
  artist: string;
  avatar?: ImageSource | string;
  comments: number;
  initial: string;
  initiallyLiked?: boolean;
  likes: number;
  onLike?: (liked: boolean) => void;
  onOpenAlbum?: () => void;
  onOpenComments?: () => void;
  time: string;
  user: string;
};

type FeedPresentation = {
  actions: PostActionsData;
  context: 'feed';
  cover: ImageSource | string;
};

type AlbumRatingPresentation = {
  actions?: PostActionsData;
  context: 'album';
  pinned: boolean;
};

export type RatingPostData = PostBaseData & {
  kind: 'rating';
  listenNumber?: number;
  note?: string;
  onMenu?: () => void;
  rating: number;
  ratingTone: DiscTone;
} & (FeedPresentation | AlbumRatingPresentation);

export type SavedPostData = PostBaseData & {
  kind: 'saved';
} & (FeedPresentation | { context: 'album' });

export type FeedPostData = RatingPostData | SavedPostData;

export function RatingPost({ post }: { post: RatingPostData }) {
  const pinned = post.context === 'album' && post.pinned;

  return (
    <PostSurface pinned={pinned}>
      <PostHeader
        action={post.action}
        avatar={post.avatar}
        initial={post.initial}
        listenNumber={post.listenNumber}
        onMenu={post.onMenu}
        user={post.user}
      />
      <AlbumSummary
        actions={post.actions}
        album={post.album}
        artist={post.artist}
        context={post.context}
        cover={post.context === 'feed' ? post.cover : undefined}
        coverSize={96}
        onOpenAlbum={post.onOpenAlbum}
        rating={post.rating}
        ratingTone={post.ratingTone}
      />
      {post.note && (
        <View style={post.context === 'feed' ? styles.feedNoteWrap : styles.albumNoteWrap}>
          <ExpandableNote note={post.note} style={styles.note} />
        </View>
      )}
      <EngagementFooter
        album={post.album}
        comments={post.comments}
        initiallyLiked={post.initiallyLiked}
        likes={post.likes}
        onLike={post.onLike}
        onOpenComments={post.onOpenComments}
        time={post.time}
      />
      {!pinned && <PostDivider />}
    </PostSurface>
  );
}

export function SavedPost({ post }: { post: SavedPostData }) {
  return (
    <PostSurface>
      <PostHeader
        action={post.action}
        avatar={post.avatar}
        initial={post.initial}
        user={post.user}
      />
      <AlbumSummary
        actions={post.context === 'feed' ? post.actions : undefined}
        album={post.album}
        artist={post.artist}
        context={post.context}
        cover={post.context === 'feed' ? post.cover : undefined}
        coverSize={64}
        onOpenAlbum={post.onOpenAlbum}
      />
      <EngagementFooter
        album={post.album}
        comments={post.comments}
        initiallyLiked={post.initiallyLiked}
        likes={post.likes}
        onLike={post.onLike}
        onOpenComments={post.onOpenComments}
        time={post.time}
      />
      <PostDivider />
    </PostSurface>
  );
}

function PostSurface({ children, pinned = false }: { children: ReactNode; pinned?: boolean }) {
  return <View style={[styles.activity, pinned && styles.pinnedActivity]}>{children}</View>;
}

function PostHeader({
  action,
  avatar,
  initial,
  listenNumber,
  onMenu,
  user,
}: Pick<PostBaseData, 'action' | 'avatar' | 'initial' | 'user'> & {
  listenNumber?: number;
  onMenu?: () => void;
}) {
  return (
    <View style={styles.activityHeader}>
      {avatar ? (
        <Image source={avatar} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}
      <View style={styles.activityCopy}>
        <Text numberOfLines={1} style={styles.activityText}>
          <Text style={styles.activityUser}>{user} </Text>
          {action}
        </Text>
        {listenNumber !== undefined && listenNumber > 1 && (
          <View style={styles.listenRow}>
            <RepeatIcon color={Palette.muted} size={12} weight="regular" />
            <Text style={styles.listenText}>{listenLabel(listenNumber)}</Text>
          </View>
        )}
      </View>
      {onMenu && (
        <Pressable
          accessibilityLabel="Rating options"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onMenu}
          style={({ pressed }) => pressed && styles.pressed}>
          <DotsThreeIcon color={Palette.muted} size={16} weight="bold" />
        </Pressable>
      )}
    </View>
  );
}

function AlbumSummary({
  actions,
  album,
  artist,
  context,
  cover,
  coverSize,
  onOpenAlbum,
  rating,
  ratingTone,
}: {
  actions?: PostActionsData;
  album: string;
  artist: string;
  context: 'feed' | 'album';
  cover?: ImageSource | string;
  coverSize: 64 | 96;
  onOpenAlbum?: () => void;
  rating?: number;
  ratingTone?: DiscTone;
}) {
  const compact = context === 'album';

  return (
    <View style={[styles.albumRow, !compact && { height: coverSize }]}>
      {!compact && cover && (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenAlbum}
          style={({ pressed }) => pressed && styles.pressed}>
          <Image source={cover} style={[styles.cover, { width: coverSize, height: coverSize }]} />
        </Pressable>
      )}
      <View style={[styles.albumDetails, compact && styles.compactAlbumDetails]}>
        <View>
          {compact ? (
            <Text numberOfLines={1} style={styles.artist}>{artist}</Text>
          ) : (
            <MarqueeText style={styles.artist} text={artist} />
          )}
          {!compact && onOpenAlbum ? (
            <Pressable
              accessibilityLabel={`Open ${album}`}
              accessibilityRole="link"
              onPress={onOpenAlbum}
              style={({ pressed }) => pressed && styles.pressed}>
              <MarqueeText style={styles.albumTitle} text={album} />
            </Pressable>
          ) : compact ? (
            <Text numberOfLines={1} style={styles.albumTitle}>{album}</Text>
          ) : (
            <MarqueeText style={styles.albumTitle} text={album} />
          )}
          {rating !== undefined && (
            <View
              accessibilityLabel={`${rating} out of 5`}
              accessibilityRole="text"
              style={styles.ratingRow}>
              <DiscRating rating={rating} tone={ratingTone ?? 'gold'} />
            </View>
          )}
        </View>
        {actions && <PostActions actions={actions} />}
      </View>
    </View>
  );
}

function PostActions({ actions }: { actions: PostActionsData }) {
  const [saved, setSaved] = useState(Boolean(actions.save?.initiallySaved));

  return (
    <View style={styles.actionRow}>
      <Action icon={PlusCircleIcon} label={actions.rateLabel} onPress={actions.onRate} />
      {actions.save && (
        <Action
          icon={BookmarkSimpleIcon}
          iconColor={saved ? Palette.brand : Palette.ink}
          iconWeight={saved ? 'fill' : 'regular'}
          label={saved ? 'Saved' : 'Listen later'}
          onPress={() => setSaved((value) => {
            actions.save?.onToggle?.(!value);
            return !value;
          })}
        />
      )}
    </View>
  );
}

function EngagementFooter({
  album,
  comments,
  initiallyLiked,
  likes,
  onLike,
  onOpenComments,
  time,
}: Pick<PostBaseData, 'album' | 'comments' | 'initiallyLiked' | 'likes' | 'onLike' | 'onOpenComments' | 'time'>) {
  const [liked, setLiked] = useState(Boolean(initiallyLiked));
  const likeCount = likes + (liked === Boolean(initiallyLiked) ? 0 : liked ? 1 : -1);

  return (
    <View style={styles.metaRow}>
      <View style={styles.engagementRow}>
        <Pressable
          accessibilityLabel={`${liked ? 'Unlike' : 'Like'} ${album}`}
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => setLiked((value) => {
            onLike?.(!value);
            return !value;
          })}
          style={({ pressed }) => [styles.engagementItem, pressed && styles.pressed]}>
          <HeartIcon
            color={liked ? Palette.liked : Palette.ink}
            size={14}
            weight={liked ? 'fill' : 'regular'}
          />
          <Text style={styles.metaText}>{likeCount}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`${comments} comments on ${album}`}
          accessibilityRole="button"
          hitSlop={12}
          onPress={onOpenComments}
          style={({ pressed }) => [styles.engagementItem, pressed && styles.pressed]}>
          <ChatCircleIcon color={Palette.ink} size={13} weight="regular" />
          <Text style={styles.metaText}>{comments}</Text>
        </Pressable>
      </View>
      <Text style={styles.timestamp}>{time}</Text>
    </View>
  );
}

function PostDivider() {
  return (
    <View style={styles.dividerWrap}>
      <View style={styles.divider} />
    </View>
  );
}

export function listenLabel(value: number) {
  const listenNumber = Math.max(1, Math.trunc(value));
  const lastTwoDigits = listenNumber % 100;
  const suffix = lastTwoDigits >= 11 && lastTwoDigits <= 13
    ? 'th'
    : listenNumber % 10 === 1
      ? 'st'
      : listenNumber % 10 === 2
        ? 'nd'
        : listenNumber % 10 === 3
          ? 'rd'
          : 'th';
  return `${listenNumber}${suffix} listen`;
}

function DiscRating({ rating, tone }: { rating: number; tone: DiscTone }) {
  const fullDiscs = Math.floor(rating);
  const hasHalf = rating % 1 !== 0;

  return (
    <>
      {Array.from({ length: fullDiscs }, (_, index) => (
        <RatingDisc key={`full-${index}`} tone={tone} />
      ))}
      {hasHalf && <RatingDisc fill="half" tone={tone} />}
    </>
  );
}

function Action({
  icon: IconComponent,
  iconColor = Palette.ink,
  iconWeight = 'regular',
  label,
  onPress,
}: {
  icon: Icon;
  iconColor?: string;
  iconWeight?: IconWeight;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <IconComponent color={iconColor} size={12} weight={iconWeight} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  activity: {
    width: '100%',
  },
  pinnedActivity: {
    marginBottom: 24,
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: Palette.canvas,
  },
  activityHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  activityCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.border,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarInitial: {
    color: Palette.muted,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 17,
  },
  activityText: {
    color: Palette.brand,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 19,
  },
  activityUser: {
    fontFamily: Fonts.semibold,
  },
  listenRow: {
    height: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listenText: {
    color: Palette.muted,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: -0.25,
  },
  albumRow: {
    width: '100%',
    flexDirection: 'row',
  },
  cover: {
    borderWidth: 1,
    borderColor: Palette.border,
  },
  albumDetails: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 4,
    justifyContent: 'space-between',
  },
  compactAlbumDetails: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 8,
  },
  artist: {
    color: Palette.muted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 15,
  },
  albumTitle: {
    color: Palette.ink,
    fontFamily: Fonts.semibold,
    fontSize: 20,
    lineHeight: 24,
  },
  ratingRow: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  actionRow: {
    minHeight: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: Palette.ink,
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 15,
  },
  feedNoteWrap: {
    paddingTop: 16,
  },
  albumNoteWrap: {
    paddingTop: 8,
  },
  note: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 15,
  },
  metaRow: {
    minHeight: 31,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: Palette.ink,
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
  },
  timestamp: {
    color: Palette.muted,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 12,
  },
  dividerWrap: {
    height: 32,
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Palette.border,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
