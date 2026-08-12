import { router, useScrollToTop } from 'expo-router';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MusicBrainzAlbumResult } from '@/components/musicbrainz-album-result';
import { AlbyButton, ScreenState } from '@/components/ui';
import { BottomTabInset, Fonts, MaxContentWidth, Palette } from '@/constants/theme';
import { useMaterializeMusicBrainzAlbum, useMusicBrainzAlbumSearch } from '@/features/musicbrainz/hooks';

export default function ExploreScreen() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const albums = useMusicBrainzAlbumSearch(search);
  const materialize = useMaterializeMusicBrainzAlbum();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const isWaitingForDebounce = albums.normalizedSearch !== albums.debouncedSearch;

  useScrollToTop(scrollRef);

  const changeSearch = (value: string) => {
    materialize.reset();
    setSelectedId(null);
    setSearch(value);
  };

  const selectAlbum = (releaseGroupId: string) => {
    if (materialize.isPending) return;
    setSelectedId(releaseGroupId);
    materialize.mutate(releaseGroupId, {
      onSuccess: ({ album }) => router.push({ pathname: '/albums/[albumId]', params: { albumId: album.id } }),
    });
  };

  const results = albums.data?.albums ?? [];
  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + insets.bottom + 24 }]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={styles.scrollView}>
      <Text style={styles.title}>Explore</Text>
      <View style={styles.search}>
        <MagnifyingGlassIcon color={Palette.muted} size={18} />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={changeSearch}
          placeholder="Search MusicBrainz albums and EPs"
          placeholderTextColor={Palette.muted}
          returnKeyType="search"
          style={styles.input}
          value={search}
        />
      </View>

      {materialize.error ? (
        <View style={styles.inlineError}>
          <Text style={styles.errorText}>{materialize.error.message}</Text>
          <AlbyButton label="Try again" onPress={() => selectedId && selectAlbum(selectedId)} size="compact" variant="secondary" />
        </View>
      ) : null}

      {albums.normalizedSearch.length < 2 ? (
        <Text style={styles.prompt}>Enter at least two characters to search MusicBrainz.</Text>
      ) : isWaitingForDebounce || albums.isLoading ? (
        <ScreenState label="Searching MusicBrainz..." />
      ) : albums.error ? (
        <View style={styles.inlineError}>
          <Text style={styles.errorText}>{albums.error.message}</Text>
          <AlbyButton label="Retry search" onPress={() => void albums.refetch()} size="compact" variant="secondary" />
        </View>
      ) : results.length === 0 ? (
        <Text style={styles.prompt}>No supported albums or EPs found.</Text>
      ) : results.map((album) => (
        <MusicBrainzAlbumResult
          album={album}
          busy={materialize.isPending && selectedId === album.releaseGroupId}
          disabled={materialize.isPending}
          key={album.releaseGroupId}
          onSelect={() => selectAlbum(album.releaseGroupId)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: Palette.canvas },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flexGrow: 1, padding: 24 },
  title: { color: Palette.ink, fontFamily: Fonts.brand, fontSize: 30, lineHeight: 38, marginBottom: 18 },
  search: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Palette.border, borderRadius: 8, paddingHorizontal: 13, marginBottom: 14, backgroundColor: '#FFFFFF' },
  input: { flex: 1, color: Palette.ink, fontFamily: Fonts.sans, fontSize: 14 },
  prompt: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 13, paddingVertical: 48, textAlign: 'center' },
  inlineError: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: Palette.liked, fontFamily: Fonts.sans, fontSize: 13, textAlign: 'center' },
});
