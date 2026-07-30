import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BettaFish, Wave } from '@/components/BettaFish';
import { Button } from '@/components/UI';
import { useStore } from '@/store/useStore';
import { colors, radius, spacing, type } from '@/theme';

const FEATURES: { emoji: string; title: string; desc: string }[] = [
  {
    emoji: '🪞',
    title: 'FASHN AI Sanal Deneme',
    desc: 'Gardırobundaki kıyafetleri model fotoğrafının üzerinde gerçekçi şekilde gör — almadan önce üstünde dene hissi.',
  },
  {
    emoji: '✨',
    title: 'Sınırsız AI deneme hakkı',
    desc: 'Kombinlerini istediğin kadar farklı model ve pozla dene.',
  },
  {
    emoji: '🐠',
    title: 'Pro rozeti',
    desc: 'Toplulukta profilinde altın betta rozeti görünür.',
  },
  {
    emoji: '🚀',
    title: 'Yeni özelliklere erken erişim',
    desc: 'AI özellikler önce Pro üyelere açılır.',
  },
];

export default function Pro() {
  const { pro, setPro } = useStore();

  return (
    <LinearGradient colors={[colors.deep, '#0E4A5E', '#B8860B']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.close}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.container}>
          <BettaFish size={120} color={colors.gold} />
          <Text style={styles.logo}>BETTA PRO</Text>
          <Text style={styles.tagline}>Akvaryumun altın üyeliği 🏆</Text>
          <Wave width={200} color="rgba(255,255,255,0.35)" />

          <View style={styles.card}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <Text style={{ fontSize: 26 }}>{f.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={type.subtitle}>{f.title}</Text>
                  <Text style={[type.caption, { marginTop: 2 }]}>{f.desc}</Text>
                </View>
              </View>
            ))}

            {pro ? (
              <>
                <View style={styles.activeBox}>
                  <Text style={[type.subtitle, { color: colors.seagreen }]}>
                    ✔ Pro üyeliğin aktif
                  </Text>
                  <Text style={[type.tiny, { marginTop: 2 }]}>
                    Sanal deneme dahil tüm Pro özellikler açık.
                  </Text>
                </View>
                <Button
                  small
                  variant="ghost"
                  title="Pro'yu kapat (demo)"
                  onPress={() => setPro(false)}
                  style={{ marginTop: spacing.sm }}
                />
              </>
            ) : (
              <>
                <View style={styles.priceBox}>
                  <Text style={styles.price}>₺49,99<Text style={styles.priceUnit}> / ay</Text></Text>
                  <Text style={type.tiny}>İstediğin zaman iptal et</Text>
                </View>
                <Button
                  title="🏆 Pro'ya geç"
                  onPress={() => {
                    setPro(true);
                  }}
                  style={{ marginTop: spacing.md, backgroundColor: colors.gold }}
                />
                <Text style={[type.tiny, { textAlign: 'center', marginTop: spacing.sm }]}>
                  Demo sürüm: buton üyeliği hemen açar. Gerçek ödeme (uygulama içi satın alma)
                  yayınlanmadan önce bağlanacak.
                </Text>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: { alignItems: 'center', padding: spacing.xl, paddingTop: spacing.sm },
  logo: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: 6, marginTop: spacing.sm },
  tagline: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 440,
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  featureRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  priceBox: { alignItems: 'center', marginTop: spacing.sm },
  price: { fontSize: 30, fontWeight: '900', color: colors.ink },
  priceUnit: { fontSize: 15, fontWeight: '600', color: colors.inkSoft },
  activeBox: {
    backgroundColor: colors.seagreenSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
});
