import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/** Stilize betta balığı — akışkan yüzgeçli, tek renk katmanlı. */
export function BettaFish({
  size = 96,
  color = '#00B4D8',
  flip = false,
}: {
  size?: number;
  color?: string;
  flip?: boolean;
}) {
  return (
    <Svg
      width={size}
      height={size * 0.72}
      viewBox="0 0 120 86"
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      {/* Kuyruk — geniş, dalgalı halfmoon */}
      <Path
        d="M62 43 C80 12, 112 8, 118 16 C112 26, 114 32, 110 43 C114 54, 112 60, 118 70 C112 78, 80 74, 62 43 Z"
        fill={color}
        opacity={0.45}
      />
      <Path
        d="M62 43 C76 22, 98 16, 106 22 C100 30, 102 36, 99 43 C102 50, 100 56, 106 64 C98 70, 76 64, 62 43 Z"
        fill={color}
        opacity={0.6}
      />
      {/* Sırt yüzgeci */}
      <Path
        d="M34 32 C36 18, 52 10, 66 14 C60 22, 62 28, 58 33 Z"
        fill={color}
        opacity={0.55}
      />
      {/* Karın yüzgeci */}
      <Path
        d="M36 52 C38 66, 52 74, 64 71 C58 62, 60 57, 56 52 Z"
        fill={color}
        opacity={0.55}
      />
      {/* Gövde */}
      <Path
        d="M10 43 C16 30, 34 26, 48 29 C60 32, 66 38, 68 43 C66 48, 60 54, 48 57 C34 60, 16 56, 10 43 Z"
        fill={color}
      />
      {/* Yüz yüzgeci (pelvik) */}
      <Path d="M26 50 C26 58, 30 62, 34 64 C33 57, 34 53, 33 50 Z" fill={color} opacity={0.7} />
      {/* Göz */}
      <Circle cx={19} cy={41} r={2.6} fill="#FFFFFF" />
      <Circle cx={19} cy={41} r={1.3} fill="#062A3A" />
    </Svg>
  );
}

/** Dalga ayracı — ekran başlıklarının altında kullanılır. */
export function Wave({ width = 400, color = '#D6F3F9' }: { width?: number; color?: string }) {
  return (
    <Svg width={width} height={22} viewBox="0 0 400 22" preserveAspectRatio="none">
      <Path
        d="M0 11 C 33 0, 66 22, 100 11 C 133 0, 166 22, 200 11 C 233 0, 266 22, 300 11 C 333 0, 366 22, 400 11"
        stroke={color}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Küçük baloncuklar — boş durum süsü. */
export function Bubbles({ size = 60, color = '#00B4D8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Circle cx={14} cy={44} r={5} fill={color} opacity={0.25} />
      <Circle cx={30} cy={26} r={8} fill={color} opacity={0.18} />
      <Circle cx={46} cy={42} r={4} fill={color} opacity={0.3} />
      <Circle cx={40} cy={12} r={3} fill={color} opacity={0.35} />
    </Svg>
  );
}
