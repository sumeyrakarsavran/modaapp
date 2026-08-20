import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { CommentsModal } from '@/components/CommentsModal';
import { PostCard } from '@/components/Community';
import { useStore } from '@/store/useStore';
import { font, luxe, luxeType } from '@/theme/luxe';
import type { CommunityPost } from '@/types';

/**
 * Gönderi görüntüleyici — Instagram'da ızgaradan bir kareye dokununca açılan
 * ekranın karşılığı: kişinin gönderileri tam kart hâlinde alt alta, dokunulan
 * gönderiden başlayarak. Kaydırarak diğerlerine geçiliyor.
 *
 * Tek bir gönderiyi ayrı ekranda göstermek yerine LİSTE açılıyor; Instagram da
 * böyle yapıyor ve "bir sonrakine bakayım" isteği ekstra dokunuş istemiyor.
 */
export default function PostViewer() {
  const { id, user } = useLocalSearchParams<{ id: string; user?: string }>();
  const { posts, profile, followedIds, toggleLike, toggleFollow, deletePost, lookbooks } =
    useStore();
  const insets = useSafeAreaInsets();
  const [commentsFor, setCommentsFor] = useState<string | null>(null);

  /** Kimin gönderileri: `user` verilmişse onunkiler, yoksa tüm akış. */
  const feed = useMemo(() => {
    const all = user ? posts.filter((p) => p.userId === user) : posts;
    return [...all].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [posts, user]);

  /*
    Liste DOKUNULAN GÖNDERİDEN başlıyor, öncekiler hiç çizilmiyor.
    Önce tüm akış veriliyor ve `initialScrollIndex` ile o gönderiye
    kaydırılıyordu: üstteki kartlar da ölçülmek zorunda kaldığı için açılış
    gecikiyordu (telefonda görüldü). Zaten geriye bakmaya da gerek yok —
    kullanıcı ileri kaydırıyor.
  */
  const startIndex = Math.max(
    0,
    feed.findIndex((p) => p.id === id),
  );
  const visible = useMemo(() => feed.slice(startIndex), [feed, startIndex]);

  const owner = feed[startIndex];
  const title = owner?.userId === 'me' ? 'Gönderilerin' : 'Gönderiler';

  /**
   * Lookbook gönderisinden kaynağa gitme — Topluluk'takiyle aynı davranış.
   * Eski gönderilerde `lookbookId` yok; o zaman başlıktan en uzun eşleşmeyle
   * bulunuyor.
   */
  const openLookbook = (p: CommunityPost) => {
    let lbId = p.lookbookId;
    if (!lbId) {
      const match = [...lookbooks]
        .filter((lb) => p.caption.toLocaleLowerCase('tr').includes(lb.name.toLocaleLowerCase('tr')))
        .sort((a, b) => b.name.length - a.name.length)[0];
      lbId = match?.id;
    }
    if (lbId) router.push({ pathname: '/lookbook/[id]', params: { id: lbId } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={luxe.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      {visible.length === 0 ? (
        <Text style={[luxeType.caption, { textAlign: 'center', marginTop: 40 }]}>
          Gönderi bulunamadı.
        </Text>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          /* İlk kart hemen görünsün, kalanı kaydırdıkça çizilsin. */
          initialNumToRender={1}
          windowSize={3}
          renderItem={({ item: p }) => (
            <PostCard
              post={p}
              me={profile}
              followed={followedIds.includes(p.userId)}
              onToggleLike={() => toggleLike(p.id)}
              onToggleFollow={() => toggleFollow(p.userId)}
              onOpenComments={() => setCommentsFor(p.id)}
              onOpenUser={() =>
                p.userId === 'me'
                  ? router.push('/(tabs)/profile')
                  : router.push({ pathname: '/user/[id]', params: { id: p.userId } })
              }
              onDelete={p.userId === 'me' ? () => deletePost(p.id) : undefined}
              onOpenLookbook={p.kind === 'lookbook' ? () => openLookbook(p) : undefined}
            />
          )}
        />
      )}

      <CommentsModal postId={commentsFor} onClose={() => setCommentsFor(null)} />
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
  headerTitle: { fontFamily: font.bodyMedium, fontSize: 16, color: luxe.ink },
});
