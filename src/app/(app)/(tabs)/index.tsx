import { useScrollToTop } from 'expo-router';
import { BellSimpleIcon } from 'phosphor-react-native/src/icons/BellSimple';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbyWordmark } from '@/components/alby-wordmark';
import { HomeFeed } from '@/components/social-feed';
import { ScreenState } from '@/components/ui';
import { BottomTabInset, MaxContentWidth, Palette, PressedOpacity } from '@/constants/theme';
import { useHomeFeed } from '@/features/data/hooks';

export default function HomeScreen() {
  const feed = useHomeFeed();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  useScrollToTop(scrollRef);

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={[styles.scrollContent, { paddingBottom: BottomTabInset + insets.bottom + 24 }]} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} style={styles.scrollView}>
      <View style={[styles.content, { paddingTop: insets.top + 24 }]}>
        <View style={styles.header}><AlbyWordmark /><Pressable accessibilityLabel="Notifications" accessibilityRole="button" hitSlop={12} style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}><BellSimpleIcon color={Palette.brand} size={20} weight="regular" /></Pressable></View>
        {feed.isLoading ? <ScreenState label="Finding your friends' records..." /> : feed.error ? <ScreenState error={feed.error.message} /> : <HomeFeed items={feed.data ?? []} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: Palette.canvas }, scrollContent: { alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: 24 },
  header: { width: '100%', height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  notificationButton: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' }, pressed: { opacity: PressedOpacity },
});
