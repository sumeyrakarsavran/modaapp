import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { GarmentArt } from '@/components/GarmentArt';
import { colors, radius } from '@/theme';
import type { Outfit, WardrobeItem } from '@/types';

/** Canvas'taki yerleştirme taban boyutu (canvas.tsx ile aynı olmalı). */
export const CANVAS_BASE = 110;

/**
 * Kombin görseli.
 * - Canvas'ta oluşturulduysa (layout varsa) parçalar TAM kullanıcının
 *   yerleştirdiği gibi (x/y/ölçek/katman) küçültülerek çizilir.
 * - Layout yoksa 2x2 ızgara kolaj gösterilir.
 */
export function OutfitCollage({
  items,
  size = 150,
  layout,
  frame,
  cropToContent,
}: {
  items: WardrobeItem[];
  size?: number;
  layout?: Outfit['layout'];
  /** Canvas içerik alanı boyutu — verilirse ve cropToContent değilse tuval çerçevesi korunur. */
  frame?: { w: number; h: number };
  cropToContent?: boolean;
}) {
  const placed = layout
    ? items
        .filter((i) => layout[i.id])
        .map((i) => ({ item: i, ...layout[i.id] }))
        .sort((a, b) => a.z - b.z)
    : [];

  // Tuval çerçevesini koru (kırpma yok): parçalar canvas'taki tam konumlarıyla,
  // boş alanlar dahil kareye orantılı sığdırılır.
  if (placed.length >= 2 && frame && !cropToContent && frame.w > 0 && frame.h > 0) {
    const f = size / Math.max(frame.w, frame.h);
    const offX = (size - frame.w * f) / 2;
    const offY = (size - frame.h * f) / 2;
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        {placed.map((p) => {
          const s = CANVAS_BASE * p.scale * f;
          return (
            <View
              key={p.item.id}
              style={{ position: 'absolute', left: offX + p.x * f, top: offY + p.y * f, width: s, height: s }}
            >
              {p.item.imageUri ? (
                <Image source={{ uri: p.item.imageUri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
              ) : (
                <GarmentArt category={p.item.category} colorId={p.item.colorId} size={s} />
              )}
            </View>
          );
        })}
      </View>
    );
  }

  if (placed.length >= 2) {
    // Yerleşimin sınır kutusunu bul, önizlemeye sığdır (düzen aynen korunur)
    const pad = 8;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of placed) {
      const s = CANVAS_BASE * p.scale;
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + s);
      maxY = Math.max(maxY, p.y + s);
    }
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const factor = (size - pad * 2) / Math.max(bw, bh);
    // İçeriği ortala
    const offX = pad + (size - pad * 2 - bw * factor) / 2;
    const offY = pad + (size - pad * 2 - bh * factor) / 2;

    return (
      <View style={[styles.box, { width: size, height: size }]}>
        {placed.map((p) => {
          const s = CANVAS_BASE * p.scale * factor;
          return (
            <View
              key={p.item.id}
              style={{
                position: 'absolute',
                left: offX + (p.x - minX) * factor,
                top: offY + (p.y - minY) * factor,
                width: s,
                height: s,
              }}
            >
              {p.item.imageUri ? (
                <Image
                  source={{ uri: p.item.imageUri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              ) : (
                <GarmentArt category={p.item.category} colorId={p.item.colorId} size={s} />
              )}
            </View>
          );
        })}
      </View>
    );
  }

  // Izgara kolaj (Giydir beni / layoutsuz kombinler)
  const shown = items.slice(0, 4);
  const cell = size / 2 - 6;
  return (
    <View style={[styles.box, { width: size, height: size, padding: 4 }]}>
      <View style={styles.grid}>
        {shown.map((item) => (
          <View key={item.id} style={[styles.cell, { width: cell, height: cell }]}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.img} contentFit="contain" />
            ) : (
              <GarmentArt category={item.category} colorId={item.colorId} size={cell * 0.8} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignContent: 'center',
    justifyContent: 'center',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: '#FAFDFE',
  },
  img: { width: '100%', height: '100%', borderRadius: radius.sm },
});
