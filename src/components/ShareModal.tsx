import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, luxe, luxeRadius, luxeType } from '@/theme/luxe';

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
  const insets = useSafeAreaInsets();
  const [keyboardUp, setKeyboardUp] = useState(false);

  // Modal her açıldığında öneri metnini tazele
  useEffect(() => {
    if (visible) setText(defaultCaption);
  }, [visible, defaultCaption]);

  // Alt boşluk: klavye AÇIKKEN insets.bottom ekleme — KeyboardAvoidingView'in
  // eklediği klavye yüksekliği alt çubuğu zaten kapsıyor, yoksa çift sayılır.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.wrap} behavior="padding">
        <View style={[styles.card, { paddingBottom: 22 + (keyboardUp ? 0 : insets.bottom) }]}>
          {/* Başlık: italik serif + kapat — diğer alt sayfalarla aynı dil */}
          <View style={styles.head}>
            <Text style={styles.title}>Toplulukta paylaş</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={luxe.outline} />
            </Pressable>
          </View>

          {/*
            flexShrink: 1 ŞART. Kart `maxHeight: '85%'` ile sınırlı; klavye
            açılınca kullanılabilir alan daralıyor ve sınırsız ScrollView
            büyüyüp altındaki "Paylaş" düğmesini kartın dışına itiyordu.
            (Stilistteki hızlı öneri çubuğunda da aynı hata vardı.)
          */}
          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
            {preview ? <View style={{ marginBottom: 16 }}>{preview}</View> : null}
            <Text style={luxeType.label}>Paylaşım metni</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Bir şeyler yaz…"
              placeholderTextColor={luxe.outline}
              style={styles.input}
              multiline
              autoFocus
              maxLength={280}
            />
            <Text style={styles.counter}>{text.length}/280</Text>
          </ScrollView>

          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}
            onPress={() => onShare(text.trim() || defaultCaption)}
          >
            <Text style={styles.shareText}>Paylaş</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: luxe.overlay, justifyContent: 'flex-end' },
  card: {
    backgroundColor: luxe.bg,
    borderTopLeftRadius: luxeRadius.lg,
    borderTopRightRadius: luxeRadius.lg,
    padding: 22,
    // paddingBottom satır içinde veriliyor (güvenli alan + klavye durumu)
    maxHeight: '85%',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontFamily: font.headlineItalic,
    fontStyle: 'italic',
    fontSize: 20,
    color: luxe.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 6,
    fontFamily: font.body,
    fontSize: 15,
    color: luxe.ink,
    backgroundColor: luxe.surface,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  counter: {
    fontFamily: font.body,
    fontSize: 11,
    color: luxe.outline,
    textAlign: 'right',
    marginTop: 4,
  },
  shareBtn: {
    marginTop: 16,
    backgroundColor: luxe.primary,
    borderRadius: luxeRadius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  shareText: {
    fontFamily: font.label,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: luxe.onPrimary,
  },
});
