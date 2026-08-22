import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { FluidSpecCollage } from '@/components/Community';
import { font, luxe, luxeRadius } from '@/theme/luxe';
import type { GarmentSpec } from '@/types';

/** Görüntüleyicinin gezdiği tek kombin. */
export interface LookbookSet {
  garments: GarmentSpec[];
  canvasFrame?: { w: number; h: number };
  cropToContent?: boolean;
}

/**
 * Lookbook görüntüleyici — koleksiyondaki kombinler TEK TEK, büyük.
 *
 * Önce yalnızca durağan bir önizleme vardı: bir kombin açılıyor, diğerlerine
 * bakmak için kapatıp yenisine dokunmak gerekiyordu. Lookbook bir koleksiyon
 * olduğu için oklarla sırayla gezmek doğal olanı; sayaç da kaçıncısında
 * olduğunu söylüyor.
 *
 * `index` null ise kapalı — çağıran tarafta tek bir durum yetiyor.
 */
export function LookbookViewer({
  title,
  sets,
  index,
  onIndex,
  onClose,
}: {
  title: string;
  sets: LookbookSet[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const open = index != null && index >= 0 && index < sets.length;
  const set = open ? sets[index] : undefined;
  /** Kolajın kenarı — okların iki yanda yeri kalsın. */
  const size = Math.min(width - 128, 300);

  const go = (dir: 1 | -1) => {
    if (index == null || sets.length === 0) return;
    // Baştan sona, sondan başa dönüyor: koleksiyonun sonunda çıkmaza girmesin
    onIndex((index + dir + sets.length) % sets.length);
  };

  return (
    <Modal
      visible={open}
      animationType="fade"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/* Boşluğa dokunmak kapatıyor; kartın kendisi dokunuşu yutuyor */}
      <Pressable style={styles.wrap} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>

          <View style={styles.row}>
            <Pressable
              onPress={() => go(-1)}
              style={({ pressed }) => [styles.arrow, pressed && { opacity: 0.6 }]}
              disabled={sets.length < 2}
              hitSlop={8}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={sets.length < 2 ? luxe.outlineSoft : luxe.ink}
              />
            </Pressable>

            <View style={{ width: size }}>
              <FluidSpecCollage
                garments={set?.garments ?? []}
                frame={set?.canvasFrame}
                cropToContent={set?.cropToContent}
              />
            </View>

            <Pressable
              onPress={() => go(1)}
              style={({ pressed }) => [styles.arrow, pressed && { opacity: 0.6 }]}
              disabled={sets.length < 2}
              hitSlop={8}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={sets.length < 2 ? luxe.outlineSoft : luxe.ink}
              />
            </Pressable>
          </View>

          {sets.length > 1 ? (
            <Text style={styles.counter}>
              {(index ?? 0) + 1}/{sets.length}
            </Text>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: luxe.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: luxe.surface,
    borderRadius: luxeRadius.lg,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontFamily: font.headlineItalic,
    fontStyle: 'italic',
    fontSize: 18,
    color: luxe.primary,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: luxe.surfaceLow,
  },
  counter: { fontFamily: font.display, fontSize: 14, color: luxe.outline },
});
