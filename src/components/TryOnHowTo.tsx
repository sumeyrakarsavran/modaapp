import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GarmentArt } from '@/components/GarmentArt';
import { font, glass, luxe, luxeRadius, luxeType } from '@/theme/luxe';
import type { WardrobeItem } from '@/types';

/**
 * Sanal denemenin ANLATIMI: manken + kıyafet → giydirilmiş hâli.
 *
 * Üç kare yan yana; ilki hazır manken, ikincisi gardıroptan bir parça,
 * üçüncüsü sonuç. Sonuç karesi kullanıcının KENDİ son denemesinden geliyor —
 * temsilî bir görsel koymak yerine gerçek çıktı gösterilince "bu bana ne
 * yapacak" sorusu tek bakışta cevaplanıyor. Henüz denemesi yoksa üçüncü kare
 * kesikli çerçeveyle boş duruyor, uydurma sonuç gösterilmiyor.
 */
export function TryOnHowTo({
  modelSource,
  garment,
  resultUri,
}: {
  /** require() ile paketlenen manken görseli */
  modelSource: number;
  /** Gardıroptan örnek parça (fotoğrafı yoksa silüet çizilir) */
  garment?: WardrobeItem;
  /** Kullanıcının son sanal denemesi — yoksa kare boş kalır */
  resultUri?: string;
}) {
  return (
    <View>
      <Text style={luxeType.label}>Nasıl çalışır</Text>

      <View style={styles.row}>
        <Frame label="Manken">
          {/* Gerçek insan fotoğrafı: `cover` kalır, `contain` etrafında boşluk bırakıyor */}
          <Image source={modelSource} style={styles.img} contentFit="cover" />
        </Frame>

        <Ionicons name="add" size={15} color={luxe.outline} style={styles.link} />

        <Frame label="Kıyafet">
          {garment?.imageUri ? (
            // Arka planı silinmiş parça HER ZAMAN `contain` — `cover` uzun
            // parçaları (elbise, palto) kırpıyor.
            <Image source={{ uri: garment.imageUri }} style={styles.garment} contentFit="contain" />
          ) : garment ? (
            <GarmentArt
              category={garment.category}
              subcategory={garment.subcategory}
              colorId={garment.colorId}
              size={52}
            />
          ) : (
            <Ionicons name="shirt-outline" size={26} color={luxe.outlineSoft} />
          )}
        </Frame>

        <Ionicons name="arrow-forward" size={15} color={luxe.outline} style={styles.link} />

        <Frame label="Üzerinde" dashed={!resultUri}>
          {resultUri ? (
            <Image source={{ uri: resultUri }} style={styles.img} contentFit="cover" />
          ) : (
            <Ionicons name="sparkles-outline" size={22} color={luxe.outlineSoft} />
          )}
        </Frame>
      </View>

      <Text style={[luxeType.caption, { marginTop: 10 }]}>
        Hazır bir manken (ya da kendi fotoğrafın) ve gardırobundan bir kombin seç; FASHN AI
        parçaları o fotoğrafın üzerine gerçekçi şekilde giydirsin. Sonuç &quot;Sanal
        giydirmelerim&quot;de kalıcı olarak saklanır.
      </Text>
    </View>
  );
}

function Frame({
  label,
  dashed,
  children,
}: {
  label: string;
  dashed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.frame, dashed && styles.frameEmpty]}>{children}</View>
      <Text style={styles.cap} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  link: { marginBottom: 18 },
  frame: {
    aspectRatio: 3 / 4,
    borderRadius: luxeRadius.md,
    backgroundColor: luxe.surface,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  frameEmpty: { borderStyle: 'dashed', backgroundColor: glass.fill },
  img: { width: '100%', height: '100%' },
  garment: { width: '84%', height: '84%' },
  cap: {
    fontFamily: font.body,
    fontSize: 10.5,
    color: luxe.outline,
    textAlign: 'center',
    marginTop: 5,
  },
});
