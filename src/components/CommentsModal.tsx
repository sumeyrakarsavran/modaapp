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

import { Avatar, resolveUser, timeAgo } from '@/components/Community';
import { useStore } from '@/store/useStore';
import { font, luxe, luxeRadius, luxeType } from '@/theme/luxe';

/**
 * Yorumlar sayfası — Topluluk ve gönderi görüntüleyici AYNI bileşeni
 * kullanıyor. İki yerde ayrı kopya durursa biri düzelip diğeri geride kalıyor.
 */
export function CommentsModal({
  postId,
  onClose,
}: {
  /** Açık olduğu gönderi; `null` ise kapalı. */
  postId: string | null;
  onClose: () => void;
}) {
  const posts = useStore((s) => s.posts);
  const me = useStore((s) => s.profile);
  const addComment = useStore((s) => s.addComment);
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  /*
    Klavye AÇIKKEN `insets.bottom` EKLENMEZ: KeyboardAvoidingView'ın eklediği
    klavye yüksekliği alt çubuğu zaten kapsıyor, üstüne inset binince arada
    boşluk kalıyor.
  */
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const post = posts.find((p) => p.id === postId);

  const send = () => {
    if (!postId || !text.trim()) return;
    addComment(postId, text.trim());
    setText('');
  };

  return (
    <Modal
      visible={!!postId}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.wrap} behavior="padding">
        <View style={[styles.card, { paddingBottom: 20 + (keyboardUp ? 0 : insets.bottom) }]}>
          <View style={styles.head}>
            <Text style={styles.title}>Yorumlar</Text>
            <Text style={luxeType.label}>{post?.comments.length ?? 0}</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={luxe.outline} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
            {post?.comments.length ? (
              post.comments.map((c) => {
                const u = resolveUser(c.userId, me);
                return (
                  <View key={c.id} style={styles.row}>
                    <Avatar user={u} size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>
                        {u.name} <Text style={luxeType.tiny}>· {timeAgo(c.createdAt)}</Text>
                      </Text>
                      <Text style={styles.text}>{c.text}</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>İlk yorumu sen yaz.</Text>
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Yorum yaz…"
              placeholderTextColor={luxe.outline}
              style={styles.input}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <Pressable onPress={send} style={styles.send}>
              <Ionicons name="arrow-up" size={18} color={luxe.onPrimary} />
            </Pressable>
          </View>
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
    padding: 20,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 6 },
  title: {
    fontFamily: font.headlineItalic,
    fontStyle: 'italic',
    fontSize: 20,
    color: luxe.primary,
  },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 9, alignItems: 'flex-start' },
  name: { fontFamily: font.bodyMedium, fontSize: 13, color: luxe.ink },
  text: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: luxe.inkSoft, marginTop: 1 },
  emptyText: {
    fontFamily: font.body,
    fontSize: 13,
    color: luxe.outline,
    textAlign: 'center',
    paddingVertical: 24,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontFamily: font.body,
    fontSize: 14.5,
    color: luxe.ink,
    backgroundColor: luxe.surface,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: luxe.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
