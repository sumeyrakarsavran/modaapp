import React from 'react';
import Svg, { Path } from 'react-native-svg';

import type { Category } from '@/types';
import { ITEM_COLORS, OUTER_SUBCATEGORY } from '@/types';

/** Fotoğrafı olmayan parçalar için kategori silüeti — parçanın kendi renginde. */

const PATHS: Record<Category, string> = {
  ust: 'M20 25 L35 14 Q50 24 65 14 L80 25 L91 43 L75 51 L75 87 Q50 94 25 87 L25 51 L9 43 Z',
  alt: 'M30 8 H70 L75 92 H55 L50 44 L45 92 H25 Z',
  elbise: 'M37 8 Q50 17 63 8 L67 32 Q80 68 73 91 Q50 99 27 91 Q20 68 33 32 Z',
  ic: 'M22 34 Q36 28 50 34 Q64 28 78 34 L74 52 Q70 70 50 74 Q30 70 26 52 Z',
  ayakkabi:
    'M9 71 Q11 55 29 52 L44 38 Q58 54 87 59 Q93 63 91 72 Q60 82 11 79 Z',
  aksesuar:
    'M38 42 Q50 16 62 42 M27 40 H73 Q79 42 78 50 L75 82 Q74 89 66 89 H34 Q26 89 25 82 L22 50 Q21 42 27 40 Z',
};

/**
 * Ceket/mont artık ayrı bir KATEGORİ değil, "Üst giyim" altında bir alt tür
 * (modelin sınıf listesiyle hizalı). Silüeti kaybetmemek için alt türe bakıp
 * önden açık dış giyim çizimini kullanıyoruz.
 */
const OUTER_PATH =
  'M22 22 L38 11 Q50 19 62 11 L78 22 L89 41 L74 48 L74 93 H53 L50 40 L47 93 H26 L26 48 L11 41 Z';

export function GarmentArt({
  category,
  subcategory,
  colorId,
  size = 80,
}: {
  category: Category;
  /** SUBCATEGORIES id'si — dış giyim silüetini seçmek için kullanılır. */
  subcategory?: string;
  colorId: string;
  /** Piksel ya da yüzde ("100%") — yüzde verilirse kapsayıcısını doldurur. */
  size?: number | string;
}) {
  const hex = ITEM_COLORS.find((c) => c.id === colorId)?.hex ?? '#9A9A9A';
  // Beyaz parçalar açık zeminde kaybolmasın
  const fill = colorId === 'beyaz' ? '#E9E9E2' : hex;
  const stroke = colorId === 'beyaz' ? '#C9C9C0' : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d={subcategory === OUTER_SUBCATEGORY ? OUTER_PATH : PATHS[category]}
        fill={fill}
        stroke={stroke}
        strokeWidth={stroke === 'none' ? 0 : 2}
        opacity={0.92}
      />
    </Svg>
  );
}
