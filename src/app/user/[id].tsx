import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Wave } from '@/components/BettaFish';
import { Avatar, PostCard, SpecCollage, KIND_LABEL, timeAgo } from '@/components/Community';
import { GarmentArt } from '@/components/GarmentArt';
import { Button, Card, Chip, EmptyState } from '@/components/UI';
import { PERSONAS, PERSONA_SHOWCASE } from '@/data/community';
import { useStore } from '@/store/useStore';
import { colors, getArchetype, radius, spacing, type } from '@/theme';

type Tab = 'gonderiler' | 'parcalar' | 'kombinler' | 'selfiler' | 'lookbooklar';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { posts, followedIds, profile, toggleFollow, toggleLike } = useStore();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('gonderiler');
  const user = PERSONAS.find((p) => p.id === id);

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ padding: spacing.xl }}>
          <Text style={type.subtitle}>Kullanıcı bulunamadı.</Text>
          <Button small title="Geri" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const arch = getArchetype(user.archetypeId);
  const followed = followedIds.includes(user.id);
  const showcase = PERSONA_SHOWCASE[user.id];
  const userPosts = posts
    .filter((p) => p.userId === user.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const outfitPosts = userPosts.filter((p) => p.kind === 'kombin');
  const selfiePosts = userPosts.filter((p) => p.kind === 'selfie');

  const counts: Record<Tab, number> = {
    gonderiler: userPosts.length,
    parcalar: showcase?.items.length ?? 0,
    kombinler: outfitPosts.length,
    selfiler: selfiePosts.length,
    lookbooklar: showcase?.lookbooks.length ?? 0,
  };

  const gridCell = (width - spacing.lg * 2 - spacing.sm * 2) / 3;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.inkSoft} />
        </Pressable>

        {/* Profil başlığı */}
        <View style={{ alignItems: 'center' }}>
          <Avatar user={user} size={96} />
          <Text style={[type.display, { marginTop: spacing.sm }]}>{user.name}</Text>
          <Text style={type.caption}>@{user.username}</Text>
          <Wave width={180} color={`${user.color}66`} />
          <Text style={[type.body, { textAlign: 'center', marginTop: spacing.sm, maxWidth: 300 }]}>
            {user.bio}
          </Text>
          <View style={styles.statsRow}>
            <View style={{ alignItems: 'center' }}>
              <Text style={type.title}>
                {(user.followers + (followed ? 1 : 0)).toLocaleString('tr-TR')}
              </Text>
              <Text style={type.tiny}>takipçi</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={type.title}>{userPosts.length}</Text>
              <Text style={type.tiny}>gönderi</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={type.title}>{counts.parcalar}</Text>
              <Text style={type.tiny}>parça</Text>
            </View>
          </View>
          <Button
            title={followed ? '✔ Takiptesin' : '+ Takip et'}
            variant={followed ? 'secondary' : 'primary'}
            onPress={() => toggleFollow(user.id)}
            style={{ marginTop: spacing.md, minWidth: 200 }}
          />
        </View>

        {arch ? (
          <Card style={{ marginTop: spacing.lg, backgroundColor: arch.colorSoft }}>
            <Text style={[type.subtitle, { color: arch.color }]}>
              {arch.emoji} {arch.fish} · {arch.styleName} stil
            </Text>
            <Text style={[type.tiny, { marginTop: 2 }]}>{arch.tagline}</Text>
          </Card>
        ) : null}

        {/* İçerik sekmeleri */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.lg }}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
        >
          <Chip label={`Gönderiler · ${counts.gonderiler}`} active={tab === 'gonderiler'} onPress={() => setTab('gonderiler')} />
          <Chip label={`Parçalar · ${counts.parcalar}`} active={tab === 'parcalar'} onPress={() => setTab('parcalar')} />
          <Chip label={`Kombinler · ${counts.kombinler}`} active={tab === 'kombinler'} onPress={() => setTab('kombinler')} />
          <Chip label={`Selfie'ler · ${counts.selfiler}`} active={tab === 'selfiler'} onPress={() => setTab('selfiler')} />
          <Chip label={`Lookbook'lar · ${counts.lookbooklar}`} active={tab === 'lookbooklar'} onPress={() => setTab('lookbooklar')} />
        </ScrollView>

        {/* ————— Gönderiler ————— */}
        {tab === 'gonderiler'
          ? userPosts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                me={profile}
                followed={followed}
                onToggleLike={() => toggleLike(p.id)}
                onToggleFollow={() => toggleFollow(user.id)}
                onOpenComments={() => router.push('/(tabs)/community')}
                onOpenUser={() => {}}
              />
            ))
          : null}

        {/* ————— Parçalar (public gardırop) ————— */}
        {tab === 'parcalar' ? (
          showcase?.items.length ? (
            <View style={styles.grid3}>
              {showcase.items.map((it) => (
                <View key={it.name} style={{ width: gridCell }}>
                  <View style={[styles.itemBox, { width: gridCell, height: gridCell }]}>
                    <GarmentArt category={it.category} subcategory={it.subcategory} colorId={it.colorId} size={gridCell * 0.66} />
                  </View>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {it.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState emoji="🐟" title="Henüz herkese açık parça yok" />
          )
        ) : null}

        {/* ————— Kombinler ————— */}
        {tab === 'kombinler' ? (
          outfitPosts.length ? (
            <View style={styles.grid2}>
              {outfitPosts.map((p) => (
                <View key={p.id} style={{ width: (width - spacing.lg * 3) / 2 }}>
                  <SpecCollage garments={p.garments} size={(width - spacing.lg * 3) / 2} />
                  <Text style={[type.tiny, { marginTop: 4 }]} numberOfLines={2}>
                    {p.caption}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState emoji="🎨" title="Henüz kombin paylaşmamış" />
          )
        ) : null}

        {/* ————— Selfie'ler ————— */}
        {tab === 'selfiler' ? (
          selfiePosts.length ? (
            selfiePosts.map((p) => (
              <Card key={p.id} style={{ marginBottom: spacing.md }}>
                <Text style={type.tiny}>
                  {KIND_LABEL[p.kind]} · {timeAgo(p.createdAt)}
                </Text>
                <View style={{ alignItems: 'center', marginVertical: spacing.sm }}>
                  <SpecCollage garments={p.garments} size={Math.min(width - spacing.lg * 4, 300)} />
                </View>
                <Text style={type.body}>{p.caption}</Text>
              </Card>
            ))
          ) : (
            <EmptyState emoji="🤳" title="Henüz selfie paylaşmamış" />
          )
        ) : null}

        {/* ————— Lookbook'lar ————— */}
        {tab === 'lookbooklar' ? (
          showcase?.lookbooks.length ? (
            showcase.lookbooks.map((lb) => (
              <Card key={lb.name} style={{ marginBottom: spacing.md }}>
                <Text style={type.subtitle}>
                  {lb.emoji} {lb.name}
                </Text>
                <Text style={[type.tiny, { marginBottom: spacing.sm }]}>
                  {lb.outfits.length} kombin
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {lb.outfits.map((o, i) => (
                      <SpecCollage key={i} garments={o} size={130} />
                    ))}
                  </View>
                </ScrollView>
              </Card>
            ))
          ) : (
            <EmptyState emoji="📖" title="Henüz lookbook paylaşmamış" />
          )
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statsRow: { flexDirection: 'row', gap: spacing.xxl, marginTop: spacing.md },
  grid3: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  itemBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.inkSoft,
    marginTop: 4,
    textAlign: 'center',
  },
});
