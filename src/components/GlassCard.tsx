import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BLOB_SHADOW_PAD, FinBlob } from '@/components/FinBlob';
import { luxeRadius, luxeShadow } from '@/theme/luxe';

/**
 * Cam kart (glassmorphism) — uygulamanın ORTAK kart dili.
 *
 * RN'de `backdrop-filter` yok ve `expo-blur` kurulu değil; yarı saydam beyaz
 * dolgu + açık kenarlıkla taklit ediliyor. Zemindeki radyal parıltı altından
 * geçtiği için etki yakın duruyor.
 *
 * ⚠️ Zemin OPAK. Yarı saydamken gölge (elevation) eklenemiyor: Android'de
 * gölge tabakası kartın İÇİNE beyaz bir dikdörtgen olarak sızıyor (cihazda
 * görüldü). Derinlik için opak zemin + yayvan gölge şart.
 *
 * Bugün ekranında doğdu, Akvaryum da aynısını kullanıyor — iki ayrı tanım
 * bırakılsaydı ekranlar zamanla birbirinden ayrışırdı.
 */
export function GlassCard({
  children,
  tint,
  variant = 'default',
  style,
}: {
  children: React.ReactNode;
  /** Vurgulu kart — pudra mora çalar. */
  tint?: boolean;
  /**
   * `pearl` — inci küre paleti (şimdilik Bugün). Kart zemini LAVANTAYA
   * çalıyor: kum rengi sayfanın üstünde kartlar soğuk parıltıyla ayrılıyor,
   * görseldeki inci gövdenin krem zemine göre durduğu gibi.
   */
  variant?: 'default' | 'pearl';
  style?: StyleProp<ViewStyle>;
}) {
  const pearlSkin = variant === 'pearl';
  return (
    <View
      style={[
        styles.card,
        tint && styles.cardTint,
        pearlSkin && (tint ? styles.pearlTint : styles.pearlCard),
        style,
      ]}
    >
      {/*
        Hacim (3B) hissi: köşegen bir ışık geçişi — sol üstte aydınlık, sağ
        altta tona çalan. Kartın KENDİ zemini değil AYRI katman ve kırpma
        yerine aynı `borderRadius` veriliyor; gölge veren görünüme
        `overflow: 'hidden'` eklenince Android'de çocuklar çizilmiyor.
      */}
      <LinearGradient
        colors={
          pearlSkin
            ? tint
              ? ['rgba(255,253,255,0.96)', 'rgba(214,206,238,0.55)']
              : ['rgba(255,253,255,0.97)', 'rgba(226,220,242,0.42)']
            : tint
              ? ['rgba(255,255,255,0.94)', 'rgba(229,221,242,0.5)']
              : ['rgba(255,255,255,0.97)', 'rgba(220,235,236,0.34)']
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.sheen}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

/**
 * Siluetli kart — dikdörtgen yerine ORGANİK dış hat.
 *
 * Aynı SVG mantığı (`FinBlob`), farklı oranlar: `card` siluetinde köşeler
 * eliptik ama kenarların ortası düz kalıyor, böylece içindeki yazı taşmıyor.
 * Bugün'ün gün kartlarındaki elle çizilmiş his kart ölçeğinde de sürüyor.
 *
 * ⚠️ Gölgeli blob kutunun İÇİNDE `BLOB_SHADOW_PAD` kadar pay ayırıyor (Android
 * kutu dışına taşan gölgeyi kırpıyor). Bu pay kartın görünen kenarını içeri
 * çekerdi ve kart komşularından dar görünürdü — negatif kenar boşluğuyla geri
 * alınıyor, iç dolgu da aynı kadar artırılıyor. Sonuçta biçimin kenarı diğer
 * kartların kenarıyla aynı hizada.
 */
export function ShapedCard({
  children,
  tint,
  style,
}: {
  children: React.ReactNode;
  tint?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.shaped, style]}>
      <FinBlob
        variant="card"
        color={tint ? '#F2EFF7' : '#FFFDFD'}
        gradient={tint ? ['#FFFFFF', '#EBE3F6'] : ['#FFFFFF', '#EBF4F4']}
        shadow
      />
      {children}
    </View>
  );
}

/** Kartların içindeki ilerleme çubuğunun yolu — cam yüzeyde beyaz okunuyor. */
export const CARD_TRACK = 'rgba(255,255,255,0.75)';

const styles = StyleSheet.create({
  card: {
    borderRadius: luxeRadius.lg,
    backgroundColor: '#FFFDFD',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    padding: 22,
    overflow: 'hidden',
    // Gölge HİYERARŞİK, temadan: hero > kart > gün kartı (bkz. luxeShadow)
    ...luxeShadow.card,
  },
  cardTint: { backgroundColor: '#F2EFF7' },
  /* İnci paleti: zemin krem, kart leylak — ayrım renkten geliyor, çizgiden değil. */
  pearlCard: { backgroundColor: '#FBF8FD', borderColor: 'rgba(255,253,255,0.92)' },
  pearlTint: { backgroundColor: '#F1ECF9', borderColor: 'rgba(255,253,255,0.92)' },
  shaped: {
    marginHorizontal: -BLOB_SHADOW_PAD,
    marginVertical: -BLOB_SHADOW_PAD,
    padding: BLOB_SHADOW_PAD + 22,
  },
  /** Hacim veren ışık geçişi — kartla aynı yuvarlaklık, kırpma gerekmiyor. */
  sheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: luxeRadius.lg,
  },
});
