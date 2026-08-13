import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Palette } from '@/constants/theme';

export function AlbumArtwork({ source, style }: {
  source?: ImageSource | string | null;
  style: StyleProp<ViewStyle>;
}) {
  const [failedSource, setFailedSource] = useState<ImageSource | string | null>(null);
  const failed = Boolean(source && failedSource === source);

  return (
    <View style={[style, styles.frame, (!source || failed) && styles.placeholder]}>
      {source && !failed ? (
        <Image
          contentFit="contain"
          onError={() => setFailedSource(source)}
          source={source}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  placeholder: { backgroundColor: Palette.border },
});
