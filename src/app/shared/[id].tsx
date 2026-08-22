import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { FluidSpecCollage, resolveUser } from '@/components/Community';
import { LookbookViewer, type LookbookSet } from '@/components/LookbookViewer';
import { useStore } from '@/store/useStore';
import { font, luxe, luxeRadius, luxeType } from '@/theme/luxe';

/** Kendi profilimizdeki ızgarayla AYNI ölçüler. */
const GRID_GAP = 5;
const GRID_PAD = 12;

/**
 * PAYLAŞILAN lookbook — gönderideki lookbook kartına dokununca açılıyor.
 *
 * Sahibinin lookbook ekranına (`/lookbook/[id]`) gidiliyordu; orada düzenleme,
 * silme, paylaşma var. Ama bu bir GÖNDERİ: herkesin gördüğü hâli görünmeli.
 * Burası salt görünür — içerik gönderinin kendi kaydından (`outfitSets`)
 * geliyor, yani paylaşıldığı andaki hâli; sonradan gardıropta değişse bile
 * gönderi değişmiyor.
 */
export default function SharedLookbook() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { posts, lookbooks, profile } = useStore();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [lbView, setLbView] = useState<{ index: number } | null>(null);

  const post = posts.find((p) => p.id === id);
  const cell = Math.floor((width - GRID_PAD * 2 - GRID_GAP * 2) / 3);

  if (!post) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
        <Backdrop />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={luxe.primary} />
          </Pressable>
        </View>
        <Text style={[luxeType.caption, { textAlign: 'center', marginTop: 40 }]}>
          Gönderi bulunamadı.
        </Text>
      </SafeAreaView>
    );
  }

  const user = resolveUser(post.userId, {
    name: profile.name,
    username: profile.username,
    archetypeId: profile.bettaArchetypeId,
    avatarUri: profile.avatarUri,
  });
  /* Eski gönderilerde `outfitSets` yok; düz liste tek kombin sayılıyor. */
  const sets: LookbookSet[] = post.outfitSets?.length
    ? post.outfitSets
    : [{ garments: post.garments }];
  const name = lookbooks.find((lb) => lb.id === post.lookbookId)?.name ?? post.caption;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={luxe.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Lookbook
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.meta}>
            @{user.username} · {sets.length} KOMBİN
          </Text>
        </View>

        {/* Üç sütun — profildeki gönderi ızgarasının aynısı */}
        <View style={styles.grid}>
          {sets.map((set, i) => (
            <Pressable
              key={i}
              style={[styles.cell, { width: cell, height: cell }]}
              onPress={() => setLbView({ index: i })}
            >
              <FluidSpecCollage
                garments={set?.garments ?? []}
                frame={set?.canvasFrame}
                cropToContent={set?.cropToContent}
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <LookbookViewer
        title={name}
        sets={sets}
        index={lbView?.index ?? null}
        onIndex={(i) => setLbView({ index: i })}
        onClose={() => setLbView(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerTitle: { flex: 1, fontFamily: font.bodyMedium, fontSize: 16, color: luxe.ink },
  intro: { paddingHorizontal: 18, paddingBottom: 14, gap: 4 },
  name: {
    fontFamily: font.headlineItalic,
    fontStyle: 'italic',
    fontSize: 21,
    lineHeight: 28,
    color: luxe.primary,
  },
  meta: {
    fontFamily: font.label,
    fontSize: 9.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: luxe.outline,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: GRID_PAD,
  },
  cell: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: luxe.surface,
    borderRadius: luxeRadius.md,
  },
});
