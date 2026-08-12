import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GarmentArt } from '@/components/GarmentArt';
import { font, glass, luxe, luxeRadius } from '@/theme/luxe';
import type { WardrobeItem } from '@/types';

/** Gardırop ızgarasındaki parça karosu: fotoğraf ya da renkli silüet. */
export function ItemThumb({
  item,
  size = 100,
  onPress,
  onLongPress,
  selected,
  showName,
}: {
  item: WardrobeItem;
  size?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  showName?: boolean;
}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={{ width: size }}>
      <View
        style={[
          styles.box,
          { width: size, height: size },
          selected && { borderColor: luxe.primary, borderWidth: 2 },
        ]}
      >
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.img} contentFit="contain" />
        ) : (
          <GarmentArt
            category={item.category}
            subcategory={item.subcategory}
            colorId={item.colorId}
            size={size * 0.68}
          />
        )}
        {/* Rozetler emoji değil ince çizgi ikon — sayfanın geri kalanıyla aynı dil */}
        {item.favorite ? (
          <View style={[styles.badge, { top: 5, right: 5 }]}>
            <Ionicons name="heart" size={10} color={luxe.ink} />
          </View>
        ) : null}
        {item.archived ? (
          <View style={[styles.badge, { top: 5, left: 5 }]}>
            <Ionicons name="archive-outline" size={10} color={luxe.outline} />
          </View>
        ) : null}
      </View>
      {showName ? (
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: luxe.surface,
    borderRadius: luxeRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    overflow: 'hidden',
  },
  // Kutuyu kenardan kenara doldurmasın — `contain` görseli tam sığdırdığı için
  // parça çerçeveye yapışık duruyordu. Kutuya padding vermek yerine görseli
  // küçültüyoruz: favori/arşiv rozetleri mutlak konumlu, padding onları kaydırırdı.
  img: { width: '90%', height: '90%' },
  badge: {
    position: 'absolute',
    backgroundColor: glass.fillStrong,
    borderRadius: 999,
    padding: 3,
  },
  name: {
    fontFamily: font.bodyMedium,
    fontSize: 11.5,
    color: luxe.inkSoft,
    marginTop: 5,
    textAlign: 'center',
  },
});
