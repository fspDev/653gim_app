import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { colors, radius, typography } from '../theme/colors';

export function PrimaryButton({ title, onPress, disabled, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryBtn,
        disabled && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      <Text style={styles.primaryBtnText}>{title}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, style, textStyle }) {
  return (
    <Pressable onPress={onPress} style={[styles.secondaryBtn, style]}>
      <Text style={[styles.secondaryBtnText, textStyle]}>{title}</Text>
    </Pressable>
  );
}

export function FormField({ label, ...props }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.gray2}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children, style }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

export function Badge({ text, tone = 'default' }) {
  return (
    <View style={[styles.badge, tone === 'warn' && styles.badgeWarn]}>
      <Text style={[styles.badgeText, tone === 'warn' && styles.badgeTextWarn]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    backgroundColor: colors.red,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    shadowColor: colors.red,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  secondaryBtn: {
    backgroundColor: colors.black3,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  fieldLabel: { ...typography.label, color: colors.gray1, marginBottom: 7 },
  input: {
    backgroundColor: colors.black2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 15,
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.black2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.gray1,
    marginTop: 22,
    marginBottom: 10,
  },
  badge: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: { color: colors.green, fontSize: 10.5, fontWeight: '800' },
  badgeWarn: { backgroundColor: colors.redDim },
  badgeTextWarn: { color: '#ff8a94' },
});
