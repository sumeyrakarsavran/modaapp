import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BettaFish, Wave } from '@/components/BettaFish';
import { Button } from '@/components/UI';
import { isUsernameTaken } from '@/data/community';
import { useStore } from '@/store/useStore';
import { colors, radius, spacing } from '@/theme';

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
    <LinearGradient colors={[colors.deep, colors.deepSoft, '#0E6E86']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.fishRow}>
              <BettaFish size={150} color={colors.aqua} />
            </View>
            <Text style={styles.logo}>BETTA</Text>
            <Text style={styles.tagline}>Gardırobun, akvaryumun kadar canlı.</Text>
            <Wave width={220} color="rgba(255,255,255,0.35)" />

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sana ne diyelim?</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Adın"
                placeholderTextColor={colors.inkFaint}
                style={styles.input}
                autoCapitalize="words"
              />
              <Button
                title="🐟 Demo gardırobuyla başla"
                onPress={() => start(true)}
                style={{ marginTop: spacing.lg }}
              />
              <Button
                title="Boş gardırop ile başla"
                variant="secondary"
                onPress={() => start(false)}
                style={{ marginTop: spacing.sm }}
              />
              <Text style={styles.hint}>
                Her şey önce cihazında saklanır. İstersen sonra Ayarlar'dan Supabase hesabına
                bağlayıp buluta taşıyabilirsin.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  fishRow: { marginBottom: -10 },
  logo: {
    fontSize: 52,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 10,
  },
  tagline: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    marginTop: 6,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
    marginTop: spacing.xl,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: spacing.md },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.background,
  },
  hint: {
    fontSize: 12,
    color: colors.inkFaint,
    marginTop: spacing.lg,
    textAlign: 'center',
    lineHeight: 17,
  },
});
