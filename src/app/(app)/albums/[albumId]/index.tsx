import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import type { Icon } from 'phosphor-react-native';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
import { BookmarkSimpleIcon } from 'phosphor-react-native/src/icons/BookmarkSimple';
import { DatabaseIcon } from 'phosphor-react-native/src/icons/Database';
import { ExportIcon } from 'phosphor-react-native/src/icons/Export';
import { PlusCircleIcon } from 'phosphor-react-native/src/icons/PlusCircle';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Share, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumArtwork } from '@/components/album-artwork';
import { RatingDisc, type DiscTone } from '@/components/rating-disc';
import { ActivityFeed } from '@/components/social-feed';
import { MarqueeText } from '@/components/marquee-text';
import { AlbyButton, ScreenState } from '@/components/ui';
import { Fonts, MaxContentWidth, Palette, PressedOpacity } from '@/constants/theme';
import { useAlbum, useAlbumActivity, useListenLaterMutation } from '@/features/data/hooks';
import { formatGenreName } from '@/lib/genres';
import { getMediaUrl } from '@/lib/media';

export default function AlbumDetailScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const detail = useAlbum(albumId);
  const activity = useAlbumActivity(albumId, detail.data?.myRating?.id, detail.isSuccess);
  const listenLater = useListenLaterMutation();
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
  const musicBrainzSource = album.catalog_sources.find((source) => source.provider === 'musicbrainz');
  const musicBrainzUrl = musicBrainzSource?.external_url
    ?? (musicBrainzSource ? `https://musicbrainz.org/release-group/${musicBrainzSource.external_id}` : null);
  const genres = album.genres
    .filter((genre) => genre.provider === 'musicbrainz' && genre.genre)
    .sort((left, right) => left.rank - right.rank)
    .slice(0, 5)
    .flatMap(({ genre }) => genre ? [{ externalId: genre.external_id, name: formatGenreName(genre.name) }] : []);
  const year = album.release_date?.slice(0, 4) ?? '—';
  const metadata = [
    album.artist_name,
    year,
    album.track_count ? `${album.track_count} tracks` : null,
  ].filter(Boolean).join(' • ');
  const compactHeaderOpacity = scrollY.interpolate({
    inputRange: [Math.max(0, (heroBottom ?? 100000) - 24), heroBottom ?? 100024],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const goBack = () => router.canGoBack() ? router.back() : router.replace('/');
  const scrollToTop = () => scrollRef.current?.scrollTo({ animated: true, y: 0 });
  const openRatingComposer = () => router.push({ pathname: '/albums/[albumId]/rate', params: { albumId } });
  const toggleListenLater = () => listenLater.mutate({ albumId: album.id, shouldSave: !isSaved });
  const share = () => Share.share({ message: `${album.title} by ${album.artist_name} on Alby: alby://albums/${album.id}` });

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
            <AlbumArtwork source={cover} style={styles.cover} />
            <View style={styles.albumCopy}>
              <MarqueeText align="center" style={styles.artist} text={metadata} />
              <Text style={styles.title}>{album.title}</Text>
              {genres.length ? (
                <View
                  accessible
                  accessibilityLabel={`Genres: ${genres.map(({ name }) => name).join(', ')}`}
                  accessibilityRole="text"
                  style={styles.genreTags}>
                  {genres.map((genre) => (
                    <View key={genre.externalId} style={styles.genreTag}>
                      <Text style={styles.genreTagText}>{genre.name}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
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
              {musicBrainzUrl ? (
                <IconAction
                  accessibilityLabel="View on MusicBrainz"
                  icon={DatabaseIcon}
                  onPress={() => Linking.openURL(musicBrainzUrl)}
                />
              ) : null}
            </View>
          </View>

          <View style={styles.activityArea}>
            {activity.isLoading ? <ScreenState /> : activity.error ? <ScreenState error={activity.error.message} /> : activity.data?.length ? (
              <ActivityFeed albumDetail items={activity.data} pinnedRatingId={myRating?.id} />
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
              <MarqueeText style={styles.compactArtist} text={album.artist_name} />
              <MarqueeText style={styles.compactTitle} text={album.title} />
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

function IconAction({ accessibilityLabel, icon: IconComponent, onPress }: { accessibilityLabel: string; icon: Icon; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.iconAction, styles.sourceAction, pressed && styles.pressed]}>
      <IconComponent color={Palette.brand} size={16} weight="regular" />
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
  albumCopy: { width: '100%', alignItems: 'center' },
  artist: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 10, lineHeight: 12, textAlign: 'center' },
  title: { color: Palette.ink, fontFamily: Fonts.brandMedium, fontSize: 24, lineHeight: 29, textAlign: 'center' },
  genreTags: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 2, marginTop: 4 },
  genreTag: { maxWidth: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.muted, borderWidth: 1, borderColor: Palette.border, borderRadius: 17, paddingHorizontal: 12, paddingVertical: 4 },
  genreTagText: { flexShrink: 1, color: Palette.canvas, fontFamily: Fonts.medium, fontSize: 10, lineHeight: 12, textAlign: 'center' },
  actions: { width: '100%', minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  iconAction: { width: 32, height: 32, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sourceAction: { backgroundColor: '#F0E9E1', borderColor: Palette.border },
  activityArea: { width: '100%' },
  empty: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 13, paddingVertical: 40, textAlign: 'center' },
  compactHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, alignItems: 'center', backgroundColor: Palette.canvas, borderBottomWidth: 2, borderBottomColor: Palette.border },
  compactHeaderContent: { width: '100%', maxWidth: MaxContentWidth, height: 71, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 16 },
  compactIdentityGroup: { flex: 1, minWidth: 0, height: 39, flexDirection: 'row', alignItems: 'center', gap: 16 },
  compactBack: { width: 18, height: 39, alignItems: 'flex-start', justifyContent: 'center' },
  compactIdentity: { flex: 1, minWidth: 0, height: 39, justifyContent: 'center' },
  compactArtist: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 15 },
  compactTitle: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 20, lineHeight: 24 },
  compactActions: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 4 },
  pressed: { opacity: PressedOpacity },
});
