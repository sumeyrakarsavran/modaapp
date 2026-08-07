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

import { spacing } from '@/theme';
import { font, glass, luxe, luxeRadius, luxeShadow, luxeType } from '@/theme/luxe';

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
  /*
    Editoryal dil: dolu düğme MÜREKKEP, ikincil düğme pastel iridesan,
    hayalet düğme yalnızca ince çerçeve. Eski turkuaz/mercan paleti fildişi
    sayfalarda yabancı duruyordu.
  */
  const bg =
    variant === 'primary' || variant === 'dark'
      ? luxe.primary
      : variant === 'danger'
        ? luxe.danger
        : variant === 'secondary'
          ? luxe.primaryContainer
          : 'transparent';
  const fg =
    variant === 'primary' || variant === 'danger' || variant === 'dark'
      ? luxe.onPrimary
      : variant === 'secondary'
        ? luxe.primaryDeep
        : luxe.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: luxe.outlineSoft, backgroundColor: glass.fill },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, small && { fontSize: 10 }, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color = luxe.primaryContainer,
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
          : { backgroundColor: glass.fill, borderColor: luxe.outlineSoft },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? luxe.primaryDeep : luxe.outline },
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
      <Text style={luxeType.subtitle}>{title}</Text>
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
      <Text style={{ fontSize: 30 }}>{emoji}</Text>
      <Text style={[luxeType.headlineItalic, { marginTop: spacing.md, textAlign: 'center' }]}>
        {title}
      </Text>
      {message ? (
        <Text
          style={[luxeType.body, { marginTop: spacing.sm, textAlign: 'center', maxWidth: 280 }]}
        >
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
    borderRadius: luxeRadius.pill,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { paddingVertical: 10, paddingHorizontal: spacing.lg },
  btnText: {
    fontFamily: font.label,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  chip: {
    borderRadius: luxeRadius.pill,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  chipText: { fontFamily: font.bodyMedium, fontSize: 12.5 },
  card: {
    backgroundColor: luxe.surface,
    borderRadius: luxeRadius.lg,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    padding: spacing.lg,
    ...luxeShadow.card,
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
    fontFamily: font.label,
    fontSize: 10.5,
    color: luxe.outline,
    marginBottom: 6,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
});
