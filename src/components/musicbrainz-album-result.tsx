import * as Linking from 'expo-linking';
import { DatabaseIcon } from 'phosphor-react-native/src/icons/Database';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Palette, PressedOpacity } from '@/constants/theme';
import type { MusicBrainzAlbumSearchResult } from '@/types/musicbrainz';

import { AlbumArtwork } from './album-artwork';

type Props = {
  album: MusicBrainzAlbumSearchResult;
  busy: boolean;
  disabled: boolean;
  onSelect: () => void;
};

export function MusicBrainzAlbumResult({ album, busy, disabled, onSelect }: Props) {
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
        <AlbumArtwork source={album.coverUrl} style={styles.cover} />
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.artist}>{album.artistName}</Text>
          <Text numberOfLines={1} style={styles.title}>{album.title}</Text>
          <Text numberOfLines={1} style={styles.metadata}>{metadata}</Text>
        </View>
        {busy ? <ActivityIndicator color={Palette.brand} size="small" /> : null}
      </Pressable>
      <Pressable
        accessibilityLabel={`View ${album.title} on MusicBrainz`}
        accessibilityRole="link"
        hitSlop={8}
        onPress={() => void Linking.openURL(album.musicBrainzUrl)}
        style={({ pressed }) => [styles.sourceLink, pressed && styles.pressed]}>
        <DatabaseIcon color={Palette.brand} size={15} />
        <Text style={styles.sourceText}>MusicBrainz</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderBottomColor: Palette.border, paddingVertical: 10 },
  albumButton: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 62, height: 62, borderWidth: 1, borderColor: Palette.border, backgroundColor: '#FFFFFF' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  artist: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 11 },
  title: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 16 },
  metadata: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 11 },
  sourceLink: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 74, marginTop: 4, minHeight: 24 },
  sourceText: { color: Palette.muted, fontFamily: Fonts.medium, fontSize: 10 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: PressedOpacity },
});
