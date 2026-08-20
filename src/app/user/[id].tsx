import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { Avatar, FluidSpecCollage } from '@/components/Community';
import { GarmentArt } from '@/components/GarmentArt';
import { PERSONA_SHOWCASE, PERSONAS } from '@/data/community';
import { useStore } from '@/store/useStore';
import { getArchetype } from '@/theme';
import { font, glass, iridescent, luxe, luxeRadius, luxeType } from '@/theme/luxe';

/** Kendi profilimizdeki ızgarayla AYNI ölçüler — iki ekran aynı görünsün. */
const GRID_GAP = 5;
const GRID_PAD = 12;

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { posts, followedIds, toggleFollow } = useStore();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const user = PERSONAS.find((p) => p.id === id);

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
        <Backdrop />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={luxe.primary} />
          </Pressable>
        </View>
        <Text style={[luxeType.caption, { textAlign: 'center', marginTop: 40 }]}>
          Kullanıcı bulunamadı.
        </Text>
      </SafeAreaView>
    );
  }

  const arch = getArchetype(user.archetypeId);
  const followed = followedIds.includes(user.id);
  const showcase = PERSONA_SHOWCASE[user.id];
  const userPosts = posts
    .filter((p) => p.userId === user.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const cell = Math.floor((width - GRID_PAD * 2 - GRID_GAP * 2) / 3);

  const Stat = ({ n, label }: { n: number; label: string }) => (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{n.toLocaleString('tr-TR')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  /** Öne çıkanlar — kendi profilimizdeki halkaların aynısı. */
  const Highlight = ({
    icon,
    n,
    label,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    n: number;
    label: string;
  }) => (
    <View style={styles.hl}>
      <LinearGradient
        colors={iridescent.soft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hlRing}
      >
        <View style={styles.hlInner}>
          <Ionicons name={icon} size={17} color={luxe.primary} />
          <Text style={styles.hlCount}>{n}</Text>
        </View>
      </LinearGradient>
      <Text style={styles.hlLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={luxe.primary} />
        </Pressable>
        <Text style={styles.headerName} numberOfLines={1}>
          @{user.username}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + sayaçlar — kendi profilimizle aynı satır düzeni */}
        <View style={styles.topRow}>
          <Avatar user={user} size={84} />
          <View style={styles.stats}>
            <Stat n={userPosts.length} label="Gönderi" />
            <Stat n={user.followers + (followed ? 1 : 0)} label="Takipçi" />
            <Stat n={showcase?.items.length ?? 0} label="Parça" />
          </View>
        </View>

        <View style={styles.bioBlock}>
          <Text style={styles.name}>{user.name}</Text>
          {arch ? (
            <>
              <Text style={styles.archLine}>
                {arch.fish} · {arch.styleName} stil
              </Text>
              <Text style={styles.archNote} numberOfLines={2}>
                {arch.tagline}
              </Text>
            </>
          ) : null}
          {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
        </View>

        {/* Takip düğmesi — kendi profilimizdeki eylem satırının karşılığı */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.action, !followed && styles.actionSolid]}
            onPress={() => toggleFollow(user.id)}
          >
            <Text style={[styles.actionText, !followed && { color: luxe.onPrimary }]}>
              {followed ? 'Takiptesin' : 'Takip et'}
            </Text>
          </Pressable>
        </View>

        {/* Herkese açık gardırobu — öne çıkanlar halkaları */}
        {showcase ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hlRow}
          >
            <Highlight icon="shirt-outline" n={showcase.items.length} label="Parça" />
            <Highlight
              icon="albums-outline"
              n={userPosts.filter((p) => p.kind === 'kombin').length}
              label="Kombin"
            />
            <Highlight
              icon="happy-outline"
              n={userPosts.filter((p) => p.kind === 'selfie').length}
              label="Selfie"
            />
            <Highlight icon="book-outline" n={showcase.lookbooks.length} label="Lookbook" />
          </ScrollView>
        ) : null}

        {/* Gönderiler — dokununca kart hâlinde açılıyor (kendi profildeki gibi) */}
        <View style={styles.gridTop} />
        {userPosts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="images-outline" size={26} color={luxe.outlineSoft} />
            <Text style={[luxeType.caption, { marginTop: 10 }]}>Henüz gönderi paylaşmamış.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {userPosts.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.cell, { width: cell, height: cell }]}
                onPress={() =>
                  router.push({ pathname: '/post/[id]', params: { id: p.id, user: user.id } })
                }
              >
                {p.imageUri ? (
                  <Image
                    source={{ uri: p.imageUri }}
                    style={{ width: cell, height: cell }}
                    contentFit="contain"
                  />
                ) : (
                  <View style={{ width: cell }}>
                    <FluidSpecCollage
                      garments={p.garments}
                      frame={p.canvasFrame}
                      cropToContent={p.cropToContent}
                      bare
                    />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Herkese açık parçalar — persona'nın vitrini */}
        {showcase?.items.length ? (
          <>
            <Text style={styles.sectionLabel}>HERKESE AÇIK PARÇALAR</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingHorizontal: GRID_PAD }}
            >
              {showcase.items.map((it) => (
                <View key={it.name} style={{ width: 92 }}>
                  <View style={styles.itemBox}>
                    <GarmentArt
                      category={it.category}
                      subcategory={it.subcategory}
                      colorId={it.colorId}
                      size={60}
                    />
                  </View>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {it.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>
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
  headerName: { flex: 1, fontFamily: font.bodyMedium, fontSize: 16, color: luxe.ink },

  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 18 },
  stats: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: font.display, fontSize: 19, lineHeight: 24, color: luxe.primary },
  statLabel: { fontFamily: font.body, fontSize: 11.5, color: luxe.outline },

  bioBlock: { paddingHorizontal: 18, marginTop: 14, gap: 2 },
  name: { fontFamily: font.headline, fontSize: 18, color: luxe.primary },
  archLine: {
    fontFamily: font.label,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: luxe.outline,
    marginTop: 3,
  },
  archNote: {
    fontFamily: font.body,
    fontStyle: 'italic',
    fontSize: 12.5,
    color: luxe.outline,
    marginTop: 2,
  },
  bio: { fontFamily: font.body, fontSize: 13.5, lineHeight: 20, color: luxe.inkSoft, marginTop: 6 },

  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 14 },
  action: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.sm,
    paddingVertical: 9,
  },
  actionSolid: { backgroundColor: luxe.primary, borderColor: luxe.primary },
  actionText: { fontFamily: font.bodyMedium, fontSize: 12.5, color: luxe.primary },

  hlRow: { gap: 18, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  hl: { alignItems: 'center', width: 68, gap: 5 },
  hlRing: { width: 62, height: 62, borderRadius: 31, padding: 2 },
  hlInner: {
    flex: 1,
    borderRadius: 29,
    backgroundColor: luxe.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hlCount: { fontFamily: font.display, fontSize: 13, color: luxe.primary, marginTop: 1 },
  hlLabel: { fontFamily: font.body, fontSize: 11, color: luxe.outline },

  gridTop: { height: 14, borderTopWidth: 1, borderTopColor: luxe.outlineSoft, marginTop: 14 },
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
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
  },

  sectionLabel: {
    fontFamily: font.label,
    fontSize: 9.5,
    letterSpacing: 1.3,
    color: luxe.outline,
    paddingHorizontal: GRID_PAD,
    marginTop: 26,
    marginBottom: 10,
  },
  itemBox: {
    width: 92,
    height: 92,
    backgroundColor: luxe.surface,
    borderRadius: luxeRadius.md,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontFamily: font.body,
    fontSize: 11,
    color: luxe.outline,
    marginTop: 5,
    textAlign: 'center',
  },

  empty: { alignItems: 'center', paddingVertical: 42 },
});
