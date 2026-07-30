import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Bubbles } from '@/components/BettaFish';
import { colors, radius, shadow, spacing, type } from '@/theme';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  small,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const bg =
    variant === 'primary'
      ? colors.aqua
      : variant === 'danger'
        ? colors.coral
        : variant === 'dark'
          ? colors.deep
          : variant === 'secondary'
            ? colors.aquaSoft
            : 'transparent';
  const fg =
    variant === 'primary' || variant === 'danger' || variant === 'dark'
      ? '#fff'
      : variant === 'secondary'
        ? colors.aquaDark
        : colors.inkSoft;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        variant === 'ghost' && { borderWidth: 1.5, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, small && { fontSize: 13.5 }, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color = colors.aqua,
  emoji,
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
  emoji?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? '#fff' : colors.inkSoft },
        ]}
        numberOfLines={1}
      >
        {emoji ? `${emoji} ` : ''}
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({
  title,
  right,
  style,
}: {
  title: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={type.subtitle}>{title}</Text>
      {right}
    </View>
  );
}

export function EmptyState({
  emoji = '🐟',
  title,
  message,
  action,
}: {
  emoji?: string;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Bubbles size={70} />
      <Text style={{ fontSize: 44, marginTop: -30 }}>{emoji}</Text>
      <Text style={[type.subtitle, { marginTop: spacing.md, textAlign: 'center' }]}>{title}</Text>
      {message ? (
        <Text style={[type.caption, { marginTop: spacing.sm, textAlign: 'center', maxWidth: 280 }]}>
          {message}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { paddingVertical: 9, paddingHorizontal: spacing.lg },
  btnText: { fontSize: 15.5, fontWeight: '700' },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  chipText: { fontSize: 13.5, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSoft,
    marginBottom: 6,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
