import { router } from 'expo-router';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
import { SignOutIcon } from 'phosphor-react-native/src/icons/SignOut';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbyButton } from '@/components/ui';
import { Fonts, MaxContentWidth, Palette, PressedOpacity } from '@/constants/theme';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export default function SettingsScreen() {
  const { profile, refreshProfile, session, signOut } = useAuth(); const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false); const [error, setError] = useState<string | null>(null);
  const togglePrivacy = async (value: boolean) => {
    if (!session) return; setIsPrivate(value); setError(null);
    const { error: updateError } = await supabase.from('profiles').update({ is_private: value }).eq('id', session.user.id);
    if (updateError) { setIsPrivate(!value); setError(updateError.message); return; }
    await refreshProfile(); await queryClient.invalidateQueries();
  };
  return <SafeAreaView style={styles.safeArea}><View style={styles.content}>
    <View style={styles.header}><Pressable accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}><ArrowLeftIcon color={Palette.brand} size={24} /></Pressable><Text style={styles.title}>Settings</Text><View style={styles.headerSpacer} /></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Privacy</Text><View style={styles.setting}><View style={styles.settingCopy}><Text style={styles.settingTitle}>Private profile</Text><Text style={styles.settingDescription}>Only mutual follows can see your ratings, notes, saved albums, and activity.</Text></View><Switch accessibilityLabel="Private profile" onValueChange={togglePrivacy} thumbColor="#FFFFFF" trackColor={{ false: Palette.border, true: Palette.brand }} value={isPrivate} /></View>{error && <Text style={styles.error}>{error}</Text>}</View>
    <View style={styles.signOut}><AlbyButton icon={SignOutIcon} label="Sign out" onPress={signOut} variant="danger" /></View>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Palette.canvas }, content: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: 24 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 19 }, headerSpacer: { width: 24 },
  section: { marginTop: 28 }, sectionTitle: { color: Palette.brand, fontFamily: Fonts.semibold, fontSize: 12, textTransform: 'uppercase', marginBottom: 12 },
  setting: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Palette.border, paddingVertical: 14 },
  settingCopy: { flex: 1, gap: 4 }, settingTitle: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 15 }, settingDescription: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 11, lineHeight: 16 },
  error: { marginTop: 10, color: Palette.liked, fontFamily: Fonts.sans, fontSize: 12 }, signOut: { marginTop: 'auto', paddingBottom: 16 }, pressed: { opacity: PressedOpacity },
});
