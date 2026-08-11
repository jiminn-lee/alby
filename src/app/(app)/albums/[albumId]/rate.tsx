import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { PlusCircleIcon } from 'phosphor-react-native/src/icons/PlusCircle';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarqueeText } from '@/components/marquee-text';
import { RatingInput } from '@/components/rating-input';
import { AlbyButton, ScreenState } from '@/components/ui';
import { Fonts, Palette } from '@/constants/theme';
import { useAlbum, useRatingMutation } from '@/features/data/hooks';
import { getMediaUrl } from '@/lib/media';

export default function RatingComposerScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const detail = useAlbum(albumId);
  const save = useRatingMutation();
  const [value, setValue] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (value < 0.5) return;
    save.mutate({ albumId, value, note }, {
      onSuccess: () => router.back(),
      onError: (caught) => setError(caught.message),
    });
  };

  return (
    <View style={styles.overlay}>
      <Pressable accessibilityLabel="Close rating composer" onPress={() => router.back()} style={StyleSheet.absoluteFill} />
      <SafeAreaView pointerEvents="box-none" style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
          <View style={styles.modal}>
            {detail.isLoading ? <ScreenState /> : detail.error || !detail.data ? (
              <ScreenState error={detail.error?.message ?? 'Album not found.'} />
            ) : (
              <ComposerContent
                album={detail.data.album}
                error={error}
                note={note}
                onCancel={() => router.back()}
                onChangeNote={setNote}
                onChangeValue={setValue}
                onSubmit={submit}
                pending={save.isPending}
                value={value}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function ComposerContent({ album, error, note, onCancel, onChangeNote, onChangeValue, onSubmit, pending, value }: {
  album: NonNullable<ReturnType<typeof useAlbum>['data']>['album'];
  error: string | null;
  note: string;
  onCancel: () => void;
  onChangeNote: (value: string) => void;
  onChangeValue: (value: number) => void;
  onSubmit: () => void;
  pending: boolean;
  value: number;
}) {
  const cover = getMediaUrl(album.cover_path);
  const metadata = `${album.artist_name} • ${album.release_date?.slice(0, 4) ?? '—'} • ${album.track_count} tracks`;
  return (
    <>
      <View style={styles.albumRow}>
        {cover ? <Image source={cover} style={styles.cover} /> : <View style={styles.cover} />}
        <View style={styles.albumCopy}>
          <MarqueeText style={styles.artist} text={metadata} />
          <MarqueeText style={styles.title} text={album.title} />
        </View>
      </View>

      <View style={styles.form}>
        <RatingInput onChange={onChangeValue} value={value} />
        <TextInput
          accessibilityLabel="Optional rating note"
          maxLength={1000}
          multiline
          onChangeText={onChangeNote}
          placeholder="Add a note... (optional)"
          placeholderTextColor={Palette.muted}
          style={styles.noteInput}
          textAlignVertical="top"
          value={note}
        />
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <View style={styles.buttons}>
          <AlbyButton label="Cancel" onPress={onCancel} size="compact" style={styles.button} variant="secondary" />
          <AlbyButton disabled={pending || value < 0.5} icon={PlusCircleIcon} label={pending ? 'Saving...' : 'Rate'} onPress={onSubmit} size="compact" style={styles.button} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  safeArea: { flex: 1 },
  keyboard: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  modal: { width: '100%', maxWidth: 345, alignSelf: 'center', borderRadius: 12, borderCurve: 'continuous', borderWidth: 2, borderColor: Palette.border, backgroundColor: Palette.canvas, padding: 24, gap: 16 },
  albumRow: { width: '100%', height: 64, flexDirection: 'row' },
  cover: { width: 64, height: 64, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.border },
  albumCopy: { flex: 1, minWidth: 0, paddingHorizontal: 12, justifyContent: 'center' },
  artist: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 15 },
  title: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 20, lineHeight: 24 },
  form: { width: '100%', gap: 8 },
  noteInput: { width: '100%', height: 72, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: Palette.border, backgroundColor: '#FFFFFF', paddingHorizontal: 11, paddingTop: 7, color: Palette.ink, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 15 },
  buttons: { width: '100%', flexDirection: 'row', gap: 8 },
  button: { flex: 1 },
  error: { color: Palette.liked, fontFamily: Fonts.sans, fontSize: 11 },
});
