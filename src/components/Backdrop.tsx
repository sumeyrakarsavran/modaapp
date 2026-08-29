import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { iridescent } from '@/theme/luxe';

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
 */
export function Backdrop() {
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
