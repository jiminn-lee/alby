import { Image, type ImageSource } from 'expo-image';
import { BookmarkSimpleIcon } from 'phosphor-react-native/src/icons/BookmarkSimple';
import { ChatCircleIcon } from 'phosphor-react-native/src/icons/ChatCircle';
import { HeartIcon } from 'phosphor-react-native/src/icons/Heart';
import { PlusCircleIcon } from 'phosphor-react-native/src/icons/PlusCircle';
import { DotsThreeIcon } from 'phosphor-react-native/src/icons/DotsThree';
import type { Icon, IconWeight } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Palette, PressedOpacity } from '@/constants/theme';

import { ExpandableNote } from './expandable-note';
import { DiscTone, RatingDisc } from './rating-disc';

export type FeedActivityData = {
  action: string;
  album: string;
  artist: string;
  avatar?: ImageSource | string;
  comments: number;
  cover: ImageSource | string;
  coverSize?: 64 | 96;
  initial: string;
  initiallyLiked?: boolean;
  initiallySaved?: boolean;
  hideCover?: boolean;
  hideActions?: boolean;
  linkAlbumTitle?: boolean;
  likes: number;
  note?: string;
  rateActionLabel: 'Rate it' | 'Rate again';
  rating?: number;
  ratingTone?: DiscTone;
  secondaryAction?: 'Listen later' | 'Saved';
  time: string;
  user: string;
  onLike?: (liked: boolean) => void;
  onMenu?: () => void;
  onOpenAlbum?: () => void;
  onRate?: () => void;
  onSave?: (saved: boolean) => void;
};

type FeedActivityProps = {
  activity: FeedActivityData;
};

export function FeedActivity({ activity }: FeedActivityProps) {
  const [liked, setLiked] = useState(Boolean(activity.initiallyLiked));
  const [saved, setSaved] = useState(Boolean(activity.initiallySaved));
  const coverSize = activity.coverSize ?? 96;
  const likeCount = activity.likes + (liked === Boolean(activity.initiallyLiked) ? 0 : liked ? 1 : -1);

  return (
    <View style={styles.activity}>
      <View style={styles.activityHeader}>
        {activity.avatar ? (
          <Image source={activity.avatar} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{activity.initial}</Text>
          </View>
        )}
        <Text numberOfLines={1} style={styles.activityText}>
          <Text style={styles.activityUser}>{activity.user} </Text>
          {activity.action}
        </Text>
        {activity.onMenu && (
          <Pressable accessibilityLabel="Rating options" accessibilityRole="button" hitSlop={12} onPress={activity.onMenu} style={({ pressed }) => pressed && styles.pressed}>
            <DotsThreeIcon color={Palette.muted} size={18} weight="bold" />
          </Pressable>
        )}
      </View>

      <View style={[styles.albumRow, activity.hideCover ? styles.compactAlbumRow : { height: coverSize }]}>
        {!activity.hideCover && (
          <Pressable accessibilityRole="button" onPress={activity.onOpenAlbum} style={({ pressed }) => pressed && styles.pressed}>
            <Image source={activity.cover} style={[styles.cover, { width: coverSize, height: coverSize }]} />
          </Pressable>
        )}
        <View style={[styles.albumDetails, activity.hideCover && styles.compactAlbumDetails]}>
          <View>
            <Text numberOfLines={1} style={styles.artist}>
              {activity.artist}
            </Text>
            {activity.linkAlbumTitle && activity.onOpenAlbum ? (
              <Pressable
                accessibilityLabel={`Open ${activity.album}`}
                accessibilityRole="link"
                onPress={activity.onOpenAlbum}
                style={({ pressed }) => pressed && styles.pressed}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.albumTitle}>{activity.album}</Text>
              </Pressable>
            ) : (
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.albumTitle}>{activity.album}</Text>
            )}
            {activity.rating !== undefined && (
              <View
                accessibilityLabel={`${activity.rating} out of 5`}
                accessibilityRole="text"
                style={styles.ratingRow}>
                <DiscRating rating={activity.rating} tone={activity.ratingTone ?? 'gold'} />
              </View>
            )}
          </View>

          {!activity.hideActions && (
            <View style={styles.actionRow}>
              <Action icon={PlusCircleIcon} label={activity.rateActionLabel} onPress={activity.onRate} />
              {activity.secondaryAction && (
                <Action
                  icon={BookmarkSimpleIcon}
                  iconColor={saved ? Palette.brand : Palette.ink}
                  iconWeight={saved ? 'fill' : 'regular'}
                  label={saved ? 'Saved' : activity.secondaryAction}
                  onPress={() => setSaved((value) => {
                    activity.onSave?.(!value);
                    return !value;
                  })}
                />
              )}
            </View>
          )}
        </View>
      </View>

      {activity.note && activity.rating !== undefined && (
        <View style={styles.noteWrap}>
          <ExpandableNote note={activity.note} style={styles.note} />
        </View>
      )}

      <View style={styles.metaRow}>
        <View style={styles.engagementRow}>
          <Pressable
            accessibilityLabel={`${liked ? 'Unlike' : 'Like'} ${activity.album}`}
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => setLiked((value) => {
              activity.onLike?.(!value);
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
            accessibilityLabel={`${activity.comments} comments on ${activity.album}`}
            accessibilityRole="button"
            hitSlop={12}
            style={({ pressed }) => [styles.engagementItem, pressed && styles.pressed]}>
            <ChatCircleIcon color={Palette.ink} size={13} weight="regular" />
            <Text style={styles.metaText}>{activity.comments}</Text>
          </Pressable>
        </View>
        <Text style={styles.timestamp}>{activity.time}</Text>
      </View>
      <View style={styles.dividerWrap}>
        <View style={styles.divider} />
      </View>
    </View>
  );
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
  activityHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
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
    flex: 1,
    color: Palette.brand,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 19,
  },
  activityUser: {
    fontFamily: Fonts.semibold,
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
  compactAlbumRow: {},
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
  noteWrap: {
    paddingTop: 16,
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
