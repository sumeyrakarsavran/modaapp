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

import { BTN_PAD, FinBlob } from '@/components/FinBlob';
import cityData from '@/data/cities.json';
import { useStore } from '@/store/useStore';
import { font, luxe, luxeRadius, luxeType } from '@/theme/luxe';
import type { PostPlace } from '@/types';

interface CityRow {
  n: string;
  c: string;
  x: number;
  y: number;
  p: number;
}
const CITIES = (cityData as { cities: CityRow[] }).cities;

/**
 * Toplulukta paylaşırken kendi metnini yazabildiğin modal.
 *
 * ŞEHİR ZORUNLU: global harita paylaşımları yere oturtuyor, yersiz gönderi
 * haritada hiç görünmüyor. Profilde şehir varsa (hava durumu için zaten
 * seçili) hazır geliyor, yoksa paylaşmadan önce seçtiriliyor.
 */
export function ShareModal({
  visible,
  defaultCaption,
  onShare,
  onClose,
  preview,
}: {
  visible: boolean;
  defaultCaption: string;
  onShare: (caption: string, place: PostPlace) => void;
  onClose: () => void;
  preview?: React.ReactNode;
}) {
  const [text, setText] = useState(defaultCaption);
  const profile = useStore((s) => s.profile);
  const [place, setPlace] = useState<PostPlace | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [picking, setPicking] = useState(false);
  const insets = useSafeAreaInsets();
  const [keyboardUp, setKeyboardUp] = useState(false);

  // Modal her açıldığında öneri metnini ve yeri tazele
  useEffect(() => {
    if (!visible) return;
    setText(defaultCaption);
    setCityQuery('');
    setPicking(false);
    setPlace(
      profile.city && profile.lat != null && profile.lon != null
        ? { lat: profile.lat, lon: profile.lon, city: profile.city }
        : null,
    );
  }, [visible, defaultCaption, profile.city, profile.lat, profile.lon]);

  /** Şehir arama — harita ile aynı listeden (585 şehir). */
  const matches = React.useMemo(() => {
    const q = cityQuery.trim().toLocaleLowerCase('tr');
    if (q.length < 2) return [];
    return CITIES.filter((c) => c.n.toLocaleLowerCase('tr').startsWith(q)).slice(0, 8);
  }, [cityQuery]);

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

            {/* Yer: haritada nereye düşeceği */}
            <Text style={[luxeType.label, { marginTop: 14 }]}>Şehir</Text>
            {place && !picking ? (
              <View style={styles.placeRow}>
                <Ionicons name="location-outline" size={15} color={luxe.primary} />
                <Text style={styles.placeText}>{place.city}</Text>
                <Pressable onPress={() => setPicking(true)} hitSlop={8}>
                  <Text style={styles.changeText}>Değiştir</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <TextInput
                  value={cityQuery}
                  onChangeText={setCityQuery}
                  placeholder="Şehir ara…"
                  placeholderTextColor={luxe.outline}
                  style={[styles.input, { minHeight: 0, marginTop: 6 }]}
                  autoCapitalize="words"
                />
                {matches.map((c) => (
                  <Pressable
                    key={`${c.n}-${c.c}`}
                    style={styles.cityRow}
                    onPress={() => {
                      setPlace({ lat: c.y, lon: c.x, city: c.n });
                      setPicking(false);
                      setCityQuery('');
                    }}
                  >
                    <Ionicons name="location-outline" size={15} color={luxe.outline} />
                    <Text style={styles.cityRowText}>
                      {c.n} <Text style={{ color: luxe.outline }}>· {c.c}</Text>
                    </Text>
                  </Pressable>
                ))}
                {cityQuery.trim().length >= 2 && matches.length === 0 ? (
                  <Text style={[luxeType.tiny, { marginTop: 8 }]}>
                    Bulunamadı — şehrin adını Türkçe ya da İngilizce dene.
                  </Text>
                ) : null}
              </>
            )}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}
            disabled={!place}
            onPress={() => place && onShare(text.trim() || defaultCaption, place)}
          >
            <FinBlob
              shadow
              pad={BTN_PAD}
              variant="button"
              color={place ? luxe.primary : luxe.primarySoft}
            />
            <Text style={styles.shareText}>{place ? 'Paylaş' : 'Önce şehir seç'}</Text>
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
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
  },
  placeText: { flex: 1, fontFamily: font.bodyMedium, fontSize: 14.5, color: luxe.ink },
  changeText: { fontFamily: font.bodyMedium, fontSize: 12.5, color: luxe.primary },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: luxe.outlineSoft,
  },
  cityRowText: { fontFamily: font.body, fontSize: 14, color: luxe.ink },
  shareBtn: {
    marginTop: 16,
    paddingVertical: 13 + BTN_PAD,
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
