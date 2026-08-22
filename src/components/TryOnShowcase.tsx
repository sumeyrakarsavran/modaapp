import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BTN_PAD, FinBlob } from '@/components/FinBlob';
import { OutfitCollage } from '@/components/OutfitCollage';
import { font, glass, iridescent, luxe, luxeRadius, luxeShadow, luxeType } from '@/theme/luxe';
import type { Outfit, WardrobeItem } from '@/types';

/**
 * Sanal denemenin VİTRİNİ: manken + kıyafet → üzerinde.
 *
 * Kampanya düzeni: girdiler solda küçük, SONUÇ sağda büyük. Üçünü eşit
 * boyda dizmek mekaniği anlatıyor ama satmıyor; asıl merak edilen çıktı,
 * o yüzden ağırlık onda.
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
  /** Durum satırı: "FASHN AI bağlı" / "anahtar gerekli" gibi */
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
  const aspectOf = (e: { source?: { width: number; height: number } | null }) =>
    e.source && e.source.height > 0 ? e.source.width / e.source.height : undefined;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
    >
      {/*
        Işık geçişi kartın TAMAMINA yayılıyor. Köşeye konan yuvarlak leke
        kartın içinde ayrı bir nesne gibi duruyordu; kart dilinde ışık
        yüzeyin kendisinden gelmeli (bkz. GlassCard'daki parlaklık).
      */}
      <LinearGradient
        colors={['rgba(255,255,255,0.9)', 'rgba(229,221,242,0.5)', 'rgba(247,220,233,0.42)']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={styles.wash}
        pointerEvents="none"
      />

      <View style={styles.head}>
        <Text style={luxeType.label}>Sanal deneme</Text>
        <Text style={styles.pro}>PRO</Text>
      </View>
      <Text style={styles.title}>Üstünde nasıl durur?</Text>

      <View style={styles.stage}>
        {/* Girdiler: manken + kıyafet */}
        <View style={styles.inputs}>
          <Frame label="Manken" aspect={modelAspect}>
            <Image
              source={modelSource}
              style={styles.fill}
              contentFit="contain"
              onLoad={(e) => setModelAspect(aspectOf(e))}
            />
          </Frame>
          <View style={styles.plus}>
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
        </View>

        <Ionicons name="arrow-forward" size={16} color={luxe.outline} style={styles.arrow} />

        {/* Sonuç: vitrinin kahramanı */}
        <View style={styles.resultWrap}>
          {/*
            Yükseklik SABİT, en orandan türüyor. Tersi (en sabit) yapılırsa
            tam boy çıktının oranı kartı ekrandan taşırıyor ve altındaki
            "Sanal giydirmelerim" ilk ekranda hiç görünmüyordu.
          */}
          <View
            style={[
              styles.result,
              { height: RESULT_H, aspectRatio: resultUri ? (resultAspect ?? 3 / 4) : 3 / 4 },
              !resultUri && styles.resultEmpty,
            ]}
          >
            {resultUri ? (
              <Image
                source={{ uri: resultUri }}
                style={styles.fill}
                contentFit="contain"
                onLoad={(e) => setResultAspect(aspectOf(e))}
              />
            ) : (
              <Ionicons name="sparkles-outline" size={26} color={luxe.outlineSoft} />
            )}
          </View>
          <Text style={styles.cap}>Üzerinde</Text>
        </View>
      </View>

      <Text style={[luxeType.caption, { marginTop: 10, fontSize: 12.5 }]}>
        Bir manken ve gardırobundan bir kombin seç; FASHN AI üzerine giydirsin.
      </Text>

      <View style={styles.foot}>
        <View style={styles.cta}>
          <FinBlob variant="button" shadow pad={BTN_PAD} color={luxe.primary} />
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </View>
        <Text style={styles.status} numberOfLines={1}>
          {status}
        </Text>
      </View>
    </Pressable>
  );
}

function Frame({
  label,
  children,
  square,
  aspect,
  onLayout,
}: {
  label: string;
  children: React.ReactNode;
  square?: boolean;
  /** Fotoğrafın kendi oranı — verilmezse 3/4. */
  aspect?: number;
  /** Kolaj kare çizildiği için genişliğin ÖLÇÜLMESİ gerekiyor. */
  onLayout?: (width: number) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View
        style={[styles.frame, square ? { aspectRatio: 1 } : aspect ? { aspectRatio: aspect } : null]}
        onLayout={onLayout ? (e) => onLayout(Math.round(e.nativeEvent.layout.width)) : undefined}
      >
        {children}
      </View>
      <Text style={styles.cap} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Sonuç karesinin boyu — kartın toplam yüksekliğini bu belirliyor. */
const RESULT_H = 196;

const styles = StyleSheet.create({
  card: {
    /* Kart ilk ekranda tamamen görünmeli: ölçüler sıkı tutuluyor. */
    /*
      Zemin OPAK: yarı saydam yüzey + Android elevation, gölgeyi kartın
      İÇİNE sızdırıp beyaz leke bırakıyor (kolaj kartlarında görüldü).
    */
    backgroundColor: '#FFFDFD',
    borderRadius: luxeRadius.lg,
    padding: 15,
    overflow: 'hidden',
    ...luxeShadow.card,
  },
  wash: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pro: {
    fontFamily: font.label,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: luxe.primary,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  title: {
    fontFamily: font.headlineItalic,
    fontStyle: 'italic',
    fontSize: 20,
    lineHeight: 26,
    color: luxe.primary,
    marginTop: 2,
  },
  stage: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  /** Girdi sütunu bilerek DAR: ağırlık sonuçta. */
  inputs: { width: 84 },
  plus: { alignItems: 'center', marginVertical: 2 },
  frame: {
    aspectRatio: 3 / 4,
    borderRadius: luxeRadius.sm,
    backgroundColor: luxe.surface,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  arrow: { marginBottom: 16 },
  resultWrap: { flex: 1, alignItems: 'center' },
  result: {
    maxWidth: '100%',
    borderRadius: luxeRadius.md,
    backgroundColor: luxe.surface,
    borderWidth: 1,
    borderColor: glass.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...luxeShadow.card,
  },
  resultEmpty: { borderStyle: 'dashed', borderColor: luxe.outlineSoft, backgroundColor: glass.fill },
  fill: { width: '100%', height: '100%' },
  cap: {
    fontFamily: font.body,
    fontSize: 10,
    color: luxe.outline,
    textAlign: 'center',
    marginTop: 5,
  },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  cta: {
    paddingVertical: 10 + BTN_PAD,
    paddingHorizontal: 18 + BTN_PAD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: font.label,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: luxe.onPrimary,
  },
  status: { ...luxeType.tiny, flex: 1 },
});
