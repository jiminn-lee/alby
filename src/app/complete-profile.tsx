import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbyButton, AlbyInput } from '@/components/ui';
import { Fonts, MaxContentWidth, Palette } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export default function CompleteProfileScreen() {
  const { profile, refreshProfile, session } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!session) return;
    const normalized = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (normalized.length < 3 || displayName.trim().length < 1) { setError('Use a 3-24 character username and add your display name.'); return; }
    setSaving(true); setError(null);
    const { error: updateError } = await supabase.from('profiles').update({ username: normalized, display_name: displayName.trim() }).eq('id', session.user.id);
    if (updateError) setError(updateError.code === '23505' ? 'That username is already taken.' : updateError.message);
    else await refreshProfile();
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heading}><Text style={styles.title}>Make Alby yours</Text><Text style={styles.copy}>Choose how friends will find you. You can change these later.</Text></View>
          <View style={styles.form}>
            <Text style={styles.label}>Display name</Text><AlbyInput autoCapitalize="words" onChangeText={setDisplayName} value={displayName} />
            <Text style={styles.label}>Username</Text><AlbyInput autoCapitalize="none" autoCorrect={false} onChangeText={setUsername} placeholder="jimin" value={username} />
            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <AlbyButton disabled={saving} icon={CheckCircleIcon} label={saving ? 'Saving...' : 'Enter Alby'} onPress={submit} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: Palette.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: 24, justifyContent: 'center', gap: 48 },
  heading: { gap: 12 }, title: { color: Palette.ink, fontFamily: Fonts.brand, fontSize: 36, lineHeight: 43 },
  copy: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22 },
  form: { gap: 10 }, label: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 13, marginTop: 6 },
  error: { color: Palette.liked, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18 },
});
