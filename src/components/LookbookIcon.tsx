import { Ionicons } from '@expo/vector-icons';
import React from 'react';

import { luxe } from '@/theme/luxe';

/**
 * Lookbook simgesi — emoji DEĞİL, ince çizgi ikon.
 *
 * Emoji seti cihazın font'una göre değişiyor ve sayfanın geri kalanındaki
 * çizgi diliyle çakışıyordu ("yapmacık duruyor"). Simge adı `Lookbook.emoji`
 * alanında saklanıyor: alan adı eski (veri göçü gerektirmesin diye), içeriği
 * artık bir Ionicons adı.
 */
export type LookbookIconName = React.ComponentProps<typeof Ionicons>['name'];

/** Yeni lookbook oluştururken seçilebilen simgeler. */
export const LOOKBOOK_ICONS = [
  'book-outline',
  'sparkles-outline',
  'moon-outline',
  'sunny-outline',
  'flame-outline',
  'snow-outline',
  'flower-outline',
  'leaf-outline',
  'water-outline',
  'flash-outline',
  'color-palette-outline',
  'musical-notes-outline',
] as const satisfies readonly LookbookIconName[];

/** Eskiden kaydedilmiş emojiler — karşılık gelen ikona çevriliyor. */
const LEGACY: Record<string, LookbookIconName> = {
  '📖': 'book-outline',
  '🌊': 'water-outline',
  '🌙': 'moon-outline',
  '🔥': 'flame-outline',
  '🌸': 'flower-outline',
  '⚡': 'flash-outline',
  '🎨': 'color-palette-outline',
  '☁️': 'cloud-outline',
  '✨': 'sparkles-outline',
  '🐟': 'fish-outline',
};

/** Kayıtlı değeri (yeni ikon adı ya da eski emoji) ikona çevirir. */
export function lookbookIcon(value?: string): LookbookIconName {
  if (!value) return 'book-outline';
  if (LEGACY[value]) return LEGACY[value];
  // Ionicons adları hep tireli; emoji değilse olduğu gibi kullan
  return value.includes('-') ? (value as LookbookIconName) : 'book-outline';
}

export function LookbookIcon({
  value,
  size = 22,
  color = luxe.primary,
}: {
  value?: string;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={lookbookIcon(value)} size={size} color={color} />;
}
