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

import { OutfitCollage } from '@/components/OutfitCollage';
import { ShareModal } from '@/components/ShareModal';
import { Button, Chip, EmptyState, SectionTitle } from '@/components/UI';
import { useStore } from '@/store/useStore';
import { colors, radius, spacing, type } from '@/theme';
import type { GarmentSpec, WardrobeItem } from '@/types';

export default function LookbookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, outfits, lookbooks, updateLookbook, deleteLookbook, sharePost, profile } =
    useStore();
  const { width } = useWindowDimensions();
  const lb = lookbooks.find((l) => l.id === id);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(lb?.name ?? '');
  const [desc, setDesc] = useState(lb?.description ?? '');

  if (!lb) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ padding: spacing.xl }}>
          <Text style={type.subtitle}>Lookbook bulunamadı.</Text>
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

  const first = lbOutfits[0];
  const shareGarments: GarmentSpec[] = first
    ? itemsOf(first.itemIds).map((i) => ({
        category: i.category,
        colorId: i.colorId,
        imageUri: i.imageUri,
        layout: first.layout?.[i.id],
      }))
    : [];

  const doShare = (caption: string) => {
    sharePost({
      kind: 'lookbook',
      caption,
      garments: shareGarments,
      canvasFrame: first?.canvasFrame,
      cropToContent: first?.cropToContent,
      archetypeId: profile.bettaArchetypeId,
    });
    setShareOpen(false);
    router.push('/(tabs)/community');
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.inkSoft} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={() => (lbOutfits.length ? setShareOpen(true) : null)}
            style={styles.iconBtn}
          >
            <Ionicons name="share-social-outline" size={18} color={colors.aquaDark} />
          </Pressable>
          <Pressable onPress={confirmDelete} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
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
            <Pressable onPress={() => setEditingName(true)}>
              <Text style={type.display}>
                {lb.emoji} {lb.name} <Text style={{ fontSize: 16 }}>✏️</Text>
              </Text>
            </Pressable>
          )}
          <Text style={type.caption}>{lb.outfitIds.length} kombin</Text>

          <TextInput
            value={desc}
            onChangeText={setDesc}
            onEndEditing={() => updateLookbook(lb.id, { description: desc.trim() || undefined })}
            onBlur={() => updateLookbook(lb.id, { description: desc.trim() || undefined })}
            placeholder="Açıklama ekle… (örn. plaj günleri için)"
            placeholderTextColor={colors.inkFaint}
            style={styles.descInput}
            multiline
          />

          <SectionTitle
            title="Kombinler"
            style={{ marginTop: spacing.lg }}
            right={<Chip label="+ Kombin ekle" color={colors.aqua} active onPress={() => setPickerOpen(true)} />}
          />

          {lbOutfits.length === 0 ? (
            <EmptyState
              emoji="📖"
              title="Bu lookbook boş"
              message="Kombinlerini ekleyerek temanı oluştur."
              action={<Button small title="+ Kombin ekle" onPress={() => setPickerOpen(true)} />}
            />
          ) : (
            <View style={styles.grid}>
              {lbOutfits.map((o) => (
                <View key={o.id} style={{ width: (width - spacing.lg * 3) / 2 }}>
                  <Pressable onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: o.id } })}>
                    <OutfitCollage
                      items={itemsOf(o.itemIds)}
                      size={(width - spacing.lg * 3) / 2}
                      layout={o.layout}
                      frame={o.canvasFrame}
                      cropToContent={o.cropToContent}
                    />
                  </Pressable>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[type.caption, { flex: 1 }]} numberOfLines={1}>
                      {o.name}
                    </Text>
                    <Pressable
                      onPress={() =>
                        updateLookbook(lb.id, { outfitIds: lb.outfitIds.filter((x) => x !== o.id) })
                      }
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={18} color={colors.inkFaint} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
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
                      <Text style={[type.caption, { marginTop: 4 }]} numberOfLines={1}>
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
        defaultCaption={`"${lb.emoji} ${lb.name}" lookbook'um: ${lb.outfitIds.length} kombin 📖`}
        preview={
          first ? (
            <OutfitCollage
              items={itemsOf(first.itemIds)}
              size={160}
              layout={first.layout}
              frame={first.canvasFrame}
              cropToContent={first.cropToContent}
            />
          ) : undefined
        }
        onClose={() => setShareOpen(false)}
        onShare={doShare}
      />
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
  nameInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    backgroundColor: colors.card,
  },
  descInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.card,
    marginTop: spacing.md,
    minHeight: 48,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  modalWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '75%',
  },
});
