import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, PostCard, resolveUser, timeAgo } from '@/components/Community';
import { ProfileButton } from '@/components/ProfileButton';
import { Button, Chip, EmptyState, SectionTitle } from '@/components/UI';
import { PERSONAS } from '@/data/community';
import { useStore } from '@/store/useStore';
import { colors, radius, spacing, type } from '@/theme';
import type { CommunityPost } from '@/types';

type Filter = 'hepsi' | 'takip' | 'kombin' | 'selfie' | 'lookbook';

export default function Community() {
  const { posts, followedIds, profile, toggleFollow, toggleLike, addComment, deletePost } =
    useStore();
  const [filter, setFilter] = useState<Filter>('hepsi');
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  // Yorum modalı alt sistem çubuğunun altında kalmasın
  const insets = useSafeAreaInsets();
  // Klavye açıkken KeyboardAvoidingView zaten klavye yüksekliği kadar boşluk
  // ekliyor ve bu yükseklik alt çubuğu KAPSIYOR — üstüne insets.bottom da
  // eklenirse çift sayılıp arada boşluk kalıyor.
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const me = profile;
  const inviteCode = `BETTA-${(profile.username || 'BETTA').toUpperCase().slice(0, 12)}`;
  const inviteMessage =
    `🐟 BETTA'ya katıl! Gardırobunu dijitalleştir, kombinlerini paylaş, ` +
    `hangi betta olduğunu keşfet. Davet kodum: ${inviteCode}`;

  const feed = useMemo(() => {
    const sorted = [...posts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    switch (filter) {
      case 'takip':
        return sorted.filter((p) => followedIds.includes(p.userId) || p.userId === 'me');
      case 'kombin':
      case 'selfie':
      case 'lookbook':
        return sorted.filter((p) => p.kind === filter);
      default:
        return sorted;
    }
  }, [posts, filter, followedIds]);

  const commentPost = posts.find((p) => p.id === commentsFor);

  // Kullanıcı adı araması (@ işareti olsa da olmasa da)
  const q = userQuery.trim().toLowerCase().replace(/^@/, '');
  const searchResults = q
    ? PERSONAS.filter(
        (u) => u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q),
      )
    : [];

  const invite = async () => {
    if (Platform.OS === 'web') {
      const nav = navigator as any;
      if (nav.share) {
        try {
          await nav.share({ title: 'BETTA', text: inviteMessage });
          return;
        } catch {
          /* kullanıcı iptal etti — panoya düş */
        }
      }
      try {
        await nav.clipboard?.writeText(inviteMessage);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Pano erişimi yoksa kodu ekranda göstermeye devam et
      }
    } else {
      await Share.share({ message: inviteMessage });
    }
  };

  const sendComment = () => {
    if (!commentsFor || !commentText.trim()) return;
    addComment(commentsFor, commentText.trim());
    setCommentText('');
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <FlatList
        data={feed}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <Text style={type.display}>Topluluk</Text>
                <Text style={type.caption}>Diğer bettalar ne giyiyor? 🐠</Text>
              </View>
              <Pressable onPress={() => setInviteOpen(true)} style={styles.inviteBtn}>
                <Ionicons name="person-add-outline" size={16} color="#fff" />
                <Text style={styles.inviteBtnText}>Davet et</Text>
              </Pressable>
              <View style={{ marginLeft: spacing.sm }}>
                <ProfileButton />
              </View>
            </View>

            {/* Kullanıcı arama */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={colors.inkFaint} />
              <TextInput
                value={userQuery}
                onChangeText={setUserQuery}
                placeholder="@kullanıcıadı ile arkadaşlarını bul…"
                placeholderTextColor={colors.inkFaint}
                style={styles.searchInput}
                autoCapitalize="none"
              />
              {userQuery ? (
                <Pressable onPress={() => setUserQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.inkFaint} />
                </Pressable>
              ) : null}
            </View>
            {userQuery ? (
              <View style={{ marginTop: spacing.sm }}>
                {searchResults.length === 0 ? (
                  <View style={styles.noResult}>
                    <Text style={type.caption}>"@{q}" bulunamadı.</Text>
                    <Text style={[type.tiny, { marginTop: 4 }]}>
                      Arkadaşın henüz BETTA'da olmayabilir — davet kodunu gönder, katıldığında
                      kullanıcı adıyla bulup takip edebilirsin. Senin adresin: @
                      {profile.username || 'betta'}
                    </Text>
                    <Button
                      small
                      title="💌 Davet gönder"
                      onPress={() => setInviteOpen(true)}
                      style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
                    />
                  </View>
                ) : (
                  searchResults.map((u) => {
                    const followed = followedIds.includes(u.id);
                    return (
                      <Pressable
                        key={u.id}
                        style={styles.resultRow}
                        onPress={() => router.push({ pathname: '/user/[id]', params: { id: u.id } })}
                      >
                        <Avatar user={u} size={44} />
                        <View style={{ flex: 1 }}>
                          <Text style={[type.subtitle, { fontSize: 15 }]}>{u.name}</Text>
                          <Text style={type.tiny}>
                            @{u.username} · {(u.followers / 1000).toFixed(1)}b takipçi
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => toggleFollow(u.id)}
                          style={[styles.miniFollow, followed && { backgroundColor: colors.background }]}
                        >
                          <Text
                            style={{
                              fontSize: 11.5,
                              fontWeight: '700',
                              color: followed ? colors.inkSoft : '#fff',
                            }}
                          >
                            {followed ? 'Takiptesin' : 'Takip et'}
                          </Text>
                        </Pressable>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}

            {/* Önerilen kullanıcılar */}
            <SectionTitle title="Bettalar" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.sm }}>
                {PERSONAS.map((u) => {
                  const followed = followedIds.includes(u.id);
                  return (
                    <View key={u.id} style={styles.userCard}>
                      <Avatar
                        user={u}
                        size={52}
                        onPress={() => router.push({ pathname: '/user/[id]', params: { id: u.id } })}
                      />
                      <Text style={[type.caption, { fontWeight: '700', color: colors.ink }]} numberOfLines={1}>
                        {u.name}
                      </Text>
                      <Text style={type.tiny} numberOfLines={1}>
                        {(u.followers / 1000).toFixed(1)}b takipçi
                      </Text>
                      <Pressable
                        onPress={() => toggleFollow(u.id)}
                        style={[
                          styles.miniFollow,
                          followed && { backgroundColor: colors.background },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: followed ? colors.inkSoft : '#fff',
                          }}
                        >
                          {followed ? 'Takiptesin' : 'Takip et'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {/* Filtreler */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.md }}>
                <Chip label="Hepsi" emoji="🌊" active={filter === 'hepsi'} onPress={() => setFilter('hepsi')} />
                <Chip label="Takip ettiklerim" emoji="💙" active={filter === 'takip'} onPress={() => setFilter('takip')} />
                <Chip label="Kombinler" emoji="🎨" active={filter === 'kombin'} onPress={() => setFilter('kombin')} />
                <Chip label="Selfie'ler" emoji="🤳" active={filter === 'selfie'} onPress={() => setFilter('selfie')} />
                <Chip label="Lookbook'lar" emoji="📖" active={filter === 'lookbook'} onPress={() => setFilter('lookbook')} />
              </View>
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            emoji="🫧"
            title="Bu filtrede gönderi yok"
            message={
              filter === 'takip'
                ? 'Henüz kimseyi takip etmiyorsun — yukarıdan birkaç betta seç.'
                : 'Başka bir filtre dene.'
            }
          />
        }
        renderItem={({ item: p }) => (
          <PostCard
            post={p}
            me={me}
            followed={followedIds.includes(p.userId)}
            onToggleLike={() => toggleLike(p.id)}
            onToggleFollow={() => toggleFollow(p.userId)}
            onOpenComments={() => setCommentsFor(p.id)}
            onOpenUser={() =>
              p.userId === 'me'
                ? router.push('/profile')
                : router.push({ pathname: '/user/[id]', params: { id: p.userId } })
            }
            /*
              Lookbook kapağına dokununca kaynağa git. Başkasının lookbook'u
              bizim store'umuzda yok — onun profiline gidiliyor (lookbook sekmesi orada).
            */
            onOpenLookbook={
              p.lookbookId
                ? () =>
                    p.userId === 'me'
                      ? router.push({ pathname: '/lookbook/[id]', params: { id: p.lookbookId! } })
                      : router.push({ pathname: '/user/[id]', params: { id: p.userId } })
                : undefined
            }
            onDelete={p.userId === 'me' ? () => deletePost(p.id) : undefined}
          />
        )}
      />

      {/*
        Yorumlar modalı.
        `edgeToEdgeEnabled=true` iken sistem pencereyi klavye için yeniden
        boyutlandırmaz; modal içindeki yazı alanı klavyenin altında kalıp
        tıklanamıyordu. Çözüm: KeyboardAvoidingView (Android'de de "padding")
        + alt güvenli alan boşluğu. `statusBarTranslucent`/`navigationBarTranslucent`
        modalın tam ekranı kaplayıp yüksekliği doğru ölçmesi için gerekli.
      */}
      <Modal
        visible={!!commentsFor}
        animationType="slide"
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setCommentsFor(null)}
      >
        <KeyboardAvoidingView style={styles.modalWrap} behavior="padding">
          <View style={[styles.modalCard, { paddingBottom: spacing.lg + (keyboardUp ? 0 : insets.bottom) }]}>
            <SectionTitle
              title={`Yorumlar (${commentPost?.comments.length ?? 0})`}
              right={<Chip label="Kapat" onPress={() => setCommentsFor(null)} />}
            />
            <ScrollView style={{ maxHeight: 340 }}>
              {commentPost?.comments.length ? (
                commentPost.comments.map((c) => {
                  const u = resolveUser(c.userId, me);
                  return (
                    <View key={c.id} style={styles.commentRow}>
                      <Avatar user={u} size={32} />
                      <View style={{ flex: 1 }}>
                        <Text style={[type.caption, { fontWeight: '700', color: colors.ink }]}>
                          {u.name} <Text style={type.tiny}>· {timeAgo(c.createdAt)}</Text>
                        </Text>
                        <Text style={[type.body, { fontSize: 14 }]}>{c.text}</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={[type.caption, { paddingVertical: spacing.lg, textAlign: 'center' }]}>
                  İlk yorumu sen yap 🫧
                </Text>
              )}
            </ScrollView>
            <View style={styles.commentInputRow}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Yorum yaz…"
                placeholderTextColor={colors.inkFaint}
                style={styles.commentInput}
                onSubmitEditing={sendComment}
                returnKeyType="send"
              />
              <Pressable onPress={sendComment} style={styles.sendBtn}>
                <Ionicons name="arrow-up" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Davet modalı */}
      <Modal visible={inviteOpen} animationType="fade" transparent onRequestClose={() => setInviteOpen(false)}>
        <View style={[styles.modalWrap, { justifyContent: 'center', padding: spacing.xl }]}>
          <View style={[styles.modalCard, { borderRadius: radius.xl }]}>
            <Text style={{ fontSize: 40, textAlign: 'center' }}>🐟💌</Text>
            <Text style={[type.title, { textAlign: 'center', marginTop: spacing.sm }]}>
              Arkadaşlarını davet et
            </Text>
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.sm }]}>
              Akvaryum kalabalıklaştıkça güzelleşir. Davet kodunu paylaş, arkadaşların katılsın.
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{inviteCode}</Text>
            </View>
            <Button
              title={copied ? '✔ Panoya kopyalandı' : '📤 Daveti paylaş'}
              onPress={invite}
              style={{ marginTop: spacing.lg }}
            />
            <Button
              small
              variant="ghost"
              title="Kapat"
              onPress={() => setInviteOpen(false)}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    marginTop: spacing.md,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: colors.ink, padding: 0 },
  noResult: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.coral,
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  inviteBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  userCard: {
    width: 120,
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  miniFollow: {
    backgroundColor: colors.aqua,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  modalWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    fontSize: 14.5,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.aqua,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBox: {
    backgroundColor: colors.aquaSoft,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.aqua,
    borderStyle: 'dashed',
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  codeText: { fontSize: 20, fontWeight: '900', letterSpacing: 3, color: colors.aquaDark },
});
