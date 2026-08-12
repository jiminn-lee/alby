import { useIsFocused, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextLayoutEvent,
  type TextStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const OverflowTolerance = 1;
const PixelsPerSecond = 28;
const MarqueeGap = 32;
const PauseDurationMs = 3000;
const NavigationBlurGraceMs = 300;
const MeasurementWidth = 10000;

export function MarqueeText({
  align = 'left',
  style,
  text,
}: {
  align?: 'left' | 'center';
  style?: StyleProp<TextStyle>;
  text: string;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const isFocused = useIsFocused();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const runningAnimationKey = useRef<string | null>(null);
  const overflow = Math.max(0, textWidth - containerWidth);
  const canAnimate = !reduceMotion
    && containerWidth > 0
    && overflow > OverflowTolerance;
  const shouldRunAnimation = isFocused || pathname.startsWith('/comments/');
  const animationKey = `${text}:${textWidth}`;

  useEffect(() => {
    const stopAnimation = () => {
      cancelAnimation(translateX);
      translateX.value = 0;
      runningAnimationKey.current = null;
    };

    if (!canAnimate) {
      stopAnimation();
      return;
    }

    if (!shouldRunAnimation) {
      const blurTimeout = setTimeout(stopAnimation, NavigationBlurGraceMs);
      return () => clearTimeout(blurTimeout);
    }

    if (runningAnimationKey.current === animationKey) return;

    stopAnimation();

    const loopDistance = textWidth + MarqueeGap;
    const travelDuration = Math.round((loopDistance / PixelsPerSecond) * 1000);
    translateX.value = withRepeat(
      withSequence(
        withDelay(
          PauseDurationMs,
          withTiming(-loopDistance, { duration: travelDuration, easing: Easing.linear }),
        ),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
      undefined,
      ReduceMotion.System,
    );
    runningAnimationKey.current = animationKey;
  }, [animationKey, canAnimate, shouldRunAnimation, textWidth, translateX]);

  useEffect(() => () => cancelAnimation(translateX), [translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const updateContainerWidth = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setContainerWidth((currentWidth) => (
      Math.abs(currentWidth - nextWidth) > OverflowTolerance ? nextWidth : currentWidth
    ));
  };

  const updateTextWidth = (event: TextLayoutEvent) => {
    const nextWidth = event.nativeEvent.lines[0]?.width ?? 0;
    setTextWidth((currentWidth) => (
      Math.abs(currentWidth - nextWidth) > OverflowTolerance ? nextWidth : currentWidth
    ));
  };

  return (
    <View
      accessibilityLabel={canAnimate ? text : undefined}
      accessibilityRole={canAnimate ? 'text' : undefined}
      accessible={canAnimate}
      onLayout={updateContainerWidth}
      style={styles.viewport}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.measurementRow}>
        <Text numberOfLines={1} onTextLayout={updateTextWidth} style={[style, styles.measurementText]}>
          {text}
        </Text>
      </View>

      {canAnimate ? (
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[
            styles.track,
            { columnGap: MarqueeGap, width: (textWidth * 2) + MarqueeGap },
            animatedStyle,
          ]}>
          <Text numberOfLines={1} style={[style, styles.movingText, { width: textWidth }]}>
            {text}
          </Text>
          <Text numberOfLines={1} style={[style, styles.movingText, { width: textWidth }]}>
            {text}
          </Text>
        </Animated.View>
      ) : (
        <Text
          accessibilityLabel={text}
          numberOfLines={1}
          style={[style, styles.staticText, { textAlign: align }]}>
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    width: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  measurementRow: {
    position: 'absolute',
    left: 0,
    top: 0,
    flexDirection: 'row',
    opacity: 0,
  },
  measurementText: {
    width: MeasurementWidth,
    flexShrink: 0,
  },
  movingText: {
    flexShrink: 0,
  },
  track: {
    flexDirection: 'row',
    flexShrink: 0,
  },
  staticText: {
    width: '100%',
  },
});
