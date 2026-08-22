import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
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
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Image } from 'expo-image';

import { Backdrop } from '@/components/Backdrop';

import { GarmentArt } from '@/components/GarmentArt';
import { OutfitCollage } from '@/components/OutfitCollage';
import { Reorderable } from '@/components/Reorderable';
import { ShareModal } from '@/components/ShareModal';
import { Button, Chip, EmptyState, SectionTitle } from '@/components/UI';
import { LookbookIcon } from '@/components/LookbookIcon';
import { useStore } from '@/store/useStore';
import { radius, spacing } from '@/theme';
import { font, glass, luxe, luxeRadius, luxeType } from '@/theme/luxe';
import type { CommunityOutfitSet, GarmentSpec, WardrobeItem } from '@/types';

export default function LookbookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, outfits, lookbooks, updateLookbook, deleteLookbook, sharePost, profile } =
    useStore();
  const { width } = useWindowDimensions();
  const lb = lookbooks.find((l) => l.id === id);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  /** Kapak olarak seçilen KOMBİNİN sırası — paylaşım kutusundan belirleniyor. */
  const [coverIdx, setCoverIdx] = useState(0);
  /** Izgara hücresinin genişliği — sürükle-bırak yuva hesabı buna dayanıyor. */
  const lbCellW = (width - spacing.lg * 3) / 2;
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(lb?.name ?? '');
  const [desc, setDesc] = useState(lb?.description ?? '');

  if (!lb) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }}>
        <View style={{ padding: spacing.xl }}>
          <Text style={luxeType.subtitle}>Lookbook bulunamadı.</Text>
          <Button small title="Geri" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const lbOutfits = lb.outfitIds
    .map((oid) => outfits.find((o) => o.id === oid))
    .filter(Boolean) as NonNullable<(typeof outfits)[number]>[];
  const available = outfits.filter((o) => !lb.outfitIds.includes(o.id));

  const itemsOf = (itemIds: string[]) =>
    itemIds.map((x) => items.find((i) => i.id === x)).filter(Boolean) as WardrobeItem[];

  const confirmDelete = () => {
    const doDelete = () => {
      deleteLookbook(lb.id);
      router.back();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`"${lb.name}" lookbook'u silinsin mi? (Kombinler silinmez.)`)) doDelete();
    } else {
      Alert.alert('Lookbook sil', `"${lb.name}" silinsin mi? Kombinlerin silinmez.`, [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const specsOf = (o: (typeof lbOutfits)[number]): GarmentSpec[] =>
    itemsOf(o.itemIds).map((i) => ({
      category: i.category,
      subcategory: i.subcategory,
      colorId: i.colorId,
      imageUri: i.imageUri,
      // Kombin düzeni korunsun — kolaj parçaları oluşturulduğu gibi yerleştirir
      layout: o.layout?.[i.id],
    }));

  /**
   * Lookbook TÜM kombinleriyle paylaşılır.
   * Önceden yalnızca `lbOutfits[0]` gönderiliyordu; lookbook bir kombin
   * koleksiyonu olduğu için tek kombin paylaşmak anlamsızdı.
   */
  // Her kombin kendi canvas çerçevesi ve kırpma tercihiyle gidiyor —
  // kullanıcının stüdyoda kurduğu düzen gönderide birebir korunsun.
  const outfitSets: CommunityOutfitSet[] = lbOutfits
    .map((o) => ({
      garments: specsOf(o),
      canvasFrame: o.canvasFrame,
      cropToContent: o.cropToContent,
    }))
    .filter((s) => s.garments.length > 0);


  const doShare = (caption: string) => {
    sharePost({
      kind: 'lookbook',
      caption,
      // Eski kartlar/istemciler için düz liste de dolduruluyor (ilk kombin)
      garments: outfitSets[0]?.garments ?? [],
      outfitSets,
      lookbookId: lb.id,
      // Kapak yalnızca profil ızgarasında kullanılıyor (bkz. CommunityPost.coverIndex)
      coverIndex: coverIdx,
      archetypeId: profile.bettaArchetypeId,
    });
    setShareOpen(false);
    router.push('/(tabs)/community');
  };


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={luxe.inkSoft} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={() => {
              if (!lbOutfits.length) return;
              // Paylaşım kutusu, lookbook'un KENDİ kapağıyla açılsın
              const i = lbOutfits.findIndex((o) => o.id === lb.coverOutfitId);
              setCoverIdx(i >= 0 ? i : 0);
              setShareOpen(true);
            }}
            style={styles.iconBtn}
          >
            <Ionicons name="share-social-outline" size={18} color={luxe.primaryDeep} />
          </Pressable>
          <Pressable onPress={confirmDelete} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={18} color={luxe.danger} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 50 }}>
          {editingName ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.nameInput}
                autoFocus
                onSubmitEditing={() => {
                  updateLookbook(lb.id, { name: name.trim() || lb.name });
                  setEditingName(false);
                }}
              />
              <Button
                small
                title="Tamam"
                onPress={() => {
                  updateLookbook(lb.id, { name: name.trim() || lb.name });
                  setEditingName(false);
                }}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => setEditingName(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <LookbookIcon value={lb.emoji} size={22} />
              <Text style={[luxeType.display, { flexShrink: 1 }]} numberOfLines={1}>
                {lb.name} <Ionicons name="pencil" size={14} color={luxe.outline} />
              </Text>
            </Pressable>
          )}
          <Text style={luxeType.caption}>{lb.outfitIds.length} kombin</Text>

          <TextInput
            value={desc}
            onChangeText={setDesc}
            onEndEditing={() => updateLookbook(lb.id, { description: desc.trim() || undefined })}
            onBlur={() => updateLookbook(lb.id, { description: desc.trim() || undefined })}
            placeholder="Açıklama ekle… (örn. plaj günleri için)"
            placeholderTextColor={luxe.outline}
            style={styles.descInput}
            multiline
          />

          <SectionTitle
            title="Kombinler"
            style={{ marginTop: spacing.lg }}
            right={<Chip label="+ Kombin ekle" color={luxe.primary} active onPress={() => setPickerOpen(true)} />}
          />

          {lbOutfits.length === 0 ? (
            <EmptyState
              emoji="📖"
              title="Bu lookbook boş"
              message="Kombinlerini ekleyerek temanı oluştur."
              action={<Button small title="+ Kombin ekle" onPress={() => setPickerOpen(true)} />}
            />
          ) : (
            /*
              Kombinler SÜRÜKLENEREK sıralanıyor: karta basılı tutup taşıyınca
              yeri değişiyor, sıra `outfitIds` üzerinden saklanıyor.
            */
            <Reorderable
              data={lbOutfits}
              keyOf={(o) => o.id}
              columns={2}
              cellW={lbCellW}
              cellH={lbCellW + 26}
              gap={spacing.md}
              onReorder={(ids) => updateLookbook(lb.id, { outfitIds: ids })}
              renderItem={(o, dragging) => (
                <View style={dragging ? styles.cellDrag : undefined}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: o.id } })}
                  >
                    <OutfitCollage
                      items={itemsOf(o.itemIds)}
                      size={lbCellW}
                      layout={o.layout}
                      frame={o.canvasFrame}
                      cropToContent={o.cropToContent}
                    />
                  </Pressable>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[luxeType.caption, { flex: 1 }]} numberOfLines={1}>
                      {o.name}
                    </Text>
                    {/* Kapak: gardıroptaki lookbook satırında bu kombin görünür */}
                    <Pressable
                      onPress={() => updateLookbook(lb.id, { coverOutfitId: o.id })}
                      hitSlop={8}
                    >
                      <Ionicons
                        name={lb.coverOutfitId === o.id ? 'bookmark' : 'bookmark-outline'}
                        size={16}
                        color={lb.coverOutfitId === o.id ? luxe.primary : luxe.outline}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        updateLookbook(lb.id, {
                          outfitIds: lb.outfitIds.filter((x) => x !== o.id),
                        })
                      }
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={18} color={luxe.outline} />
                    </Pressable>
                  </View>
                </View>
              )}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Kombin seçici */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <SectionTitle title="Kombin ekle" right={<Chip label="Kapat" onPress={() => setPickerOpen(false)} />} />
            <ScrollView>
              {available.length === 0 ? (
                <EmptyState
                  emoji="🎨"
                  title="Eklenecek kombin kalmadı"
                  message="Stüdyo'dan yeni kombinler oluşturabilirsin."
                />
              ) : (
                <View style={styles.grid}>
                  {available.map((o) => (
                    <Pressable
                      key={o.id}
                      style={{ width: 140, alignItems: 'center' }}
                      onPress={() => updateLookbook(lb.id, { outfitIds: [...lb.outfitIds, o.id] })}
                    >
                      <OutfitCollage items={itemsOf(o.itemIds)} size={140} layout={o.layout} frame={o.canvasFrame} cropToContent={o.cropToContent} />
                      <Text style={[luxeType.caption, { marginTop: 4 }]} numberOfLines={1}>
                        + {o.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ShareModal
        visible={shareOpen}
        defaultCaption={`"${lb.name}" lookbook'um: ${lb.outfitIds.length} kombin`}
        preview={
          /*
            Paylaşım kutusunda KAPAK KOMBİNİ seçiliyor: profil ızgarasındaki
            lookbook karosu bu kombini gösteriyor. Önce tek tek parçalar
            seçtiriliyordu; lookbook bir kombin koleksiyonu olduğu için kapak
            da bir kombin olmalı.
          */
          lbOutfits.length ? (
            <View style={{ gap: 8 }}>
              <Text style={luxeType.label}>Kapak kombini</Text>
              {/*
                `flexGrow: 0` ŞART: yatay liste, paylaşım kutusunun DİKEY
                ScrollView'ının içinde. Sınırsız bırakılınca büyüyüp altındaki
                açıklama alanını dışarı itiyordu (telefonda görüldü).
              */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ gap: 8 }}
              >
                {lbOutfits.map((o, i) => (
                  <Pressable
                    key={o.id}
                    onPress={() => setCoverIdx(i)}
                    style={[styles.coverPick, i === coverIdx && styles.coverPickOn]}
                  >
                    <OutfitCollage
                      items={itemsOf(o.itemIds)}
                      size={84}
                      layout={o.layout}
                      frame={o.canvasFrame}
                      cropToContent={o.cropToContent}
                      bare
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : undefined
        }
        onShare={doShare}
        onClose={() => setShareOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /** Kapak seçici karesi — seçili olan mürekkep çerçeveyle işaretleniyor. */
  /** Sürüklenen kombin: hafifçe kalkıyor. */
  cellDrag: { transform: [{ scale: 1.04 }] },
  coverPick: {
    width: 92,
    height: 92,
    borderRadius: luxeRadius.md,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    backgroundColor: luxe.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPickOn: { borderWidth: 2, borderColor: luxe.primary },
  sharePreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    maxWidth: 170,
  },
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
    backgroundColor: luxe.surface,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: luxe.outlineSoft,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: luxe.ink,
    backgroundColor: luxe.surface,
  },
  descInput: {
    borderWidth: 1.5,
    borderColor: luxe.outlineSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: luxe.ink,
    backgroundColor: luxe.surface,
    marginTop: spacing.md,
    minHeight: 48,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  modalWrap: { flex: 1, backgroundColor: luxe.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: luxe.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '75%',
  },
});
