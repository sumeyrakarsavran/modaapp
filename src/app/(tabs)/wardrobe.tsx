import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
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

import { ItemThumb } from '@/components/ItemThumb';
import { OutfitCollage } from '@/components/OutfitCollage';
import { ProfileButton } from '@/components/ProfileButton';
import { ShareModal } from '@/components/ShareModal';
import { Button, Chip, EmptyState, SectionTitle } from '@/components/UI';
import { resizeForProcessing } from '@/services/imageResize';
import { photoFromParams, pickPhoto, type PickedPhoto } from '@/services/photoPicker';
import { persistGarmentPhoto } from '@/services/photoStore';
import { useStore } from '@/store/useStore';
import { colors, radius, spacing, type } from '@/theme';
import { CATEGORIES, todayISO, type Category, type Selfie, type WardrobeItem } from '@/types';

type Section = 'parcalar' | 'kombinler' | 'selfiler' | 'lookbooklar';

const LOOKBOOK_EMOJIS = ['📖', '🌊', '🌙', '🔥', '🌸', '⚡', '🎨', '☁️', '✨', '🐟'];

export default function Wardrobe() {
  const {
    items, outfits, selfies, lookbooks,
    addSelfie, deleteSelfie, addLookbook, sharePost,
  } = useStore();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams();
  const [section, setSection] = useState<Section>('parcalar');

  // Parçalar filtreleri
  const [category, setCategory] = useState<Category | 'hepsi'>('hepsi');
  const [query, setQuery] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Selfie görüntüleme + paylaşım
  const [openSelfie, setOpenSelfie] = useState<Selfie | null>(null);
  const [shareSelfieOpen, setShareSelfieOpen] = useState<Selfie | null>(null);

  // Lookbook oluşturma
  const [lbModal, setLbModal] = useState(false);
  const [lbName, setLbName] = useState('');
  const [lbEmoji, setLbEmoji] = useState('📖');

  const cols = width > 700 ? 5 : 3;
  const thumb = (Math.min(width, 700) - spacing.lg * 2 - spacing.sm * (cols - 1)) / cols;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    return items.filter((i) => {
      if (i.archived !== showArchived) return false;
      if (category !== 'hepsi' && i.category !== category) return false;
      if (onlyFav && !i.favorite) return false;
      if (q) {
        const hay = `${i.name} ${i.brand ?? ''} ${i.tags.join(' ')}`.toLocaleLowerCase('tr');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, category, query, onlyFav, showArchived]);

  /** Selfie ekle — kırpma açık (dikey kadraj), kalıcı kopya saklanır. */
  const saveSelfiePhoto = async (photo: PickedPhoto) => {
    const small = await resizeForProcessing(photo.uri, photo.width, photo.height, 1400);
    const saved = await persistGarmentPhoto(small).catch(() => small);
    addSelfie({ imageUri: saved, date: todayISO() });
  };

  const takeSelfie = async (fromCamera: boolean) => {
    const photo = await pickPhoto({ fromCamera, aspect: [3, 4], quality: 0.6, purpose: 'selfie' });
    if (photo) await saveSelfiePhoto(photo);
  };

  // Android'de süreç öldüyse kök layout selfie'yi parametreyle buraya yollar
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (recoveredRef.current) return;
    const photo = photoFromParams(params);
    if (!photo) return;
    recoveredRef.current = true;
    setSection('selfiler');
    saveSelfiePhoto(photo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const confirmDeleteSelfie = (s: Selfie) => {
    const doDelete = () => {
      deleteSelfie(s.id);
      setOpenSelfie(null);
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Selfie silinsin mi?')) doDelete();
    } else {
      Alert.alert('Selfie sil', 'Bu selfie silinsin mi?', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const doShareSelfie = (caption: string) => {
    const s = shareSelfieOpen;
    if (!s) return;
    sharePost({
      kind: 'selfie',
      caption,
      garments: [],
      imageUri: s.imageUri,
      archetypeId: useStore.getState().profile.bettaArchetypeId,
    });
    setShareSelfieOpen(null);
    setOpenSelfie(null);
    // Modal kapanışı işlensin, sonra git (ekran donmadan önce)
    setTimeout(() => router.push('/(tabs)/community'), 120);
  };

  const createLookbook = () => {
    if (!lbName.trim()) return;
    const lb = addLookbook({ name: lbName.trim(), emoji: lbEmoji, outfitIds: [] });
    setLbModal(false);
    setLbName('');
    // Modal kapanışı işlensin, sonra git (ekran donmadan önce)
    setTimeout(() => router.push({ pathname: '/lookbook/[id]', params: { id: lb.id } }), 80);
  };

  const counts = {
    parcalar: items.filter((i) => !i.archived).length,
    kombinler: outfits.length,
    selfiler: selfies.length,
    lookbooklar: lookbooks.length,
  };

  const SectionTab = ({ id, label }: { id: Section; label: string }) => (
    <Pressable
      onPress={() => setSection(id)}
      style={[styles.sectionTab, section === id && styles.sectionTabActive]}
    >
      <Text style={[styles.sectionTabText, section === id && { color: '#fff' }]}>
        {label} · {counts[id]}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={type.display}>Gardırop</Text>
        </View>
        {section === 'parcalar' ? (
          <Button small title="+ Ekle" onPress={() => router.push('/item/new')} />
        ) : section === 'kombinler' ? (
          <Button small title="+ Kombin" onPress={() => router.push('/(tabs)/studio')} />
        ) : section === 'selfiler' ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button small title="📷" onPress={() => takeSelfie(true)} />
            <Button small variant="secondary" title="🖼️" onPress={() => takeSelfie(false)} />
          </View>
        ) : (
          <Button small title="+ Lookbook" onPress={() => setLbModal(true)} />
        )}
        <View style={{ marginLeft: spacing.sm }}>
          <ProfileButton />
        </View>
      </View>

      {/* Bölüm sekmeleri — sabit yükseklik: liste büyüyünce ezilmesin */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sectionTabsBar}
        contentContainerStyle={{
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
        }}
      >
        <SectionTab id="parcalar" label="Parçalar" />
        <SectionTab id="kombinler" label="Kombinler" />
        <SectionTab id="selfiler" label="Selfie'ler" />
        <SectionTab id="lookbooklar" label="Lookbook'lar" />
      </ScrollView>

      {/* ————— PARÇALAR ————— */}
      {section === 'parcalar' ? (
        <>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={colors.inkFaint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Ara: isim, marka, etiket…"
                placeholderTextColor={colors.inkFaint}
                style={styles.searchInput}
              />
            </View>
            <Pressable onPress={() => setOnlyFav((v) => !v)} style={styles.iconBtn}>
              <Ionicons
                name={onlyFav ? 'heart' : 'heart-outline'}
                size={20}
                color={onlyFav ? colors.coral : colors.inkSoft}
              />
            </Pressable>
            <Pressable onPress={() => setShowArchived((v) => !v)} style={styles.iconBtn}>
              <Ionicons
                name={showArchived ? 'archive' : 'archive-outline'}
                size={19}
                color={showArchived ? colors.aquaDark : colors.inkSoft}
              />
            </Pressable>
          </View>
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <Chip label="Hepsi" emoji="🌊" active={category === 'hepsi'} onPress={() => setCategory('hepsi')} />
              {CATEGORIES.map((c) => (
                <Chip
                  key={c.id}
                  label={c.label}
                  emoji={c.emoji}
                  active={category === c.id}
                  onPress={() => setCategory(c.id)}
                />
              ))}
            </ScrollView>
          </View>
          {filtered.length === 0 ? (
            <EmptyState
              emoji={showArchived ? '🗄️' : '🐟'}
              title={showArchived ? 'Arşiv boş' : 'Burada henüz bir şey yok'}
              message={showArchived ? 'Arşivlediğin parçalar burada görünür.' : 'İlk parçanı ekle.'}
              action={
                !showArchived ? (
                  <Button small title="+ Parça ekle" onPress={() => router.push('/item/new')} />
                ) : undefined
              }
            />
          ) : (
            <FlatList
              key={`items-${cols}`}
              data={filtered}
              numColumns={cols}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}
              columnWrapperStyle={{ gap: spacing.sm }}
              renderItem={({ item }) => (
                <ItemThumb
                  item={item}
                  size={thumb}
                  showName
                  onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
                />
              )}
            />
          )}
        </>
      ) : null}

      {/* ————— KOMBİNLER ————— */}
      {section === 'kombinler' ? (
        outfits.length === 0 ? (
          <EmptyState
            emoji="🎨"
            title="Henüz kombin yok"
            message={'Stüdyo\'daki "Giydir beni" ya da Canvas ile ilk kombinini oluştur.'}
            action={<Button small title="Stüdyoya git" onPress={() => router.push('/(tabs)/studio')} />}
          />
        ) : (
          <FlatList
            key="outfits"
            data={outfits}
            keyExtractor={(o) => o.id}
            numColumns={2}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
            columnWrapperStyle={{ gap: spacing.lg }}
            renderItem={({ item: o }) => {
              const its = o.itemIds
                .map((x) => items.find((i) => i.id === x))
                .filter(Boolean) as WardrobeItem[];
              return (
                <Pressable
                  style={{ flex: 1, maxWidth: '48%' }}
                  onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: o.id } })}
                >
                  <OutfitCollage items={its} size={(width - spacing.lg * 3) / 2} layout={o.layout} frame={o.canvasFrame} cropToContent={o.cropToContent} />
                  <Text style={[type.caption, { marginTop: 4 }]} numberOfLines={1}>
                    {o.favorite ? '❤️ ' : ''}
                    {o.name}
                  </Text>
                </Pressable>
              );
            }}
          />
        )
      ) : null}

      {/* ————— SELFIE'LER ————— */}
      {section === 'selfiler' ? (
        selfies.length === 0 ? (
          <EmptyState
            emoji="🤳"
            title="Henüz selfie yok"
            message="Günün kombiniyle ayna selfie'si çek, gardırobun canlı arşivin olsun."
            action={
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button small title="📷 Çek" onPress={() => takeSelfie(true)} />
                <Button small variant="secondary" title="🖼️ Galeriden" onPress={() => takeSelfie(false)} />
              </View>
            }
          />
        ) : (
          <FlatList
            key={`selfies-${cols}`}
            data={selfies}
            numColumns={cols}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
            columnWrapperStyle={{ gap: spacing.sm }}
            renderItem={({ item: s }) => (
              <Pressable onPress={() => setOpenSelfie(s)}>
                <Image
                  source={{ uri: s.imageUri }}
                  style={{ width: thumb, height: thumb * 1.25, borderRadius: radius.md }}
                  contentFit="cover"
                />
                <Text style={type.tiny}>{s.date}</Text>
              </Pressable>
            )}
          />
        )
      ) : null}

      {/* ————— LOOKBOOK'LAR ————— */}
      {section === 'lookbooklar' ? (
        lookbooks.length === 0 ? (
          <EmptyState
            emoji="📖"
            title="Henüz lookbook yok"
            message='Kombinlerini temalara ayır: "Ofis", "Yaz tatili", "Konser geceleri"…'
            action={<Button small title="+ İlk lookbook'unu oluştur" onPress={() => setLbModal(true)} />}
          />
        ) : (
          <FlatList
            key="lookbooks"
            data={lookbooks}
            keyExtractor={(l) => l.id}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
            renderItem={({ item: lb }) => {
              const firstOutfit = outfits.find((o) => lb.outfitIds.includes(o.id));
              const its = firstOutfit
                ? (firstOutfit.itemIds
                    .map((x) => items.find((i) => i.id === x))
                    .filter(Boolean) as WardrobeItem[])
                : [];
              return (
                <Pressable
                  style={styles.lbCard}
                  onPress={() => router.push({ pathname: '/lookbook/[id]', params: { id: lb.id } })}
                >
                  {its.length ? (
                    <OutfitCollage items={its} size={84} layout={firstOutfit?.layout} frame={firstOutfit?.canvasFrame} cropToContent={firstOutfit?.cropToContent} />
                  ) : (
                    <View style={styles.lbEmpty}>
                      <Text style={{ fontSize: 30 }}>{lb.emoji}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={type.subtitle}>
                      {lb.emoji} {lb.name}
                    </Text>
                    <Text style={type.tiny}>{lb.outfitIds.length} kombin</Text>
                    {lb.description ? (
                      <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={1}>
                        {lb.description}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
                </Pressable>
              );
            }}
          />
        )
      ) : null}

      {/* Selfie görüntüleme modalı */}
      <Modal visible={!!openSelfie} animationType="fade" transparent onRequestClose={() => setOpenSelfie(null)}>
        <View style={[styles.modalWrap, { justifyContent: 'center', padding: spacing.lg }]}>
          <View style={styles.selfieModal}>
            {openSelfie ? (
              <>
                <Image
                  source={{ uri: openSelfie.imageUri }}
                  style={{ width: '100%', height: 380, borderRadius: radius.lg }}
                  contentFit="cover"
                />
                <Text style={[type.caption, { marginTop: spacing.sm }]}>{openSelfie.date}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
                  <Button small title="🌊 Toplulukta paylaş" onPress={() => setShareSelfieOpen(openSelfie)} />
                  <Button small variant="danger" title="Sil" onPress={() => confirmDeleteSelfie(openSelfie)} />
                  <Button small variant="ghost" title="Kapat" onPress={() => setOpenSelfie(null)} />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Lookbook oluşturma modalı */}
      <Modal visible={lbModal} animationType="slide" transparent onRequestClose={() => setLbModal(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.lbModal}>
            <SectionTitle title="Yeni lookbook" right={<Chip label="Kapat" onPress={() => setLbModal(false)} />} />
            <TextInput
              value={lbName}
              onChangeText={setLbName}
              placeholder='Örn. "Yaz tatili", "Ofis haftası"'
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              autoFocus
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
              {LOOKBOOK_EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setLbEmoji(e)}
                  style={[styles.emojiBtn, lbEmoji === e && styles.emojiBtnActive]}
                >
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <Button title="Oluştur" onPress={createLookbook} disabled={!lbName.trim()} style={{ marginTop: spacing.lg }} />
          </View>
        </View>
      </Modal>

      <ShareModal
        visible={!!shareSelfieOpen}
        defaultCaption={shareSelfieOpen?.note || 'Bugünün aynası 🤳🐟'}
        preview={
          shareSelfieOpen ? (
            <Image
              source={{ uri: shareSelfieOpen.imageUri }}
              style={{ width: 150, height: 190, borderRadius: radius.lg }}
              contentFit="cover"
            />
          ) : undefined
        }
        onClose={() => setShareSelfieOpen(null)}
        onShare={doShareSelfie}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionTabsBar: {
    flexGrow: 0,
    flexShrink: 0,
    height: 48,
  },
  sectionTab: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  sectionTabActive: { backgroundColor: colors.deep, borderColor: colors.deep },
  sectionTabText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: colors.ink, padding: 0 },
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
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  lbCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  lbEmpty: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    backgroundColor: colors.aquaSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  selfieModal: {
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  lbModal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
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
  emojiBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnActive: { borderColor: colors.aqua, backgroundColor: colors.aquaSoft },
});
