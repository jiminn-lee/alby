import { GoogleLogoIcon } from 'phosphor-react-native/src/icons/GoogleLogo';
import { HeadphonesIcon } from 'phosphor-react-native/src/icons/Headphones';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbyWordmark } from '@/components/alby-wordmark';
import { AlbyButton } from '@/components/ui';
import { Fonts, MaxContentWidth, Palette } from '@/constants/theme';
import { isStaging } from '@/lib/app-env';
import { useAuth } from '@/providers/auth-provider';

export default function SignInScreen() {
  const { signInDemo, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Sign in failed.'); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.brand}><AlbyWordmark /><Text style={styles.subtitle}>Your friends have good records waiting for you.</Text></View>
        <View style={styles.actions}>
          {Platform.OS !== 'web' && <AlbyButton disabled={busy} icon={GoogleLogoIcon} label="Continue with Google" onPress={() => run(signInWithGoogle)} variant="secondary" />}
          {isStaging && <AlbyButton disabled={busy} icon={HeadphonesIcon} label="Use staging Jimin account" onPress={() => run(signInDemo)} variant="secondary" />}
          {Platform.OS === 'web' && !isStaging && <Text style={styles.unavailable}>Alby sign-in is currently available in the iOS and Android apps.</Text>}
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </View>
        <Text style={styles.terms}>By continuing, you agree to keep album discourse civil.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Palette.canvas },
  content: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: 24, justifyContent: 'space-between' },
  brand: { paddingTop: 96, gap: 18 },
  subtitle: { color: Palette.ink, fontFamily: Fonts.brand, fontSize: 32, lineHeight: 40 },
  actions: { gap: 12 },
  unavailable: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  error: { color: Palette.liked, fontFamily: Fonts.sans, fontSize: 13, textAlign: 'center' },
  terms: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
