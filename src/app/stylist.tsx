import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BettaFish } from '@/components/BettaFish';
import { Chip } from '@/components/UI';
import { askClaude, localSuggest } from '@/services/stylist';
import { useWeather } from '@/hooks/useWeather';
import { useStore } from '@/store/useStore';
import { colors, radius, spacing, type } from '@/theme';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK = [
  'Bugün ne giysem?',
  'Yarın toplantım var, şık bir öneri?',
  'Hafta sonu için rahat bir kombin',
  'Gardırobumda eksik ne var?',
];

export default function Stylist() {
  const { items, outfits, api } = useStore();
  const { todayWeather } = useWeather();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content: api.anthropicKey
        ? 'Merhaba! Ben BETTA stilistin 🐟 Gardırobundaki her parçayı biliyorum. Bugün nasıl yardımcı olayım?'
        : 'Merhaba! Ben BETTA stilistin 🐟 Şu an yerel moddayım: hava durumuna ve renk uyumuna göre kombin önerebilirim. Ayarlar\'dan Claude API anahtarı eklersen seninle gerçekten sohbet edebilirim.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const localReply = (question: string): string => {
    const s = localSuggest(
      items.filter((i) => !i.archived),
      todayWeather,
    );
    if (!s) {
      return 'Gardırobunda henüz yeterli parça yok — önce birkaç üst, alt ve ayakkabı ekle, sonra sana süper kombinler önereyim 🐠';
    }
    const names = s.itemIds
      .map((id) => items.find((i) => i.id === id)?.name)
      .filter(Boolean)
      .map((n) => `• ${n}`)
      .join('\n');
    return `Şöyle bir kombin denedim:\n\n${names}\n\n${s.reason}\n\nBeğenmediysen tekrar sor, başka bir dalga göndereyim 🌊`;
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput('');
    const nextMsgs: Msg[] = [...messages, { role: 'user' as const, content }];
    setMessages(nextMsgs);
    setBusy(true);
    try {
      let reply: string;
      if (api.anthropicKey) {
        reply = await askClaude(
          api.anthropicKey,
          content,
          items,
          outfits,
          todayWeather,
          nextMsgs.slice(1, -1), // ilk karşılama mesajını atla
        );
      } else {
        await new Promise((r) => setTimeout(r, 400));
        reply = localReply(content);
      }
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `Bir sorun oldu: ${e?.message ?? 'bilinmeyen hata'}\n\nAnahtarını Ayarlar'dan kontrol edebilirsin.`,
        },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.inkSoft} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BettaFish size={34} color={colors.gold} />
          <View>
            <Text style={type.subtitle}>AI Stilist</Text>
            <Text style={type.tiny}>{api.anthropicKey ? 'Claude bağlı ✨' : 'Yerel mod'}</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={10}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m, i) => (
            <View
              key={i}
              style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}
            >
              <Text
                style={[
                  type.body,
                  { lineHeight: 21 },
                  m.role === 'user' && { color: '#fff' },
                ]}
              >
                {m.content}
              </Text>
            </View>
          ))}
          {busy ? (
            <View style={[styles.bubble, styles.aiBubble, { flexDirection: 'row', gap: 8 }]}>
              <ActivityIndicator size="small" color={colors.aquaDark} />
              <Text style={type.caption}>düşünüyor…</Text>
            </View>
          ) : null}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            alignItems: 'center',
          }}
          style={styles.quickBar}
        >
          {QUICK.map((q) => (
            <Chip key={q} label={q} onPress={() => send(q)} />
          ))}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Stilistine sor…"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            onSubmitEditing={() => send()}
            returnKeyType="send"
          />
          <Pressable onPress={() => send()} style={styles.sendBtn} disabled={busy}>
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.deep,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  /**
   * Hızlı öneri şeridi: sabit yükseklik + flexShrink 0.
   * Aksi halde sohbet uzadıkça esnek sütun bu şeridi dikeyde eziyor
   * ve çipler küçülüp kırpılıyordu.
   */
  quickBar: {
    flexGrow: 0,
    flexShrink: 0,
    height: 48,
    paddingBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.background,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.aqua,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
