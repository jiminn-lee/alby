import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, FeGaussianBlur, Filter } from 'react-native-svg';

import { Fonts, Palette } from '@/constants/theme';

import { RatingDisc } from './rating-disc';

export function AlbyWordmark() {
  return (
    <View accessibilityLabel="alby" accessibilityRole="text" style={styles.container}>
      <View style={styles.disc}>
        <RatingDisc size={32} />
      </View>
      <View pointerEvents="none" style={styles.discVeil}>
        <Svg height={40} viewBox="0 0 40 40" width={40}>
          <Defs>
            <Filter height="200%" id="wordmark-disc-blur" width="200%" x="-50%" y="-50%">
              <FeGaussianBlur stdDeviation={4} />
            </Filter>
          </Defs>
          <Circle cx={20} cy={20} fill={Palette.canvas} filter="url(#wordmark-disc-blur)" r={12} />
        </Svg>
      </View>
      <Text style={styles.text}>alby</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 80,
    height: 48,
  },
  disc: {
    position: 'absolute',
    left: 0,
    top: 7,
  },
  discVeil: {
    position: 'absolute',
    left: 3,
    top: 7,
    width: 40,
    height: 40,
  },
  text: {
    position: 'absolute',
    left: 14,
    top: 0,
    color: Palette.brand,
    fontFamily: Fonts.brand,
    fontSize: 36,
    lineHeight: 48,
    letterSpacing: -0.5,
  },
});
