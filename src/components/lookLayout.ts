import { OUTER_SUBCATEGORY } from '@/types';

/** Kutu içinde 0–1 oranlarıyla verilen yerleşim kutusu. */
export type Box = { x: number; y: number; w: number; h: number };

/**
 * "Kılık" yerleşimi — rastgele (Karıştır) ve öneriyle kurulan, yani Canvas
 * düzeni OLMAYAN kombinler için.
 *
 * Izgara kolaj parçaları sıraya göre karelere diziyordu: pantolon tişörtün
 * SAĞINDA, ayakkabı altında… Kombin bir kılık gibi değil, envanter listesi
 * gibi duruyordu. Burada gerçek yerleşim: üst üstte, ALT ONUN ALTINDA (aynı
 * sütun), ayakkabı SAĞA kayık. Dış giyim / aksesuar sağ sütunu yukarıdan
 * doldurur.
 *
 * ⚠️ Bu dosya ORTAK: hem gardıroptaki kombin kolajı (`OutfitCollage`) hem
 * paylaşılan gönderi kolajı (`FluidSpecCollage`) aynı yerleşimi kullanıyor.
 * Ayrı durduklarında kullanıcının kurduğu kombin uygulamada kılık gibi,
 * gönderide 2x2 ızgara gibi görünüyordu — "paylaşınca yerleri değişti".
 */
const LOOK_LEFT: Record<string, Box> = {
  ust: { x: 0.03, y: 0.04, w: 0.52, h: 0.44 },
  /** Elbise tek başına iki katmanın yerini tutar — sütunun tamamı onun. */
  elbise: { x: 0.03, y: 0.04, w: 0.52, h: 0.9 },
  alt: { x: 0.06, y: 0.5, w: 0.46, h: 0.44 },
};

/** Sağ sütun: ayakkabı hep ALTTA, kalanlar yukarıdan sırayla. */
const LOOK_RIGHT = {
  top: { x: 0.58, y: 0.04, w: 0.38, h: 0.32 } as Box,
  mid: { x: 0.62, y: 0.38, w: 0.28, h: 0.2 } as Box,
  bottom: { x: 0.56, y: 0.6, w: 0.4, h: 0.32 } as Box,
};

/** Yerleşim için gereken en az bilgi — hem `WardrobeItem` hem `GarmentSpec` uyuyor. */
export interface Placeable {
  category: string;
  subcategory?: string;
}

/**
 * Parçaları kılık yerleşimine oturtur. Oturmuyorsa `null` döner ve çağıran
 * eski ızgara kolaja düşer — düzen zorlanıp parçalar üst üste binmesin.
 * Oturmadığı durumlar: aynı katmanda iki parça, elbise + alt birlikte,
 * sağ sütuna sığmayacak kadar çok ek parça, ya da hiç ana katman olmaması.
 */
export function lookPlacement<T extends Placeable>(items: T[]): { item: T; box: Box }[] | null {
  const out: { item: T; box: Box }[] = [];
  const taken = new Set<string>();
  /** Sağ sütuna sırayla yerleşecek ek parçalar (dış giyim, aksesuar, iç…) */
  const extras: T[] = [];

  for (const it of items) {
    // Dış giyim ayrı kategori değil: "üst" içindeki `jacket` alt türü.
    const key = it.subcategory === OUTER_SUBCATEGORY ? 'dis' : it.category;
    const left = key === 'dis' ? undefined : LOOK_LEFT[key];
    /*
      Katman DOLUYSA yerleşimden vazgeçilmiyor, parça sağ sütuna atılıyor.
      Önce `null` dönülüyordu: alt türü kayıtlı olmayan eski gönderilerde
      ceket de düz "üst" sayıldığı için iki üst çakışıyor ve kombin 2x2
      ızgaraya düşüyordu. Sağ sütun zaten ek katmanların yeri.
    */
    if (left && !taken.has(key)) {
      taken.add(key);
      out.push({ item: it, box: left });
    } else if (key === 'ayakkabi' && !taken.has('ayakkabi')) {
      taken.add('ayakkabi');
      out.push({ item: it, box: LOOK_RIGHT.bottom });
    } else {
      extras.push(it);
    }
  }

  // Elbise sol sütunun tamamını kaplıyor; alt parça onun üstüne biner.
  if (taken.has('elbise') && taken.has('alt')) return null;
  // Ana katman yoksa "kılık" değil, dağınık bir parça yığınıdır — ızgara daha iyi.
  if (!taken.has('ust') && !taken.has('elbise') && !taken.has('alt')) return null;
  if (extras.length > 2) return null;

  const slots = [LOOK_RIGHT.top, LOOK_RIGHT.mid];
  extras.forEach((it, i) => out.push({ item: it, box: slots[i] }));
  return out;
}
