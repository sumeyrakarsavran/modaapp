import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GarmentArt } from '@/components/GarmentArt';
import { font, luxe, luxeRadius } from '@/theme/luxe';
import type { WardrobeItem } from '@/types';

/**
 * Elde açılmış oyun kartları gibi yelpaze — stilist "bunları önerdim" derken
 * parçaların fotoğrafını gösteriyor.
 *
 * Kartlar ALT ORTA noktadan dönüyor: RN dönüşü görünümün MERKEZİ etrafında
 * yaptığı için önce aşağı, sonra döndür, sonra geri yukarı taşınıyor
 * (`translateY(+h/2) → rotate → translateY(-h/2)`). Merkezden döndürülürse
 * kartlar bir noktadan açılmış gibi değil, savrulmuş gibi duruyor.
 */
export function CardFan({
  items,
  onPress,
  size = 82,
}: {
  items: WardrobeItem[];
  onPress?: (item: WardrobeItem) => void;
  size?: number;
}) {
  const n = items.length;
  if (!n) return null;

  const W = size;
  const H = Math.round(size * 1.34);
  /** Kartlar birbirinin üstüne biniyor — desteden yeni çekilmiş gibi. */
  const STEP = Math.round(W * (n > 4 ? 0.5 : 0.62));
  /** Uçtaki kartın açısı; kart sayısı arttıkça açı büyür ama tavanı var. */
  const MAX_ROT = Math.min(15, 5 + n * 2);
  /** Uçtaki kartın alçalması — yay hissi. */
  const LIFT = 10;

  const width = W + (n - 1) * STEP;
  const height = H + LIFT + 16;

  return (
    <View style={[styles.wrap, { width, height }]}>
      {items.map((it, i) => {
        const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // -1 … +1
        const rot = t * MAX_ROT;
        return (
          <Pressable
            key={it.id}
            onPress={onPress ? () => onPress(it) : undefined}
            style={[
              styles.card,
              {
                width: W,
                height: H,
                left: i * STEP,
                top: t * t * LIFT,
                transform: [
                  { translateY: H / 2 },
                  { rotate: `${rot}deg` },
                  { translateY: -H / 2 },
                ],
                /*
                  Android'de çizim SIRASINI elevation belirliyor: artan değer
                  vermezsek soldaki kart sağdakinin üstünde kalıp yelpaze
                  ters açılmış gibi duruyor.
                */
                elevation: 2 + i,
                zIndex: i,
              },
            ]}
          >
            {it.imageUri ? (
              <Image source={{ uri: it.imageUri }} style={styles.img} contentFit="contain" />
            ) : (
              <GarmentArt
                category={it.category}
                subcategory={it.subcategory}
                colorId={it.colorId}
                size={W * 0.66}
              />
            )}
            <Text style={styles.name} numberOfLines={1}>
              {it.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', marginVertical: 4 },
  card: {
    position: 'absolute',
    /*
      Zemin OPAK olmalı: yarı saydam yüzey + elevation, Android'de gölgeyi
      kartın İÇİNE sızdırıp beyaz leke bırakıyor (kolaj kartlarında görüldü).
    */
    backgroundColor: '#FFFDFD',
    borderRadius: luxeRadius.md,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 4,
    shadowColor: luxe.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  img: { width: '84%', flex: 1 },
  name: {
    fontFamily: font.body,
    fontSize: 8.5,
    lineHeight: 11,
    color: luxe.outline,
    maxWidth: '90%',
    textAlign: 'center',
  },
});
