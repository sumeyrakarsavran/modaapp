import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { Avatar } from '@/components/Community';
import { BTN_PAD, FinBlob } from '@/components/FinBlob';
import { PERSONAS } from '@/data/community';
import { useStore } from '@/store/useStore';
import { font, glass, luxe, luxeType } from '@/theme/luxe';
import type { CommunityUser } from '@/types';

/**
 * Takipçi / takip edilen listesi — Instagram'daki sayaçlara dokununca açılan
 * ekran.
 *
 * Takip edilenler GERÇEK veriden geliyor (`followedIds`). Takipçiler yerel bir
 * SAYI (`profile.followers`); kim oldukları bilinmiyor, bu yüzden uydurma
 * satır gösterilmiyor — sayı 0 iken liste boş kalıyor.
 */
export default function People() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const followers = mode === 'followers';
  const { followedIds, toggleFollow, profile } = useStore();

  const data: CommunityUser[] = followers
    ? []
    : PERSONAS.filter((p) => followedIds.includes(p.id));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />
      <View style={styles.header}>
        {/* Liste ekranı: başlık diğer yığın ekranlarındaki kadar iri değil */}
        <Text style={[luxeType.headline, { flex: 1 }]}>
          {followers ? 'Takipçiler' : 'Takip edilenler'}
        </Text>
        <Pressable onPress={() => router.back()} style={styles.close} hitSlop={8}>
          <Ionicons name="close" size={20} color={luxe.primary} />
        </Pressable>
      </View>

      <FlatList
        data={data}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 4 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={28} color={luxe.outlineSoft} />
            <Text style={[luxeType.body, { marginTop: 10, textAlign: 'center' }]}>
              {followers
                ? `${profile.followers ?? 0} takipçi. Kimler olduğu bulut hesapla birlikte görünecek.`
                : 'Henüz kimseyi takip etmiyorsun.'}
            </Text>
          </View>
        }
        renderItem={({ item: u }) => {
          const following = followedIds.includes(u.id);
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: u.id } })}
            >
              <Avatar user={u} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {u.name}
                </Text>
                <Text style={luxeType.tiny} numberOfLines={1}>
                  @{u.username}
                </Text>
              </View>
              <Pressable
                onPress={() => toggleFollow(u.id)}
                style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
              >
                <FinBlob
                  variant="button"
                  shadow={!following}
                  pad={BTN_PAD}
                  color={following ? glass.fill : luxe.primary}
                  stroke={following ? luxe.outlineSoft : undefined}
                />
                <Text style={[styles.btnText, { color: following ? luxe.primary : luxe.onPrimary }]}>
                  {following ? 'Takiptesin' : 'Takip et'}
                </Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  name: { fontFamily: font.bodyMedium, fontSize: 15, color: luxe.ink },
  btn: {
    paddingVertical: 8 + BTN_PAD,
    paddingHorizontal: 12 + BTN_PAD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: font.label,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
});
