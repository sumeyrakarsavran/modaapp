import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { BTN_PAD, FinBlob } from '@/components/FinBlob';
import { Chip } from '@/components/UI';
import { askClaude, localSuggest } from '@/services/stylist';
import { useWeather } from '@/hooks/useWeather';
import { useStore } from '@/store/useStore';
import { font, glass, luxe, luxeRadius, luxeType } from '@/theme/luxe';

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
        ? 'Merhaba! Ben BETTA stilistin. Gardırobundaki her parçayı biliyorum — bugün nasıl yardımcı olayım?'
        : 'Merhaba! Ben BETTA stilistin. Şu an yerel moddayım: hava durumuna ve renk uyumuna göre kombin önerebilirim. Ayarlar\'dan Claude API anahtarı eklersen seninle gerçekten sohbet edebilirim.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  /*
    Alt boşluk: klavye AÇIKKEN `insets.bottom` EKLENMEZ — KeyboardAvoidingView'in
    eklediği klavye yüksekliği alt çubuğu zaten kapsıyor, yoksa çift sayılıp
    arada boşluk kalıyor (paylaşım kutusunda da aynı kural).
  */
  const [keyboardUp, setKeyboardUp] = useState(false);
  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const localReply = (question: string): string => {
    const s = localSuggest(
      items.filter((i) => !i.archived),
      todayWeather,
    );
    if (!s) {
      return 'Gardırobunda henüz yeterli parça yok — önce birkaç üst, alt ve ayakkabı ekle, sonra sana kombin önereyim.';
    }
    const names = s.itemIds
      .map((id) => items.find((i) => i.id === id)?.name)
      .filter(Boolean)
      .map((n) => `• ${n}`)
      .join('\n');
    return `Şöyle bir kombin denedim:\n\n${names}\n\n${s.reason}\n\nBeğenmediysen tekrar sor, başkasını çıkarayım.`;
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
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      {/* Bugün · Gardırop · Stüdyo ile AYNI zemin */}
      <Backdrop />

      {/* Başlık: diğer yığın ekranlarıyla aynı dil — serif ad, sağda kapat */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={luxeType.display}>AI Stilist</Text>
          <Text style={styles.state}>{api.anthropicKey ? 'Claude bağlı' : 'Yerel mod'}</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.close} hitSlop={8}>
          <Ionicons name="close" size={20} color={luxe.primary} />
        </Pressable>
      </View>

      {/*
        behavior Android'de de "padding" OLMALI. `edgeToEdgeEnabled=true` iken
        sistem pencereyi klavye için yeniden boyutlandırmaz (uygulama sistem
        çubuklarının ARKASINA çizer), yani manifest'teki `adjustResize` tek
        başına yetmez: yazı alanı klavyenin altında kalıp görünmez oluyordu.
      */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 12 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m, i) => (
            <View
              key={i}
              style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}
            >
              <Text
                style={[
                  luxeType.body,
                  { lineHeight: 22 },
                  m.role === 'user' ? styles.userText : { color: luxe.ink },
                ]}
              >
                {m.content}
              </Text>
            </View>
          ))}
          {busy ? (
            <View style={[styles.bubble, styles.aiBubble, styles.thinking]}>
              <ActivityIndicator size="small" color={luxe.primary} />
              <Text style={luxeType.caption}>düşünüyor…</Text>
            </View>
          ) : null}
        </ScrollView>

        {/*
          Hızlı öneri şeridi: sabit yükseklik + flexShrink 0.
          Aksi halde sohbet uzadıkça esnek sütun bu şeridi dikeyde eziyor
          ve çipler küçülüp kırpılıyordu.
        */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20, alignItems: 'center' }}
          style={styles.quickBar}
          keyboardShouldPersistTaps="handled"
        >
          {QUICK.map((q) => (
            <Chip key={q} label={q} onPress={() => send(q)} />
          ))}
        </ScrollView>

        <View style={[styles.inputRow, { paddingBottom: 12 + (keyboardUp ? 0 : insets.bottom) }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Stilistine sor…"
            placeholderTextColor={luxe.outline}
            style={styles.input}
            onSubmitEditing={() => send()}
            returnKeyType="send"
          />
          <Pressable onPress={() => send()} style={styles.send} disabled={busy}>
            {/* Gönder de elle kesilmiş siluet — düğme dilinin küçük hâli */}
            <FinBlob variant="pebble" color={luxe.primary} shadow pad={BTN_PAD} />
            <Ionicons name="arrow-up" size={19} color={luxe.onPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  state: { ...luxeType.label, marginTop: 2 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: glass.fill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: luxeRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  /** Stilist: cam yüzey, sol alt köşe kısa — konuşma balonu hissi. */
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: glass.border,
    borderBottomLeftRadius: 8,
  },
  /** Kullanıcı: mürekkep dolgu, sağ alt köşe kısa. */
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: luxe.primary,
    borderBottomRightRadius: 8,
  },
  userText: { color: luxe.onPrimary, fontFamily: font.body },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickBar: { flexGrow: 0, flexShrink: 0, height: 48, paddingBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: luxe.outlineSoft,
    backgroundColor: glass.fillStrong,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontFamily: font.body,
    fontSize: 15,
    color: luxe.ink,
    backgroundColor: luxe.surface,
  },
  send: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
