import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

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
  style,
}: {
  children: React.ReactNode;
  /** Vurgulu kart — pudra mora çalar. */
  tint?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, tint && styles.cardTint, style]}>
      {/*
        Hacim (3B) hissi: köşegen bir ışık geçişi — sol üstte aydınlık, sağ
        altta tona çalan. Kartın KENDİ zemini değil AYRI katman ve kırpma
        yerine aynı `borderRadius` veriliyor; gölge veren görünüme
        `overflow: 'hidden'` eklenince Android'de çocuklar çizilmiyor.
      */}
      <LinearGradient
        colors={
          tint
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
