import { router } from 'expo-router';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbyButton, AlbyInput } from '@/components/ui';
import { Fonts, MaxContentWidth, Palette, PressedOpacity } from '@/constants/theme';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export default function EditProfileScreen() {
  const { profile, refreshProfile, session } = useAuth(); const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? ''); const [bio, setBio] = useState(profile?.bio ?? '');
  const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!session) return; const normalized = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (normalized.length < 3 || !displayName.trim()) { setError('Add a display name and a 3-24 character username.'); return; }
    setSaving(true); setError(null);
    const { error: updateError } = await supabase.from('profiles').update({ display_name: displayName.trim(), username: normalized, bio: bio.trim() || null }).eq('id', session.user.id);
    if (updateError) setError(updateError.code === '23505' ? 'That username is already taken.' : updateError.message);
    else { await refreshProfile(); await queryClient.invalidateQueries({ queryKey: ['profile'] }); router.back(); }
    setSaving(false);
  };
  return <SafeAreaView style={styles.safeArea}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Pressable accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}><ArrowLeftIcon color={Palette.brand} size={24} /></Pressable><Text style={styles.title}>Edit profile</Text><View style={styles.headerSpacer} /></View>
    <View style={styles.form}><Text style={styles.label}>Display name</Text><AlbyInput onChangeText={setDisplayName} value={displayName} /><Text style={styles.label}>Username</Text><AlbyInput autoCapitalize="none" autoCorrect={false} onChangeText={setUsername} value={username} /><Text style={styles.label}>Bio</Text><AlbyInput maxLength={240} multiline onChangeText={setBio} value={bio} />{error && <Text style={styles.error}>{error}</Text>}<AlbyButton disabled={saving} icon={CheckCircleIcon} label={saving ? 'Saving...' : 'Save changes'} onPress={save} /></View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: Palette.canvas }, content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: 24 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }, title: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 19 }, headerSpacer: { width: 24 },
  form: { gap: 10 }, label: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 13, marginTop: 8 }, error: { color: Palette.liked, fontFamily: Fonts.sans, fontSize: 13 }, pressed: { opacity: PressedOpacity },
});
