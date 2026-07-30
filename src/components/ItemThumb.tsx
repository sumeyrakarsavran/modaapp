import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GarmentArt } from '@/components/GarmentArt';
import { colors, radius } from '@/theme';
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
          selected && { borderColor: colors.aqua, borderWidth: 2.5 },
        ]}
      >
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.img} contentFit="contain" />
        ) : (
          <GarmentArt category={item.category} colorId={item.colorId} size={size * 0.68} />
        )}
        {item.favorite ? <Text style={styles.fav}>❤️</Text> : null}
        {item.archived ? (
          <View style={styles.archived}>
            <Text style={{ fontSize: 11 }}>🗄️</Text>
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
    backgroundColor: colors.card,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  img: { width: '100%', height: '100%' },
  fav: { position: 'absolute', top: 6, right: 7, fontSize: 12 },
  archived: {
    position: 'absolute',
    top: 4,
    left: 5,
    backgroundColor: colors.background,
    borderRadius: 6,
    padding: 2,
  },
  name: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.inkSoft,
    marginTop: 5,
    textAlign: 'center',
  },
});
