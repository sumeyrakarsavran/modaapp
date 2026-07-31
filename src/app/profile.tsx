import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BettaAvatar } from '@/components/BettaAvatar';
import { Wave } from '@/components/BettaFish';
import { FluidSpecCollage } from '@/components/Community';
import { Button, Card, Chip, SectionTitle } from '@/components/UI';
import { resizeForProcessing } from '@/services/imageResize';
import { photoFromParams, pickPhoto, type PickedPhoto } from '@/services/photoPicker';
import { persistGarmentPhoto } from '@/services/photoStore';
import { useStore } from '@/store/useStore';
import { colors, getArchetype, radius, spacing, type } from '@/theme';

export default function Profile() {
  const { profile, items, outfits, selfies, lookbooks, posts, followedIds, pro, setProfile } =
    useStore();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams();
  const myPosts = posts.filter((p) => p.userId === 'me');
  const arch = getArchetype(profile.bettaArchetypeId);
  const ringColor = arch?.color ?? colors.aqua;

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editBio, setEditBio] = useState(profile.bio ?? '');

  /** Avatarı kaydet — kırpma açık (kare kadraj), küçültülüp kalıcı saklanır. */
  const saveAvatarPhoto = async (photo: PickedPhoto) => {
    const small = await resizeForProcessing(photo.uri, photo.width, photo.height, 800);
    const saved = await persistGarmentPhoto(small).catch(() => small);
    setProfile({ avatarUri: saved });
  };

  const pickAvatar = async (fromCamera: boolean) => {
    const photo = await pickPhoto({ fromCamera, aspect: [1, 1], quality: 0.7, purpose: 'avatar' });
    if (photo) await saveAvatarPhoto(photo);
  };

  // Android'de süreç öldüyse kök layout avatarı parametreyle buraya yollar
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (recoveredRef.current) return;
    const photo = photoFromParams(params);
    if (!photo) return;
    recoveredRef.current = true;
    saveAvatarPhoto(photo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const changeAvatar = () => {
    const remove = () => setProfile({ avatarUri: undefined });
    if (Platform.OS === 'web') {
      pickAvatar(false);
      return;
    }
    Alert.alert('Profil fotoğrafı', undefined, [
      { text: '📷 Fotoğraf çek', onPress: () => pickAvatar(true) },
      { text: '🖼️ Galeriden seç', onPress: () => pickAvatar(false) },
      ...(profile.avatarUri
        ? [{ text: 'Fotoğrafı kaldır', style: 'destructive' as const, onPress: remove }]
        : []),
      { text: 'Vazgeç', style: 'cancel' as const },
    ]);
  };

  const saveEdit = () => {
    setProfile({ name: editName.trim() || profile.name, bio: editBio.trim() || undefined });
    setEditOpen(false);
  };

  const followers = profile.followers ?? 0;
  const postW = (width - spacing.lg * 2 - spacing.sm) / 2;

  const Stat = ({ n, label, onPress }: { n: number; label: string; onPress?: () => void }) => (
    <Pressable style={styles.stat} onPress={onPress} disabled={!onPress}>
      <Text style={type.title}>{n.toLocaleString('tr-TR')}</Text>
      <Text style={type.tiny}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Başlık: geri + ayarlar */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.inkSoft} />
        </Pressable>
        <Text style={type.subtitle}>Profil</Text>
        <Pressable onPress={() => router.push('/settings')} style={styles.iconBtn}>
          <Ionicons name="settings-outline" size={19} color={colors.inkSoft} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 50 }}>
        {/* Profil kartı */}
        <View style={styles.profileHead}>
          <Pressable onPress={changeAvatar}>
            <BettaAvatar size={112} color={ringColor} imageUri={profile.avatarUri} pro={pro} />
            <View style={[styles.editBadge, { borderColor: ringColor }]}>
              <Ionicons name="camera" size={15} color={ringColor} />
            </View>
          </Pressable>
          <Text style={[type.display, { marginTop: spacing.sm }]}>
            {profile.name || 'Betta'}
            {pro ? ' 🏆' : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={type.caption}>@{profile.username || 'betta'}</Text>
            <Chip
              label={profile.isPublic ? '🌐 Herkese açık' : '🔒 Gizli'}
              color={profile.isPublic ? colors.seagreen : colors.inkFaint}
              active={!!profile.isPublic}
              onPress={() => router.push('/settings')}
              style={{ paddingVertical: 3, paddingHorizontal: 9 }}
            />
          </View>

          {profile.bio ? (
            <Text style={[type.body, { textAlign: 'center', marginTop: spacing.sm, maxWidth: 320 }]}>
              {profile.bio}
            </Text>
          ) : null}

          <Button
            small
            variant="ghost"
            title={profile.bio ? '✏️ Profili düzenle' : '＋ Bio ekle'}
            onPress={() => {
              setEditName(profile.name);
              setEditBio(profile.bio ?? '');
              setEditOpen(true);
            }}
            style={{ marginTop: spacing.sm }}
          />
          <Wave width={200} />
        </View>

        {/* Sosyal sayaçlar */}
        <View style={styles.counters}>
          <Stat n={myPosts.length} label="Gönderi" />
          <View style={styles.divider} />
          <Stat n={followers} label="Takipçi" />
          <View style={styles.divider} />
          <Stat
            n={followedIds.length}
            label="Takip"
            onPress={() => router.push('/(tabs)/community')}
          />
        </View>

        {/* Gardırop sayaçları */}
        <View style={[styles.counters, { marginTop: spacing.sm }]}>
          <Stat
            n={items.filter((i) => !i.archived).length}
            label="Parça"
            onPress={() => router.push('/(tabs)/wardrobe')}
          />
          <Stat n={outfits.length} label="Kombin" onPress={() => router.push('/(tabs)/studio')} />
          <Stat n={selfies.length} label="Selfie" onPress={() => router.push('/(tabs)/wardrobe')} />
          <Stat n={lookbooks.length} label="Lookbook" onPress={() => router.push('/(tabs)/wardrobe')} />
        </View>

        {/* Betta kimliği */}
        {arch ? (
          <Card style={{ marginTop: spacing.lg, backgroundColor: arch.colorSoft }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Text style={{ fontSize: 40 }}>{arch.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[type.subtitle, { color: arch.color }]}>
                  {arch.fish} · {arch.styleName} stil
                </Text>
                <Text style={type.tiny}>{arch.tagline}</Text>
              </View>
            </View>
            <Text style={[type.caption, { marginTop: spacing.sm }]}>{arch.description}</Text>
            <Button
              small
              variant="ghost"
              title="Testi yeniden çöz"
              onPress={() => router.push('/quiz')}
              style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
            />
          </Card>
        ) : (
          <Card style={{ marginTop: spacing.lg, backgroundColor: colors.deep }} onPress={() => router.push('/quiz')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Text style={{ fontSize: 36 }}>🐠</Text>
              <View style={{ flex: 1 }}>
                <Text style={[type.subtitle, { color: '#fff' }]}>Hangi betta'sın?</Text>
                <Text style={[type.tiny, { color: 'rgba(255,255,255,0.75)' }]}>
                  2 dakikalık stil testiyle betta kimliğini keşfet.
                </Text>
              </View>
              <Text style={{ color: colors.aqua, fontSize: 22 }}>›</Text>
            </View>
          </Card>
        )}

        {/* Paylaşılan gönderiler */}
        <SectionTitle
          title={`Gönderilerin${myPosts.length ? ` (${myPosts.length})` : ''}`}
          style={{ marginTop: spacing.xl }}
        />
        {myPosts.length === 0 ? (
          <Card style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 34 }}>🫧</Text>
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.sm }]}>
              Henüz gönderi yok. Bir kombin, selfie ya da lookbook'u toplulukta paylaş — burada da
              görünsün.
            </Text>
            <Button
              small
              title="Topluluğa git"
              onPress={() => router.push('/(tabs)/community')}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        ) : (
          <View style={styles.postGrid}>
            {myPosts.map((p) => (
              <Pressable
                key={p.id}
                style={{ width: postW }}
                onPress={() => router.push('/(tabs)/community')}
              >
                {p.imageUri ? (
                  <Image
                    source={{ uri: p.imageUri }}
                    style={{ width: postW, height: postW, borderRadius: radius.md }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{ width: postW }}>
                    <FluidSpecCollage
                      garments={p.garments}
                      frame={p.canvasFrame}
                      cropToContent={p.cropToContent}
                    />
                  </View>
                )}
                <Text style={[type.tiny, { marginTop: 4 }]} numberOfLines={2}>
                  {p.caption}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={[type.tiny, { textAlign: 'center', marginTop: spacing.xl }]}>
          BETTA v1.0 · Gardırobun, akvaryumun kadar canlı 🐟
        </Text>
      </ScrollView>

      {/* Profili düzenle modalı (isim + bio) */}
      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior="padding"
        >
          <View style={styles.modalCard}>
            <SectionTitle
              title="Profili düzenle"
              right={<Chip label="Kapat" onPress={() => setEditOpen(false)} />}
            />
            <Text style={styles.label}>Ad</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Adın"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
            />
            <Text style={styles.label}>Bio</Text>
            <TextInput
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Kendini birkaç cümleyle anlat… 🐟"
              placeholderTextColor={colors.inkFaint}
              style={[styles.input, { minHeight: 84, textAlignVertical: 'top' }]}
              multiline
              maxLength={160}
            />
            <Text style={styles.counter}>{editBio.length}/160</Text>
            <Text style={[type.tiny, { marginTop: spacing.sm }]}>
              Kullanıcı adını ve gizlilik ayarını Ayarlar'dan değiştirebilirsin.
            </Text>
            <Button title="Kaydet" onPress={saveEdit} style={{ marginTop: spacing.md }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHead: { alignItems: 'center', marginTop: spacing.sm },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counters: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  stat: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 28, backgroundColor: colors.border },
  postGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modalWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSoft,
    marginBottom: 6,
    marginTop: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  counter: { fontSize: 11, color: colors.inkFaint, textAlign: 'right', marginTop: 4 },
});
