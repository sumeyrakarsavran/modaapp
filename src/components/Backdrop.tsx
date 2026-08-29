import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { iridescent } from '@/theme/luxe';
import { pearl, pearlIridescent } from '@/theme/pearl';

/**
 * Sayfa zemini: fildişi yüzeyin iki ucundan sızan İRİDESAN ışık — sol üstte
 * petrol, sağ altta magenta, ikisi de çok düşük yoğunlukta. Zemin böylece düz
 * kalmıyor, bakış açısına göre dönüyormuş gibi duruyor.
 *
 * Yoğunluk bilerek düşük: geçiş bir olay olmalı, ortam olmamalı.
 *
 * Radyal geçiş için SVG ŞART — `expo-linear-gradient` yalnızca DOĞRUSAL
 * gradyan çiziyor, RN'de radial-gradient karşılığı yok.
 *
 * Ortak bileşen: Bugün ve Gardırop aynı zemini paylaşıyor, yoksa ekranlar
 * arası geçişte zemin tonu atlıyordu.
 *
 * `variant="pearl"` — inci küre paleti (şimdilik yalnızca Bugün). Orada ışık
 * KÖŞEDEN değil ORTADAN geliyor: görselde küre kendi halesinin içinde
 * duruyor, kenarlar sıcak kuma düşüyor. Köşe parıltıları o havayı vermiyordu.
 */
export function Backdrop({ variant = 'iridescent' }: { variant?: 'iridescent' | 'pearl' }) {
  if (variant === 'pearl') {
    return (
      <View style={fill} pointerEvents="none">
        <Svg style={fill}>
          <Defs>
            {/* Merkez hale: görseldeki en açık nokta */}
            <RadialGradient id="pearlGlow" cx="50%" cy="34%" r="72%">
              <Stop offset="0" stopColor={pearl.bgGlow} stopOpacity="1" />
              <Stop offset="0.55" stopColor={pearl.bgGlow} stopOpacity="0.55" />
              <Stop offset="1" stopColor={pearl.bgEdge} stopOpacity="0.9" />
            </RadialGradient>
            {/* Şeftali metal parıltısı — sol üst */}
            <RadialGradient id="pearlWarm" cx="18%" cy="12%" r="52%">
              <Stop offset="0" stopColor={pearlIridescent.full[1]} stopOpacity="0.16" />
              <Stop offset="1" stopColor={pearlIridescent.full[1]} stopOpacity="0" />
            </RadialGradient>
            {/* Soğuk leylak parıltısı — sağ alt; inci etkisi bu karşıtlıkta */}
            <RadialGradient id="pearlCool" cx="88%" cy="86%" r="55%">
              <Stop offset="0" stopColor={pearlIridescent.full[2]} stopOpacity="0.20" />
              <Stop offset="1" stopColor={pearlIridescent.full[2]} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#pearlGlow)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#pearlWarm)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#pearlCool)" />
        </Svg>
      </View>
    );
  }
  return (
    <View style={fill} pointerEvents="none">
      <Svg style={fill}>
        <Defs>
          <RadialGradient id="bdTop" cx="0%" cy="0%" r="50%">
            <Stop offset="0" stopColor={iridescent.full[0]} stopOpacity="0.14" />
            <Stop offset="1" stopColor={iridescent.full[0]} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="bdBottom" cx="100%" cy="100%" r="50%">
            <Stop offset="0" stopColor={iridescent.full[2]} stopOpacity="0.13" />
            <Stop offset="1" stopColor={iridescent.full[2]} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bdTop)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bdBottom)" />
      </Svg>
    </View>
  );
}

/* RN 0.86'da StyleSheet.absoluteFillObject yok — düz obje. */
const fill: ViewStyle = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 };
