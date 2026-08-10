import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import type { Icon } from 'phosphor-react-native';
import { UserIcon } from 'phosphor-react-native/src/icons/User';
import {
  TabList,
  TabListProps,
  TabSlot,
  Tabs,
  TabTrigger,
  TabTriggerSlotProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Palette, PressedOpacity } from '@/constants/theme';

const tabIcons = {
  home: HouseIcon,
  explore: MagnifyingGlassIcon,
  profile: UserIcon,
};

export default function AppTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <AlbyTabList bottomInset={insets.bottom}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton label="Home" icon={tabIcons.home} />
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton label="Explore" icon={tabIcons.explore} />
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton label="Profile" icon={tabIcons.profile} />
          </TabTrigger>
        </AlbyTabList>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & {
  icon: Icon;
  label: string;
};

function TabButton({ icon: IconComponent, isFocused, label, ...props }: TabButtonProps) {
  return (
    <Pressable
      {...props}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <IconComponent
        color={isFocused ? Palette.brand : Palette.ink}
        size={32}
        weight={isFocused ? 'fill' : 'regular'}
      />
    </Pressable>
  );
}

function AlbyTabList({ bottomInset, children, ...props }: TabListProps & { bottomInset: number }) {
  return (
    <View style={styles.tabShell}>
      <View {...props} style={[styles.tabList, { height: BottomTabInset + bottomInset, paddingBottom: bottomInset }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    backgroundColor: Palette.canvas,
  },
  tabShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 20,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  tabList: {
    width: '100%',
    maxWidth: MaxContentWidth,
    height: BottomTabInset,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: Palette.canvas,
    borderColor: Palette.border,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    borderCurve: 'continuous',
  },
  tabButton: {
    flex: 1,
    height: BottomTabInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
