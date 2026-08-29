import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';

import { OutfitCollage } from '@/components/OutfitCollage';
import { Frame, ShowcaseCard, aspectOf, showcase } from '@/components/ShowcaseCard';
import { luxe } from '@/theme/luxe';
import type { Outfit, WardrobeItem } from '@/types';

/**
 * Sanal denemenin VİTRİNİ: manken + kombin → üzerinde.
 *
 * Kabuk (kart, çerçeveler, sonuç karesi, düğme) `ShowcaseCard` içinde;
 * burada yalnızca bu vitrinin girdileri ve sonucu var.
 *
 * Örnek TEMSİLÎ DEĞİL, kullanıcının kendi son denemesinden geliyor. Henüz
 * denemesi yoksa sonuç karesi kesikli çerçeveyle boş kalıyor — uydurma
 * sonuç gösterilmiyor.
 */
export function TryOnShowcase({
  modelSource,
  outfitItems,
  outfitLayout,
  resultUri,
  status,
  ctaLabel,
  onPress,
}: {
  /** require() ile paketlenen manken görseli */
  modelSource: number;
  /**
   * Denemede kullanılan kombinin parçaları. Tek parça DEĞİL: `tryon-max`
   * kolajdaki parçaların hepsini birden giydiriyor, ekranda da kombin
   * gösterilmeli.
   */
  outfitItems?: WardrobeItem[];
  outfitLayout?: Outfit['layout'];
  /** Kullanıcının son sanal denemesi — yoksa kare boş kalır */
  resultUri?: string;
  status: string;
  ctaLabel: string;
  onPress: () => void;
}) {
  const [colW, setColW] = React.useState(0);
  /*
    Çerçeveler fotoğrafın KENDİ oranını alıyor. Sabit 3/4 kutuda `contain`
    kullanınca fotoğrafın etrafında boş beyaz şerit kalıyordu; `cover` ise
    tam boy çıktının başını/ayağını kırpıyor. Oran görselden okununca ikisi
    de olmuyor: kutu fotoğrafın boyunda.
  */
  const [modelAspect, setModelAspect] = React.useState<number>();
  const [resultAspect, setResultAspect] = React.useState<number>();

  return (
    <ShowcaseCard
      label="Sanal deneme"
      title="Üstünde nasıl durur?"
      note="Bir manken ve gardırobundan bir kombin seç; yapay zeka üzerine giydirsin."
      status={status}
      ctaLabel={ctaLabel}
      onPress={onPress}
      resultAspect={resultAspect}
      resultEmpty={!resultUri}
      resultCaption="Üzerinde"
      inputs={
        <>
          <Frame label="Manken" aspect={modelAspect}>
            <Image
              source={modelSource}
              style={showcase.fill}
              contentFit="contain"
              onLoad={(e) => setModelAspect(aspectOf(e))}
            />
          </Frame>
          <View style={showcase.plus}>
            <Ionicons name="add" size={13} color={luxe.outline} />
          </View>
          <Frame
            label="Kombin"
            /* Kolaj KARE çiziliyor: çerçeve de kare olmalı, yoksa kolaj
               3/4'lük kutunun içinde küçücük kalıyor. */
            square
            onLayout={(w) => setColW((c) => (c === w ? c : w))}
          >
            {outfitItems?.length && colW > 0 ? (
              <OutfitCollage items={outfitItems} size={colW} layout={outfitLayout} bare />
            ) : (
              <Ionicons name="shirt-outline" size={22} color={luxe.outlineSoft} />
            )}
          </Frame>
        </>
      }
      result={
        resultUri ? (
          <Image
            source={{ uri: resultUri }}
            style={showcase.fill}
            contentFit="contain"
            onLoad={(e) => setResultAspect(aspectOf(e))}
          />
        ) : (
          <Ionicons name="sparkles-outline" size={26} color={luxe.outlineSoft} />
        )
      }
    />
  );
}
