import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RatingDisc } from './rating-disc';

const DiscSize = 40;
const DiscGap = 8;
const TrackWidth = DiscSize * 5 + DiscGap * 4;

export function RatingInput({ onChange, value }: { onChange: (value: number) => void; value: number }) {
  const [width, setWidth] = useState(297);
  const update = (locationX: number) => {
    const trackStart = Math.max(0, (width - TrackWidth) / 2);
    const trackX = Math.min(TrackWidth, Math.max(0, locationX - trackStart));
    onChange(Math.min(5, Math.max(0.5, Math.ceil((trackX / TrackWidth) * 10) / 2)));
  };
  const adjust = (direction: 1 | -1) => onChange(Math.min(5, Math.max(0, value + direction * 0.5)));
  return (
    <View accessible accessibilityActions={[{ name: 'increment', label: 'Increase rating' }, { name: 'decrement', label: 'Decrease rating' }]}
      accessibilityLabel={`Rating, ${value || 'not selected'} out of 5`} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 5, now: value, text: value ? `${value} out of 5` : 'Not selected' }}
      onAccessibilityAction={(event) => adjust(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)} onMoveShouldSetResponder={() => true} onResponderGrant={(event) => update(event.nativeEvent.locationX)}
      onResponderMove={(event) => update(event.nativeEvent.locationX)} onStartShouldSetResponder={() => true} style={styles.control}>
      <View style={styles.discs}>{Array.from({ length: 5 }, (_, index) => {
        const threshold = index + 1; const fill = value >= threshold ? 'full' : value >= threshold - 0.5 ? 'half' : 'empty';
        return <RatingDisc fill={fill} key={index} size={DiscSize} tone={value >= 3.5 ? 'gold' : value >= 2.5 ? 'silver' : 'copper'} />;
      })}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  control: { width: '100%', height: DiscSize, alignItems: 'center', justifyContent: 'center' },
  discs: { height: DiscSize, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: DiscGap },
});
