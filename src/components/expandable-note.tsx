import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { Fonts, Palette, PressedOpacity } from '@/constants/theme';

export function ExpandableNote({
  collapsedLines = 3,
  note,
  style,
}: {
  collapsedLines?: number;
  note: string;
  style?: StyleProp<TextStyle>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  return (
    <View style={styles.container}>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onTextLayout={(event) => {
          const nextOverflowing = event.nativeEvent.lines.length > collapsedLines;
          if (nextOverflowing !== overflowing) setOverflowing(nextOverflowing);
        }}
        style={[style, styles.measurement]}>
        {note}
      </Text>

      {expanded ? (
        <Text selectable style={style}>
          {note}
          <Text
            accessibilityLabel="Read less"
            accessibilityRole="button"
            onPress={() => setExpanded(false)}
            style={styles.toggleText}>
            {' Read less'}
          </Text>
        </Text>
      ) : (
        <View style={styles.collapsed}>
          <Text numberOfLines={collapsedLines} selectable style={style}>{note}</Text>
          {overflowing && (
            <Pressable
              accessibilityLabel="Read more"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => setExpanded(true)}
              style={({ pressed }) => [styles.readMore, pressed && styles.pressed]}>
              <Text style={styles.toggleText}>... Read more</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  collapsed: {
    position: 'relative',
  },
  measurement: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
    pointerEvents: 'none',
  },
  readMore: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingLeft: 4,
    backgroundColor: Palette.canvas,
  },
  toggleText: {
    color: Palette.muted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 15,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
