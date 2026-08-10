import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { SpotifyLogoIcon } from 'phosphor-react-native/src/icons/SpotifyLogo';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Palette, PressedOpacity } from '@/constants/theme';
import type { SpotifyAlbumSearchResult } from '@/types/spotify';

type Props = {
  album: SpotifyAlbumSearchResult;
  busy: boolean;
  disabled: boolean;
  onSelect: () => void;
};

export function SpotifyAlbumResult({ album, busy, disabled, onSelect }: Props) {
  const year = album.releaseDate?.slice(0, 4);
  const metadata = [year, album.releaseType === 'ep' ? 'EP' : 'Album'].filter(Boolean).join(' • ');

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={`Open ${album.title} by ${album.artistName} in Alby`}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onSelect}
        style={({ pressed }) => [styles.albumButton, pressed && styles.pressed, disabled && styles.disabled]}>
        {album.coverUrl ? (
          <Image contentFit="contain" source={album.coverUrl} style={styles.cover} />
        ) : <View style={styles.coverPlaceholder} />}
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.artist}>{album.artistName}</Text>
          <Text numberOfLines={1} style={styles.title}>{album.title}</Text>
          <Text numberOfLines={1} style={styles.metadata}>{metadata}</Text>
        </View>
        {busy ? <ActivityIndicator color={Palette.brand} size="small" /> : null}
      </Pressable>
      <Pressable
        accessibilityLabel={`Open ${album.title} on Spotify`}
        accessibilityRole="link"
        hitSlop={8}
        onPress={() => void Linking.openURL(album.spotifyUrl)}
        style={({ pressed }) => [styles.spotifyLink, pressed && styles.pressed]}>
        <SpotifyLogoIcon color={Palette.spotify} size={16} weight="fill" />
        <Text style={styles.spotifyText}>Spotify</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderBottomColor: Palette.border, paddingVertical: 10 },
  albumButton: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 62, height: 62, borderWidth: 1, borderColor: Palette.border, backgroundColor: '#FFFFFF' },
  coverPlaceholder: { width: 62, height: 62, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.border },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  artist: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 11 },
  title: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 16 },
  metadata: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 11 },
  spotifyLink: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 74, marginTop: 4, minHeight: 24 },
  spotifyText: { color: Palette.muted, fontFamily: Fonts.medium, fontSize: 10 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: PressedOpacity },
});
