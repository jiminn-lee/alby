import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Palette, PressedOpacity } from '@/constants/theme';
import { getMediaUrl } from '@/lib/media';
import type { Album } from '@/types/domain';

import { RatingDisc } from './rating-disc';

export function AlbumListItem({ album, rating, subtitle }: { album: Album; rating?: number | null; subtitle?: string }) {
  const cover = getMediaUrl(album.cover_path);
  const metadata = subtitle ?? album.release_date?.slice(0, 4);
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/albums/[albumId]', params: { albumId: album.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {cover && <Image source={cover} style={styles.cover} />}
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.artist}>{album.artist_name}</Text>
        <Text numberOfLines={1} style={styles.title}>{album.title}</Text>
        {metadata ? <Text numberOfLines={1} style={styles.subtitle}>{metadata}</Text> : null}
      </View>
      {rating != null && <View accessibilityLabel={`${rating} out of 5`} style={styles.score}><RatingDisc size={26} tone={rating >= 3.5 ? 'gold' : rating >= 2.5 ? 'silver' : 'copper'} /><Text style={styles.value}>{rating.toFixed(1)}</Text></View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Palette.border },
  cover: { width: 62, height: 62, borderWidth: 1, borderColor: Palette.border },
  copy: { flex: 1, minWidth: 0, gap: 2 }, artist: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 11 },
  title: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 16 }, subtitle: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 11 },
  score: { alignItems: 'center', gap: 2, width: 38 }, value: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 11, fontVariant: ['tabular-nums'] },
  pressed: { opacity: PressedOpacity },
});
