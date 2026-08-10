import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import type { Icon } from 'phosphor-react-native';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
import { BookmarkSimpleIcon } from 'phosphor-react-native/src/icons/BookmarkSimple';
import { ExportIcon } from 'phosphor-react-native/src/icons/Export';
import { PlusCircleIcon } from 'phosphor-react-native/src/icons/PlusCircle';
import { SpotifyLogoIcon } from 'phosphor-react-native/src/icons/SpotifyLogo';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, Share, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RatingDisc, type DiscTone } from '@/components/rating-disc';
import { ActivityFeed } from '@/components/social-feed';
import { AlbyButton, ScreenState } from '@/components/ui';
import { Fonts, MaxContentWidth, Palette, PressedOpacity } from '@/constants/theme';
import { useAlbum, useAlbumActivity, useDeleteRatingMutation, useListenLaterMutation } from '@/features/data/hooks';
import { getMediaUrl } from '@/lib/media';

export default function AlbumDetailScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const detail = useAlbum(albumId);
  const activity = useAlbumActivity(albumId);
  const listenLater = useListenLaterMutation();
  const removeRating = useDeleteRatingMutation();
  const scrollRef = useRef<ScrollView>(null);
  const [scrollY] = useState(() => new Animated.Value(0));
  const [heroBottom, setHeroBottom] = useState<number | null>(null);
  const [compactHeaderVisible, setCompactHeaderVisible] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
    scrollY.setValue(0);
  }, [albumId, scrollY]);

  if (detail.isLoading) return <ScreenState label="Loading album..." />;
  if (detail.error || !detail.data) return <ScreenState error={detail.error?.message ?? 'Album not found.'} />;

  const { album, isSaved, myRating, summary } = detail.data;
  const cover = getMediaUrl(album.cover_path);
  const spotifyUrl = album.spotify_url ?? `https://open.spotify.com/search/${encodeURIComponent(`${album.title} ${album.artist_name}`)}`;
  const year = album.release_date?.slice(0, 4) ?? '—';
  const compactHeaderOpacity = scrollY.interpolate({
    inputRange: [Math.max(0, (heroBottom ?? 100000) - 24), heroBottom ?? 100024],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const goBack = () => router.canGoBack() ? router.back() : router.replace('/');
  const scrollToTop = () => scrollRef.current?.scrollTo({ animated: true, y: 0 });
  const openRatingComposer = () => router.push({ pathname: '/albums/[albumId]/rate', params: { albumId } });
  const toggleListenLater = () => listenLater.mutate({ albumId: album.id, saved: isSaved });
  const share = () => Share.share({ message: `${album.title} by ${album.artist_name} on Alby: alby://albums/${album.id}` });
  const confirmDelete = (ratingId: string) => Alert.alert(
    'Delete rating?',
    'This removes this rating and its activity. An older rating will become your current rating if one exists.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeRating.mutate({ albumId: album.id, ratingId }) },
    ],
  );

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 36 }]}
        contentInsetAdjustmentBehavior="never"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
              const nextVisible = heroBottom !== null && event.nativeEvent.contentOffset.y >= heroBottom - 24;
              setCompactHeaderVisible((current) => current === nextVisible ? current : nextVisible);
            },
            useNativeDriver: true,
          },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { paddingTop: insets.top + 24 }]}>
          <Pressable accessibilityLabel="Back" accessibilityRole="button" hitSlop={12} onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ArrowLeftIcon color={Palette.brand} size={20} />
          </Pressable>

          <View style={styles.ratingBand}>
            <Score label={'Friend\nRating'} value={summary.friend_average} />
            <View style={styles.scoreDivider} />
            <Score label={'Global\nRating'} value={summary.global_average} />
          </View>

          <View
            onLayout={(event) => setHeroBottom(event.nativeEvent.layout.y + event.nativeEvent.layout.height)}
            style={styles.albumHero}>
            {cover ? <Image source={cover} style={styles.cover} /> : <View style={styles.coverPlaceholder} />}
            <View style={styles.albumCopy}>
              <Text numberOfLines={1} style={styles.artist}>{album.artist_name} • {year} • {album.track_count} tracks</Text>
              <Text numberOfLines={2} style={styles.title}>{album.title}</Text>
            </View>
            <View style={styles.actions}>
              <AlbyButton icon={PlusCircleIcon} label={myRating ? 'Rate Again' : 'Rate'} onPress={openRatingComposer} size="compact" />
              {!myRating && (
                <AlbyButton
                  icon={BookmarkSimpleIcon}
                  iconWeight={isSaved ? 'fill' : 'regular'}
                  label={isSaved ? 'Saved' : 'Listen Later'}
                  onPress={toggleListenLater}
                  size="compact"
                  variant="secondary"
                />
              )}
              <AlbyButton accessibilityLabel="Share album" icon={ExportIcon} onPress={share} size="icon" variant="secondary" />
              <IconAction accessibilityLabel="Open in Spotify" icon={SpotifyLogoIcon} onPress={() => Linking.openURL(spotifyUrl)} spotify />
            </View>
          </View>

          <View style={styles.activityArea}>
            {activity.isLoading ? <ScreenState /> : activity.error ? <ScreenState error={activity.error.message} /> : activity.data?.length ? (
              <ActivityFeed albumDetail items={activity.data} onDeleteRating={confirmDelete} />
            ) : <Text style={styles.empty}>No visible activity yet.</Text>}
          </View>
        </View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents={compactHeaderVisible ? 'auto' : 'none'}
        style={[styles.compactHeader, { opacity: compactHeaderOpacity, paddingTop: insets.top }]}>
        <View style={styles.compactHeaderContent}>
          <View style={styles.compactIdentityGroup}>
            <Pressable accessibilityLabel="Back" accessibilityRole="button" hitSlop={12} onPress={goBack} style={({ pressed }) => [styles.compactBack, pressed && styles.pressed]}>
              <ArrowLeftIcon color={Palette.brand} size={20} />
            </Pressable>
            <Pressable accessibilityLabel={`Scroll to ${album.title}`} accessibilityRole="button" onPress={scrollToTop} style={({ pressed }) => [styles.compactIdentity, pressed && styles.pressed]}>
              <Text numberOfLines={1} style={styles.compactArtist}>{album.artist_name}</Text>
              <Text numberOfLines={1} style={styles.compactTitle}>{album.title}</Text>
            </Pressable>
          </View>
          <View style={styles.compactActions}>
            <AlbyButton accessibilityLabel={myRating ? 'Rate again' : 'Rate album'} icon={PlusCircleIcon} onPress={openRatingComposer} size="icon" />
            {!myRating && (
              <AlbyButton
                accessibilityLabel={isSaved ? 'Remove from Listen Later' : 'Add to Listen Later'}
                icon={BookmarkSimpleIcon}
                iconWeight={isSaved ? 'fill' : 'regular'}
                onPress={toggleListenLater}
                size="icon"
                variant="secondary"
              />
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  const numericValue = value == null ? null : Number(value);
  const tone: DiscTone = numericValue == null || numericValue >= 3.5 ? 'gold' : numericValue >= 2.5 ? 'silver' : 'copper';
  const color = tone === 'gold' ? '#EFC679' : tone === 'silver' ? '#B3B3B3' : '#CD9469';
  return (
    <View style={styles.score}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreValueRow}>
        <RatingDisc presentation="aggregate" size={24} tone={tone} />
        <Text style={[styles.scoreValue, { color }]}>{numericValue == null ? '—' : numericValue.toFixed(1)}</Text>
      </View>
    </View>
  );
}

