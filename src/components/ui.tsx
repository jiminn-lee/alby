import type { Icon, IconWeight } from 'phosphor-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, type StyleProp, type ViewStyle } from 'react-native';

import { Fonts, Palette, PressedOpacity } from '@/constants/theme';

export type AlbyButtonVariant = 'primary' | 'secondary' | 'danger';
export type AlbyButtonSize = 'regular' | 'compact' | 'icon';

export type AlbyButtonProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  icon?: Icon;
  iconWeight?: IconWeight;
  label?: string;
  onPress: () => void;
  size?: AlbyButtonSize;
  style?: StyleProp<ViewStyle>;
  variant?: AlbyButtonVariant;
};

export function AlbyButton({
  accessibilityLabel,
  disabled,
  icon: IconComponent,
  iconWeight = 'regular',
  label,
  onPress,
  size = 'regular',
  style,
  variant = 'primary',
}: AlbyButtonProps) {
  const contentColor = variant === 'primary' ? Palette.canvas : variant === 'danger' ? Palette.liked : Palette.ink;
  const iconSize = size === 'regular' ? 18 : 16;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`${size}Button`],
        styles[`${variant}Button`],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {IconComponent && <IconComponent color={contentColor} size={iconSize} weight={iconWeight} />}
      {label && <Text style={[styles.buttonText, styles[`${size}Text`], { color: contentColor }]}>{label}</Text>}
    </Pressable>
  );
}

export function AlbyInput(props: TextInputProps) {
  return <TextInput {...props} placeholderTextColor={Palette.muted} style={[styles.input, props.multiline && styles.multiline, props.style]} />;
}

export function ScreenState({ error, label = 'Loading...' }: { error?: string | null; label?: string }) {
  return <View style={styles.state}>{error ? <Text style={styles.error}>{error}</Text> : <><ActivityIndicator color={Palette.brand} /><Text style={styles.stateText}>{label}</Text></>}</View>;
}

const styles = StyleSheet.create({
  button: { borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  regularButton: { minHeight: 48, paddingHorizontal: 18, borderRadius: 8, gap: 8 },
  compactButton: { height: 32, paddingHorizontal: 16, borderRadius: 12, borderCurve: 'continuous', gap: 4 },
  iconButton: { width: 32, height: 32, paddingHorizontal: 0, borderRadius: 12, borderCurve: 'continuous', gap: 0 },
  primaryButton: { backgroundColor: Palette.brand, borderColor: Palette.muted },
  secondaryButton: { backgroundColor: Palette.border, borderColor: '#FFFFFF' },
  dangerButton: { backgroundColor: 'transparent', borderColor: Palette.liked },
  pressed: { opacity: PressedOpacity },
  disabled: { opacity: 0.55 },
  buttonText: { fontFamily: Fonts.semibold },
  regularText: { fontSize: 15, lineHeight: 19 },
  compactText: { fontFamily: Fonts.medium, fontSize: 12, lineHeight: 15 },
  iconText: { fontSize: 0, lineHeight: 0 },
  input: { minHeight: 48, borderWidth: 1, borderColor: Palette.border, borderRadius: 8, paddingHorizontal: 14, color: Palette.ink, fontFamily: Fonts.sans, fontSize: 16, backgroundColor: '#FFFFFF' },
  multiline: { minHeight: 112, paddingTop: 12, textAlignVertical: 'top' },
  state: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  stateText: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 14 },
  error: { color: Palette.liked, fontFamily: Fonts.sans, fontSize: 14, textAlign: 'center' },
});
