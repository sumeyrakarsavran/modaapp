import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';

import { GarmentArt } from '@/components/GarmentArt';
import { OutfitCollage } from '@/components/OutfitCollage';
import { Button, Card, Chip, SectionTitle } from '@/components/UI';
import { useStore } from '@/store/useStore';
import { radius, spacing } from '@/theme';
import { font, glass, luxe, luxeRadius, luxeType } from '@/theme/luxe';
import { CATEGORIES, ITEM_COLORS, SEASONS, SOURCES, subcategoryById, todayISO } from '@/types';

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, outfits, toggleFavorite, toggleArchived, deleteItem, logWear, pro } = useStore();
  const item = items.find((i) => i.id === id);

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }}>
        <View style={{ padding: spacing.xl }}>
          <Text style={luxeType.subtitle}>Parça bulunamadı.</Text>
          <Button small title="Geri" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const cat = CATEGORIES.find((c) => c.id === item.category);
  const sub = subcategoryById(item.subcategory);
  const color = ITEM_COLORS.find((c) => c.id === item.colorId);
  const src = SOURCES.find((s) => s.id === item.source);
  const wearCount = item.wearDates.length;
  const cpw = item.price && wearCount > 0 ? item.price / wearCount : undefined;
  const inOutfits = outfits.filter((o) => o.itemIds.includes(item.id));
  const wornToday = item.wearDates.includes(todayISO());

  const confirmDelete = () => {
    const doDelete = () => {
      deleteItem(item.id);
      router.back();
    };
    if (Platform.OS === 'web') {
      // Web'de Alert butonları desteklenmez
      if (window.confirm(`"${item.name}" silinsin mi? Bu işlem geri alınamaz.`)) doDelete();
    } else {
      Alert.alert('Parçayı sil', `"${item.name}" silinsin mi? Bu işlem geri alınamaz.`, [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={luxe.inkSoft} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable onPress={() => toggleFavorite(item.id)} style={styles.iconBtn}>
            <Ionicons
              name={item.favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={item.favorite ? luxe.primary : luxe.inkSoft}
            />
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/item/new', params: { id: item.id } })}
            style={styles.iconBtn}
          >
            <Ionicons name="pencil" size={18} color={luxe.inkSoft} />
          </Pressable>
          <Pressable onPress={confirmDelete} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={18} color={luxe.danger} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.photo}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          ) : (
            <GarmentArt category={item.category} subcategory={item.subcategory} colorId={item.colorId} size={170} />
          )}
        </View>

        <Text style={[luxeType.title, { marginTop: spacing.lg }]}>{item.name}</Text>
        <View style={[styles.wrapRow, { marginTop: spacing.sm }]}>
          {cat ? <Chip label={cat.label} /> : null}
          {sub ? <Chip label={sub.label} /> : null}
          {color ? <Chip label={color.label} /> : null}
          {src ? <Chip label={src.label} color={src.color} active /> : null}
          {item.brand ? <Chip label={item.brand} /> : null}
        </View>
        {item.seasons.length ? (
          <View style={[styles.wrapRow, { marginTop: spacing.sm }]}>
            {item.seasons.map((s) => {
              const se = SEASONS.find((x) => x.id === s);
              return se ? <Chip key={s} label={se.label} /> : null;
            })}
          </View>
        ) : null}
        {item.tags.length ? (
          <Text style={[luxeType.caption, { marginTop: spacing.sm }]}>
            {item.tags.map((t) => `#${t}`).join('  ')}
          </Text>
        ) : null}

        {/* Giyim istatistikleri */}
        <Card style={{ marginTop: spacing.lg }}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={luxeType.title}>{wearCount}</Text>
              <Text style={luxeType.tiny}>kez giyildi</Text>
            </View>
            <View style={styles.stat}>
              <Text style={luxeType.title}>{item.price != null ? `₺${item.price}` : '—'}</Text>
              <Text style={luxeType.tiny}>fiyat</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[luxeType.title, { color: luxe.primaryDeep }]}>
                {cpw != null ? `₺${cpw.toFixed(0)}` : '—'}
              </Text>
              <Text style={luxeType.tiny}>giyim başı maliyet</Text>
            </View>
          </View>
          <Button
            small
            title={wornToday ? 'Bugün giyildi' : 'Bugün giydim'}
            variant={wornToday ? 'secondary' : 'primary'}
            disabled={wornToday}
            onPress={() => logWear([item.id])}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {['ust', 'alt', 'elbise'].includes(item.category) && item.imageUri ? (
          <Button
            title={pro ? 'Üzerimde nasıl durur? (AI deneme)' : 'Üzerimde dene — PRO'}
            variant="dark"
            onPress={() =>
              pro
                ? router.push('/tryon')
                : router.push('/pro')
            }
            style={{ marginTop: spacing.md }}
          />
        ) : null}

        {item.notes ? (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={luxeType.caption}>{item.notes}</Text>
          </Card>
        ) : null}

        {inOutfits.length ? (
          <>
            <SectionTitle title="Bu parçanın kombinleri" style={{ marginTop: spacing.xl }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                {inOutfits.map((o) => {
                  const its = o.itemIds
                    .map((x) => items.find((i) => i.id === x))
                    .filter(Boolean) as typeof items;
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: o.id } })}
                    >
                      <OutfitCollage items={its} size={110} layout={o.layout} frame={o.canvasFrame} cropToContent={o.cropToContent} />
                      <Text style={[luxeType.tiny, { marginTop: 4, maxWidth: 110 }]} numberOfLines={1}>
                        {o.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </>
        ) : null}

        <Button
          small
          variant="ghost"
          title={item.archived ? 'Arşivden çıkar' : 'Arşivle'}
          onPress={() => {
            toggleArchived(item.id);
            router.back();
          }}
          style={{ marginTop: spacing.xl, alignSelf: 'center' }}
        />
      </ScrollView>
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
  container: { padding: spacing.lg, paddingBottom: 60 },
  photo: {
    height: 260,
    borderRadius: radius.xl,
    backgroundColor: luxe.surface,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Kıyafet kutunun kenarlarına yapışmasın — `contain` görseli kenardan
    // kenara sığdırıyor, bir tutam boşluk nefes aldırıyor.
    padding: spacing.lg,
  },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
});