function IconAction({ accessibilityLabel, icon: IconComponent, onPress, spotify = false }: { accessibilityLabel: string; icon: Icon; onPress: () => void; spotify?: boolean }) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.iconAction, styles.spotifyAction, pressed && styles.pressed]}>
      <IconComponent color={spotify ? Palette.brand : Palette.ink} size={16} weight={spotify ? 'fill' : 'regular'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.canvas },
  scrollContent: { alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: 24, paddingBottom: 24, gap: 24 },
  backButton: { width: 24, height: 20, justifyContent: 'center' },
  ratingBand: { width: '100%', height: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  score: { flex: 1, height: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  scoreDivider: { width: 1, height: 39, backgroundColor: Palette.border },
  scoreLabel: { color: Palette.ink, fontFamily: Fonts.brand, fontSize: 16, lineHeight: 16, textAlign: 'left' },
  scoreValueRow: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden', marginBottom: 4, marginLeft: 4 },
  scoreValue: { marginLeft: -8, fontFamily: Fonts.semibold, fontSize: 24, lineHeight: 29, fontVariant: ['tabular-nums'] },
  albumHero: { width: '100%', alignItems: 'center', gap: 16 },
  cover: { width: 208, height: 208, borderWidth: 2, borderColor: Palette.border },
  coverPlaceholder: { width: 208, height: 208, borderWidth: 2, borderColor: Palette.border, backgroundColor: Palette.border },
  albumCopy: { width: '100%', alignItems: 'center' },
  artist: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 10, lineHeight: 12, textAlign: 'center' },
  title: { color: Palette.ink, fontFamily: Fonts.brandMedium, fontSize: 24, lineHeight: 29, textAlign: 'center' },
  actions: { width: '100%', minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  iconAction: { width: 32, height: 32, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  spotifyAction: { backgroundColor: '#64DA81', borderColor: '#AFF6C1' },
  activityArea: { width: '100%' },
  empty: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 13, paddingVertical: 40, textAlign: 'center' },
  compactHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, alignItems: 'center', backgroundColor: Palette.canvas, borderBottomWidth: 2, borderBottomColor: Palette.border },
  compactHeaderContent: { width: '100%', maxWidth: MaxContentWidth, height: 73, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compactIdentityGroup: { width: 218, height: 39, flexDirection: 'row', alignItems: 'center', gap: 16 },
  compactBack: { width: 18, height: 39, alignItems: 'flex-start', justifyContent: 'center' },
  compactIdentity: { flex: 1, minWidth: 0, height: 39, justifyContent: 'center' },
  compactArtist: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 15 },
  compactTitle: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 20, lineHeight: 24 },
  compactActions: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 4 },
  pressed: { opacity: PressedOpacity },
});
