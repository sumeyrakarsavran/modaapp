import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { ConfirmModal } from '@/components/ConfirmModal';
import { TRYON_MODELS } from '@/data/tryonModels';
import { useStore } from '@/store/useStore';
import { font, glass, luxe, luxeRadius, luxeType } from '@/theme/luxe';

/**
 * MANKEN SEÇİMİ — sanal denemenin ilk adımı.
 *
 * Deneme stüdyosuna girmeden önce "kim giyecek" sorusu cevaplanıyor: hazır
 * mankenlerden biri ya da ankete göre oluşturulmuş kendi mankenin.
 *
 * Kendi mankeninin GÖRSELİ henüz üretilmiyor (üretim sonradan bağlanacak);
 * kart o zamana dek siluet + tarif gösteriyor.
 */
export default function Models() {
  const { models, selectedModel, setSelectedModel, deleteModel } = useStore();
  const { width } = useWindowDimensions();
  const [askDelete, setAskDelete] = React.useState<string | null>(null);

  /** İki sütun; kenar boşluğu ve aradaki boşluk düşülerek. */
  const cell = Math.floor((Math.min(width, 640) - 40 - 12) / 2);

  const choose = (kind: 'preset' | 'custom', id: string) => {
    setSelectedModel({ kind, id });
    router.push('/tryon');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />
      <ConfirmModal
        visible={!!askDelete}
        title="Mankeni sil"
        message="Bu manken listenden kalkacak."
        onConfirm={() => {
          if (askDelete) deleteModel(askDelete);
          setAskDelete(null);
        }}
        onCancel={() => setAskDelete(null)}
      />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={luxeType.display}>Modelini seç</Text>
          <Text style={[luxeType.label, { marginTop: 2 }]}>Kim giyecek?</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.close} hitSlop={8}>
          <Ionicons name="close" size={20} color={luxe.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {TRYON_MODELS.map((m) => {
          const on = selectedModel?.kind === 'preset' && selectedModel.id === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => choose('preset', m.id)}
              style={({ pressed }) => [
                styles.card,
                { width: cell },
                on && styles.cardOn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Image source={m.source} style={[styles.photo, { height: cell * 1.45 }]} contentFit="cover" />
              <View style={styles.foot}>
                <Text style={styles.name} numberOfLines={1}>
                  {m.label}
                </Text>
                {on ? <Ionicons name="checkmark-circle" size={16} color={luxe.primary} /> : null}
              </View>
            </Pressable>
          );
        })}

        {models.map((m) => {
          const on = selectedModel?.kind === 'custom' && selectedModel.id === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => choose('custom', m.id)}
              onLongPress={() => setAskDelete(m.id)}
              style={({ pressed }) => [
                styles.card,
                { width: cell },
                on && styles.cardOn,
                pressed && { opacity: 0.9 },
              ]}
            >
              {m.imageUri ? (
                <Image
                  source={{ uri: m.imageUri }}
                  style={[styles.photo, { height: cell * 1.45 }]}
                  contentFit="cover"
                />
              ) : (
                /* Görsel henüz yok: siluet + ankette verilen tarif */
                <View style={[styles.photo, styles.placeholder, { height: cell * 1.45 }]}>
                  <Ionicons name="body-outline" size={40} color={luxe.outlineSoft} />
                  <Text style={styles.spec} numberOfLines={3}>
                    {[m.hair, m.skin, `${m.size} beden`, `${m.height} cm`]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              )}
              <View style={styles.foot}>
                <Text style={styles.name} numberOfLines={1}>
                  {m.name}
                </Text>
                {on ? <Ionicons name="checkmark-circle" size={16} color={luxe.primary} /> : null}
              </View>
            </Pressable>
          );
        })}

        {/* Anketle kendi mankenini oluştur */}
        <Pressable
          onPress={() => router.push('/model-new')}
          style={({ pressed }) => [styles.new, { width: cell, height: cell * 1.45 + 42 }, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="add" size={26} color={luxe.primary} />
          <Text style={styles.newTitle}>Kendi modelini oluştur</Text>
          <Text style={styles.newHint}>Saç, ten, beden ve boyu söyle</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: luxeRadius.lg,
    overflow: 'hidden',
    /* Zemin OPAK: yarı saydam yüzey + elevation gölgeyi içeri sızdırıyor. */
    backgroundColor: '#FFFDFD',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardOn: { borderColor: luxe.primary },
  photo: { width: '100%' },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: luxe.surfaceLow,
    paddingHorizontal: 14,
  },
  spec: { fontFamily: font.body, fontSize: 11, lineHeight: 16, color: luxe.outline, textAlign: 'center' },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  name: { fontFamily: font.bodyMedium, fontSize: 13, color: luxe.ink, flexShrink: 1 },
  new: {
    borderRadius: luxeRadius.lg,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderStyle: 'dashed',
    backgroundColor: glass.fill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  newTitle: {
    fontFamily: font.bodyMedium,
    fontSize: 14,
    color: luxe.ink,
    textAlign: 'center',
  },
  newHint: { fontFamily: font.body, fontSize: 11, color: luxe.outline, textAlign: 'center' },
});
