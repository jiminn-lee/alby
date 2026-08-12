import { Stack } from 'expo-router';

import { Palette } from '@/constants/theme';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.canvas } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="users/[username]" />
      <Stack.Screen name="albums/[albumId]/index" />
      <Stack.Screen
        name="comments/[activityId]"
        options={{
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
          gestureEnabled: false,
          presentation: 'transparentModal',
        }}
      />
      <Stack.Screen
        name="albums/[albumId]/rate"
        options={{ animation: 'fade', presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } }}
      />
      <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
