import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';

import { ConfirmModal } from '@/components/ConfirmModal';
import { ItemThumb } from '@/components/ItemThumb';
import { LookbookIcon } from '@/components/LookbookIcon';
import { OutfitCollage } from '@/components/OutfitCollage';
import { ShareModal } from '@/components/ShareModal';
import { Button, Card, Chip } from '@/components/UI';
import { useStore } from '@/store/useStore';
import { BETTA_ARCHETYPES, spacing } from '@/theme';
import { font, glass, luxe, luxeRadius, luxeType } from '@/theme/luxe';
import { todayISO, type WardrobeItem } from '@/types';

export default function OutfitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    items, outfits, lookbooks, profile,
    updateOutfit, deleteOutfit, wearOutfit, setPlan, sharePost, updateLookbook,
  } = useStore();
  const [lbPickerOpen, setLbPickerOpen] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [shared, setShared] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { width } = useWindowDimensions();
  const outfit = outfits.find((o) => o.id === id);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(outfit?.name ?? '');

  if (!outfit) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }}>
        <View style={{ padding: spacing.xl }}>
          <Text style={luxeType.subtitle}>Kombin bulunamadı.</Text>
          <Button small title="Geri" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const its = outfit.itemIds
    .map((x) => items.find((i) => i.id === x))
    .filter(Boolean) as WardrobeItem[];
  const arch = BETTA_ARCHETYPES.find((a) => a.id === outfit.archetypeId);
  const wornToday = outfit.wearDates.includes(todayISO());

  const confirmDelete = () => {
    setAskDelete(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />
      <ConfirmModal
        visible={askDelete}
        title="Kombini sil"
        message="Bu kombin silinsin mi? Parçaların gardırobunda kalır."
        onConfirm={() => {
          setAskDelete(false);
          deleteOutfit(outfit.id);
          router.back();
        }}
        onCancel={() => setAskDelete(false)}
      />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={luxe.inkSoft} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={() => updateOutfit(outfit.id, { favorite: !outfit.favorite })}
            style={styles.iconBtn}
          >
            <Ionicons
              name={outfit.favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={outfit.favorite ? luxe.primary : luxe.inkSoft}
            />
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/canvas', params: { outfitId: outfit.id } })}
            style={styles.iconBtn}
          >
            <Ionicons name="color-palette-outline" size={19} color={luxe.inkSoft} />
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
                  updateOutfit(outfit.id, { name: name.trim() || outfit.name });
                  setEditingName(false);
                }}
              />
              <Button
                small
                title="Tamam"
                onPress={() => {
                  updateOutfit(outfit.id, { name: name.trim() || outfit.name });
                  setEditingName(false);
                }}
              />
            </View>
          ) : (
            <Pressable onPress={() => setEditingName(true)}>
              <Text style={luxeType.display}>
                {outfit.name} <Ionicons name="pencil" size={14} color={luxe.outline} />
              </Text>
            </Pressable>
          )}

          {arch ? (
            /*
              Arketip rozeti: arketipin KENDİ doygun rengi yerine paletin pastel
              konteyneri. Mor/turkuaz düz dolgular fildişi sayfada bağırıyordu;
              emoji de sayfanın ince çizgi diliyle çelişiyordu.
            */
            <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
              <Chip label={`${arch.fish} · ${arch.styleName} stil`} active />
            </View>
          ) : null}

          <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
            <OutfitCollage
              items={its}
              size={Math.min(width - spacing.lg * 2, 360)}
              layout={outfit.layout}
              frame={outfit.canvasFrame}
              cropToContent={outfit.cropToContent}
            />
          </View>

          <Card style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={luxeType.title}>{its.length}</Text>
                <Text style={luxeType.tiny}>parça</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={luxeType.title}>{outfit.wearDates.length}</Text>
                <Text style={luxeType.tiny}>kez giyildi</Text>
              </View>
            </View>
          </Card>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
            <Button
              small
              title={wornToday ? 'Bugün giyildi' : 'Bugün giydim'}
              disabled={wornToday}
              onPress={() => wearOutfit(outfit.id)}
            />
            <Button
              small
              variant="secondary"
              title="Bugüne planla"
              onPress={() => {
                setPlan({ date: todayISO(), outfitId: outfit.id });
                router.push('/(tabs)/today');
              }}
            />
            <Button
              small
              variant="dark"
              title={shared ? 'Paylaşıldı' : 'Toplulukta paylaş'}
              disabled={shared}
              onPress={() => setShareOpen(true)}
            />
            <Button
              small
              variant="ghost"
              title="Lookbook'a ekle"
              onPress={() => setLbPickerOpen(true)}
            />
          </View>

          {/* Lookbook seçici */}
          {lbPickerOpen ? (
            <Card style={{ marginTop: spacing.md }}>
              <Text style={luxeType.subtitle}>Hangi lookbook'a?</Text>
              {lookbooks.length === 0 ? (
                <Text style={[luxeType.caption, { marginTop: spacing.sm }]}>
                  Henüz lookbook yok — Gardırop → Lookbook'lar bölümünden oluşturabilirsin.
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
                  {lookbooks.map((lb) => {
                    const inside = lb.outfitIds.includes(outfit.id);
                    return (
                      <Chip
                        key={lb.id}
                        left={
                          <LookbookIcon
                            value={lb.emoji}
                            size={13}
                            color={inside ? luxe.primaryDeep : luxe.outline}
                          />
                        }
                        label={`${lb.name}${inside ? ' ✓' : ''}`}
                        active={inside}
                        onPress={() =>
                          updateLookbook(lb.id, {
                            outfitIds: inside
                              ? lb.outfitIds.filter((x) => x !== outfit.id)
                              : [...lb.outfitIds, outfit.id],
                          })
                        }
                      />
                    );
                  })}
                </View>
              )}
              <Button
                small
                variant="ghost"
                title="Kapat"
                onPress={() => setLbPickerOpen(false)}
                style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
              />
            </Card>
          ) : null}

          <Text style={[luxeType.subtitle, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>Parçalar</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {its.map((i) => (
              <ItemThumb
                key={i.id}
                item={i}
                size={90}
                showName
                onPress={() => router.push({ pathname: '/item/[id]', params: { id: i.id } })}
              />
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ShareModal
        visible={shareOpen}
        defaultCaption={`"${outfit.name}" kombinim`}
        preview={
          <OutfitCollage
            items={its}
            size={160}
            layout={outfit.layout}
            frame={outfit.canvasFrame}
            cropToContent={outfit.cropToContent}
          />
        }
        onClose={() => setShareOpen(false)}
        onShare={(caption, place) => {
          sharePost({
            kind: 'kombin',
            caption,
            place,
            garments: its.map((i) => ({
              category: i.category,
              // Alt tür de gidiyor: yoksa ceket düz "üst" gibi çiziliyordu ve
              // kılık yerleşiminde dış giyim katmanına oturamıyordu.
              subcategory: i.subcategory,
              colorId: i.colorId,
              imageUri: i.imageUri,
              layout: outfit.layout?.[i.id],
            })),
            canvasFrame: outfit.canvasFrame,
            cropToContent: outfit.cropToContent,
            archetypeId: outfit.archetypeId ?? profile.bettaArchetypeId,
          });
          setShareOpen(false);
          setShared(true);
        }}
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
});
