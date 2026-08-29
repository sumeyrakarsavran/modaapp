import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BTN_PAD, FinBlob } from '@/components/FinBlob';
import { font, glass, luxe, luxeRadius, luxeShadow, luxeType } from '@/theme/luxe';

/**
 * Sanal deneme ve video vitrinlerinin ORTAK kabuğu.
 *
 * Kampanya düzeni: girdiler solda küçük, SONUÇ sağda büyük. Üçünü eşit
 * boyda dizmek mekaniği anlatıyor ama satmıyor; asıl merak edilen çıktı,
 * o yüzden ağırlık onda.
 *
 * İki kart aynı dosyadan besleniyor ki biri elle ayarlanınca diğeri geride
 * kalmasın — kullanıcı ikisinin de aynı görünmesini istedi.
 */
export function ShowcaseCard({
  label,
  title,
  note,
  inputs,
  result,
  resultAspect,
  resultEmpty,
  resultCaption,
  status,
  ctaLabel,
  onPress,
  onLayout,
}: {
  /** Üst satırdaki küçük başlık (PRO rozeti yanında). */
  label: string;
  title: string;
  note: string;
  /** Sol sütun: 84 piksellik dar girdi alanı. */
  inputs: React.ReactNode;
  /** Sağdaki büyük sonuç karesinin içeriği. */
  result: React.ReactNode;
  /** Sonucun kendi oranı — verilmezse 3/4. */
  resultAspect?: number;
  /** Sonuç henüz yoksa kare kesikli çerçeveyle boş görünür. */
  resultEmpty?: boolean;
  resultCaption: string;
  /** Durum satırı: "Hazır" / "anahtar gerekli" gibi */
  status: string;
  ctaLabel: string;
  onPress: () => void;
  /** Kartın kaydırma içindeki yeri — görünürlük takibi için. */
  onLayout?: (y: number, height: number) => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLayout={
        onLayout
          ? (e) => onLayout(e.nativeEvent.layout.y, e.nativeEvent.layout.height)
          : undefined
      }
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
        <Text style={luxeType.label}>{label}</Text>
        <Text style={styles.pro}>PRO</Text>
      </View>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.stage}>
        {/* Girdiler: bilerek dar sütun */}
        <View style={styles.inputs}>{inputs}</View>

        <Ionicons name="arrow-forward" size={16} color={luxe.outline} style={styles.arrow} />

        {/* Sonuç: vitrinin kahramanı */}
        <View style={styles.resultWrap}>
          {/*
            Yükseklik SABİT, en orandan türüyor. Tersi (en sabit) yapılırsa
            tam boy çıktının oranı kartı ekrandan taşırıyor ve altındaki
            liste ilk ekranda hiç görünmüyordu.
          */}
          <View
            style={[
              styles.result,
              { height: RESULT_H, aspectRatio: resultEmpty ? 3 / 4 : (resultAspect ?? 3 / 4) },
              resultEmpty && styles.resultEmpty,
            ]}
          >
            {result}
          </View>
          <Text style={styles.cap}>{resultCaption}</Text>
        </View>
      </View>

      <Text style={[luxeType.caption, { marginTop: 10, fontSize: 12.5 }]}>{note}</Text>

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

export function Frame({
  label,
  children,
  square,
  aspect,
  center,
  onLayout,
}: {
  label: string;
  children: React.ReactNode;
  square?: boolean;
  /** Fotoğrafın kendi oranı — verilmezse 3/4. */
  aspect?: number;
  /**
   * Sütunda TEK çerçeve varsa açılıyor. Girdi sütunu satır boyunca uzuyor
   * (yükseklik sonuç karesinden geliyor); çerçeve varsayılan olarak sütunun
   * TEPESİNE yapışıyor ve tek başınayken sonucun yanında havada kalıyor.
   * İki çerçeveli sanal deneme kartında bu gerekmiyor: ikisi yüksekliği
   * zaten paylaşıyor.
   */
  center?: boolean;
  /** Kolaj kare çizildiği için genişliğin ÖLÇÜLMESİ gerekiyor. */
  onLayout?: (width: number) => void;
}) {
  return (
    <View style={[{ flex: 1 }, center && { justifyContent: 'center' }]}>
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

/** Görselin kendi oranını `onLoad` olayından okur. */
export const aspectOf = (e: { source?: { width: number; height: number } | null }) =>
  e.source && e.source.height > 0 ? e.source.width / e.source.height : undefined;

/** Sonuç karesinin boyu — kartın toplam yüksekliğini bu belirliyor. */
export const RESULT_H = 196;

export const showcase = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  plus: { alignItems: 'center', marginVertical: 2 },
});

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
