import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { BettaFish } from '@/components/BettaFish';
import { FinBlob } from '@/components/FinBlob';
import { Button } from '@/components/UI';
import { isUsernameTaken } from '@/data/community';
import { useStore } from '@/store/useStore';
import { font, iridescent, luxe, luxeRadius, luxeType } from '@/theme/luxe';

export default function Onboarding() {
  const setProfile = useStore((s) => s.setProfile);
  const seedDemo = useStore((s) => s.seedDemo);
  const [name, setName] = useState('');

  const start = (withDemo: boolean) => {
    const trimmed = name.trim() || 'Betta';
    // Benzersiz kullanıcı adı üret (Türkçe karakterleri sadeleştir, çakışırsa numara ekle)
    const trMap: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
    let base = trimmed
      .toLowerCase()
      .replace(/[çğıöşü]/g, (c) => trMap[c] ?? c)
      .replace(/[^a-z0-9_]/g, '');
    if (base.length < 3) base = `betta${base}`;
    let username = base.slice(0, 20);
    if (isUsernameTaken(username)) {
      username = `${base.slice(0, 15)}${Math.floor(100 + Math.random() * 900)}`;
    }
    setProfile({
      name: trimmed,
      username,
      onboarded: true,
    });
    if (withDemo) seedDemo();
    router.replace('/(tabs)/today');
  };

  return (
    /*
      İlk ekran da uygulamanın FİLDİŞİ sayfası. Eski petrol gradyanı
      uygulamanın hiçbir yerinde yok; ilk izlenim ile içerisi çelişiyordu.
    */
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }}>
      <Backdrop />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Marka anı: iridesan leke + balık silueti, altında kelime markası */}
          <View style={styles.mark}>
            <FinBlob color={luxe.primaryContainer} gradient={iridescent.soft} shadow />
            <BettaFish size={126} color={luxe.primary} />
          </View>
          <Text style={styles.logo}>BETTA</Text>
          <Text style={styles.tagline}>Gardırobun, akvaryumun kadar canlı.</Text>

          <View style={styles.form}>
            <Text style={luxeType.label}>Sana ne diyelim?</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Adın"
              placeholderTextColor={luxe.outline}
              style={styles.input}
              autoCapitalize="words"
            />
            <Button
              title="Demo gardırobuyla başla"
              onPress={() => start(true)}
              style={{ marginTop: 18 }}
            />
            <Button
              title="Boş gardırop ile başla"
              variant="ghost"
              onPress={() => start(false)}
              style={{ marginTop: 8 }}
            />
            <Text style={styles.hint}>
              Her şey önce cihazında saklanır; istersen sonra Ayarlar&apos;dan buluta taşırsın.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  /** Balığın arkasındaki organik leke — blob gölge payını kutu İÇİNDE alıyor. */
  mark: {
    width: 210,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontFamily: font.display,
    fontSize: 42,
    letterSpacing: 12,
    color: luxe.primary,
    marginTop: 4,
    // Harf aralığı sağdan boşluk bırakıyor; başlık optik olarak ortalansın
    marginLeft: 12,
  },
  tagline: {
    fontFamily: font.headlineItalic,
    fontStyle: 'italic',
    fontSize: 15,
    color: luxe.inkSoft,
    marginTop: 8,
    textAlign: 'center',
  },
  form: { width: '100%', maxWidth: 420, marginTop: 34 },
  input: {
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginTop: 8,
    fontFamily: font.body,
    fontSize: 16,
    color: luxe.ink,
    backgroundColor: luxe.surface,
  },
  hint: {
    fontFamily: font.body,
    fontSize: 12,
    lineHeight: 18,
    color: luxe.outline,
    marginTop: 18,
    textAlign: 'center',
  },
});
