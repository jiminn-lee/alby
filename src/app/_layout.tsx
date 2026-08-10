import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { PlayfairDisplay_500Medium } from '@expo-google-fonts/playfair-display/500Medium';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display/600SemiBold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { queryClient } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider value={{
            ...DefaultTheme,
            colors: { ...DefaultTheme.colors, background: Palette.canvas, card: Palette.canvas, border: Palette.border, primary: Palette.brand, text: Palette.ink },
          }}>
            <StatusBar style="dark" />
            <ProtectedNavigator />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function ProtectedNavigator() {
  const { isLoading, isProfileComplete, session } = useAuth();
  if (isLoading) {
    return <View style={styles.loading}><ActivityIndicator color={Palette.brand} /></View>;
  }
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: Palette.canvas }, headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(session) && !isProfileComplete}>
        <Stack.Screen name="complete-profile" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(session) && isProfileComplete}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.canvas } });
