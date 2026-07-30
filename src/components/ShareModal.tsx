import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Chip, SectionTitle } from '@/components/UI';
import { colors, radius, spacing, type } from '@/theme';

/** Toplulukta paylaşırken kendi metnini yazabildiğin modal. */
export function ShareModal({
  visible,
  defaultCaption,
  onShare,
  onClose,
  preview,
}: {
  visible: boolean;
  defaultCaption: string;
  onShare: (caption: string) => void;
  onClose: () => void;
  preview?: React.ReactNode;
}) {
  const [text, setText] = useState(defaultCaption);

  // Modal her açıldığında öneri metnini tazele
  useEffect(() => {
    if (visible) setText(defaultCaption);
  }, [visible, defaultCaption]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <SectionTitle
            title="🌊 Toplulukta paylaş"
            right={<Chip label="Kapat" onPress={onClose} />}
          />
          <ScrollView keyboardShouldPersistTaps="handled">
            {preview ? (
              <View style={{ alignItems: 'center', marginBottom: spacing.md }}>{preview}</View>
            ) : null}
            <Text style={styles.label}>Paylaşım metni</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Bir şeyler yaz… (örn. bugünkü favori kombinim 🐟)"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              multiline
              autoFocus
              maxLength={280}
            />
            <Text style={styles.counter}>{text.length}/280</Text>
          </ScrollView>
          <Button
            title="Paylaş"
            onPress={() => onShare(text.trim() || defaultCaption)}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  card: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSoft,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.card,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  counter: { fontSize: 11, color: colors.inkFaint, textAlign: 'right', marginTop: 4 },
});
