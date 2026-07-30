import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { BettaFish } from '@/components/BettaFish';
import { colors } from '@/theme';

/**
 * Profil avatarı: betta türü renginde halka + içinde profil fotoğrafı ya da
 * (fotoğraf yoksa) betta balığı silüeti.
 */
export function BettaAvatar({
  size = 44,
  color = colors.aqua,
  imageUri,
  pro,
  ringWidth,
  style,
}: {
  size?: number;
  color?: string;
  imageUri?: string;
  pro?: boolean;
  ringWidth?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const ring = ringWidth ?? Math.max(2, Math.round(size * 0.06));
  const inner = size - ring * 2 - 3; // halka + küçük boşluk

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring,
          borderColor: color,
          backgroundColor: imageUri ? colors.card : `${color}22`,
        },
        styles.wrap,
        style,
      ]}
    >
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: inner, height: inner, borderRadius: inner / 2 }}
          contentFit="cover"
        />
      ) : (
        <BettaFish size={inner * 0.82} color={color} />
      )}
      {pro ? (
        <View style={styles.proBadge}>
          <Text style={{ fontSize: Math.max(9, size * 0.22) }}>🏆</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  proBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 1,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
});
