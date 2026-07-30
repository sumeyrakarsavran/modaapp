import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BettaFish, Wave } from '@/components/BettaFish';
import { Button } from '@/components/UI';
import { useStore } from '@/store/useStore';
import { BETTA_ARCHETYPES, colors, radius, spacing, type } from '@/theme';

interface Question {
  q: string;
  options: { label: string; archetype: string }[];
}

const QUESTIONS: Question[] = [
  {
    q: 'Cumartesi akşamı davetlisin. Ne giyersin?',
    options: [
      { label: 'İpek gömlek + kalem etek, sade takı', archetype: 'halfmoon' },
      { label: 'Deri ceket + bot, biraz metal', archetype: 'crowntail' },
      { label: 'Uçuşan çiçekli elbise', archetype: 'veiltail' },
      { label: 'Renk renk desenli vintage bir şey', archetype: 'koi' },
    ],
  },
  {
    q: 'Gardırobında en çok hangisi var?',
    options: [
      { label: 'Siyah, gri ve deri', archetype: 'crowntail' },
      { label: 'Sneaker, tayt, hoodie', archetype: 'plakat' },
      { label: 'Bej, keten, oversize triko', archetype: 'dumbo' },
      { label: 'Zamansız klasikler', archetype: 'halfmoon' },
    ],
  },
  {
    q: 'Alışverişte seni en çok ne çeker?',
    options: [
      { label: 'Desen ve renk patlaması', archetype: 'koi' },
      { label: 'Dantel, fırfır, pastel tonlar', archetype: 'veiltail' },
      { label: 'Teknik kumaş, rahat kesim', archetype: 'plakat' },
      { label: 'Kaliteli, yıllarca giyilecek parça', archetype: 'halfmoon' },
    ],
  },
  {
    q: 'İdeal pazar günü kıyafetin?',
    options: [
      { label: 'Bol eşofman + crop', archetype: 'plakat' },
      { label: 'Yumuşacık triko + bol pantolon', archetype: 'dumbo' },
      { label: 'Salaş elbise + sandalet', archetype: 'veiltail' },
      { label: 'Siyah jean + eski rock tişörtü', archetype: 'crowntail' },
    ],
  },
  {
    q: 'İnsanlar tarzın için ne der?',
    options: [
      { label: '"Her zaman çok şık"', archetype: 'halfmoon' },
      { label: '"Cesur ve sıra dışı"', archetype: 'koi' },
      { label: '"Çok rahat görünüyorsun"', archetype: 'dumbo' },
      { label: '"Enerjik ve dinamik"', archetype: 'plakat' },
    ],
  },
  {
    q: 'Bir aksesuar seç:',
    options: [
      { label: 'İnce altın kolye', archetype: 'halfmoon' },
      { label: 'Zincirli bot / choker', archetype: 'crowntail' },
      { label: 'Saten fiyonk / çiçekli toka', archetype: 'veiltail' },
      { label: 'Renkli boncuklu el yapımı bileklik', archetype: 'koi' },
    ],
  },
];

export default function Quiz() {
  const setProfile = useStore((s) => s.setProfile);
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [resultId, setResultId] = useState<string | null>(null);

  const answer = (archetype: string) => {
    const next = { ...scores, [archetype]: (scores[archetype] ?? 0) + 1 };
    setScores(next);
    if (step + 1 < QUESTIONS.length) {
      setStep(step + 1);
    } else {
      const winner = BETTA_ARCHETYPES.map((a) => ({ a, s: next[a.id] ?? 0 })).sort(
        (x, y) => y.s - x.s,
      )[0].a;
      setResultId(winner.id);
      setProfile({ bettaArchetypeId: winner.id });
    }
  };

  const result = BETTA_ARCHETYPES.find((a) => a.id === resultId);

  if (result) {
    return (
      <LinearGradient colors={[colors.deep, result.color]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.resultWrap}>
            <BettaFish size={170} color="#fff" />
            <Text style={styles.resultTitle}>Sen bir {result.fish}sın!</Text>
            <Text style={styles.resultStyle}>
              {result.emoji} {result.styleName} stil
            </Text>
            <Wave width={220} color="rgba(255,255,255,0.4)" />
            <View style={styles.resultCard}>
              <Text style={[type.body, { textAlign: 'center', lineHeight: 22 }]}>
                {result.description}
              </Text>
            </View>
            <Button
              title="Harika, profilime işle 🐟"
              variant="dark"
              onPress={() => router.back()}
              style={{ marginTop: spacing.xl, minWidth: 240 }}
            />
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const q = QUESTIONS[step];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.inkSoft} />
        </Pressable>
        <Text style={type.subtitle}>Hangi betta'sın?</Text>
        <Text style={type.caption}>
          {step + 1}/{QUESTIONS.length}
        </Text>
      </View>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${((step + 1) / QUESTIONS.length) * 100}%` }]} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <Text style={[type.display, { fontSize: 26 }]}>{q.q}</Text>
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {q.options.map((o) => (
            <Pressable
              key={o.label}
              onPress={() => answer(o.archetype)}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.aquaSoft }]}
            >
              <Text style={[type.body, { fontWeight: '600' }]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
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
  progress: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.aqua, borderRadius: 3 },
  option: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  resultWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  resultTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  resultStyle: { fontSize: 18, color: 'rgba(255,255,255,0.9)', marginVertical: spacing.sm },
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: spacing.lg,
    maxWidth: 420,
  },
});
