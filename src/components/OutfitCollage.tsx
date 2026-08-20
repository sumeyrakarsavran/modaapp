import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GarmentArt } from '@/components/GarmentArt';
import { colors, radius } from '@/theme';
import { OUTER_SUBCATEGORY, type Outfit, type WardrobeItem } from '@/types';

/** Canvas'taki yerleştirme taban boyutu (canvas.tsx ile aynı olmalı). */
export const CANVAS_BASE = 110;

/** Izgara kolaj ölçüleri — kare hesabı bunlara dayanır (styles.box ile aynı olmalı). */
const PAD = 4; // kutunun iç boşluğu
const GAP = 4; // kareler arası boşluk
const BORDER = 1; // styles.box borderWidth

/** Kutu içinde 0–1 oranlarıyla verilen yerleşim kutusu. */
type Box = { x: number; y: number; w: number; h: number };

/**
 * "Kılık" yerleşimi — rastgele (Karıştır) ve öneriyle kurulan, yani Canvas
 * düzeni OLMAYAN kombinler için.
 *
 * Izgara kolaj parçaları sıraya göre karelere diziyordu: pantolon tişörtün
 * SAĞINDA, ayakkabı altında… Kombin bir kılık gibi değil, envanter listesi
 * gibi duruyordu. Burada gerçek yerleşim: üst üstte, ALT ONUN ALTINDA (aynı
 * sütun), ayakkabı SAĞA kayık. Dış giyim / aksesuar sağ sütunu yukarıdan
 * doldurur.
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

/**
 * Parçaları kılık yerleşimine oturtur. Oturmuyorsa `null` döner ve çağıran
 * eski ızgara kolaja düşer — düzen zorlanıp parçalar üst üste binmesin.
 * Oturmadığı durumlar: aynı katmanda iki parça, elbise + alt birlikte,
 * sağ sütuna sığmayacak kadar çok ek parça, ya da hiç ana katman olmaması.
 */
function lookPlacement(items: WardrobeItem[]): { item: WardrobeItem; box: Box }[] | null {
  const out: { item: WardrobeItem; box: Box }[] = [];
  const taken = new Set<string>();
  /** Sağ sütuna sırayla yerleşecek ek parçalar (dış giyim, aksesuar, iç…) */
  const extras: WardrobeItem[] = [];

  for (const it of items) {
    // Dış giyim ayrı kategori değil: "üst" içindeki `jacket` alt türü.
    const key = it.subcategory === OUTER_SUBCATEGORY ? 'dis' : it.category;
    const left = key === 'dis' ? undefined : LOOK_LEFT[key];
    if (left) {
      if (taken.has(key)) return null;
      taken.add(key);
      out.push({ item: it, box: left });
    } else if (key === 'ayakkabi') {
      if (taken.has('ayakkabi')) return null;
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

/**
 * Kombin görseli.
 * - Canvas'ta oluşturulduysa (layout varsa) parçalar TAM kullanıcının
 *   yerleştirdiği gibi (x/y/ölçek/katman) küçültülerek çizilir.
 * - Layout yoksa kılık yerleşimi denenir; oturmazsa 2x2 ızgara kolaj.
 */
export function OutfitCollage({
  items,
  size = 150,
  layout,
  frame,
  cropToContent,
  bare = false,
  capture = false,
}: {
  items: WardrobeItem[];
  size?: number;
  layout?: Outfit['layout'];
  /** Canvas içerik alanı boyutu — verilirse ve cropToContent değilse tuval çerçevesi korunur. */
  frame?: { w: number; h: number };
  cropToContent?: boolean;
  /**
   * Kendi zeminini ve çerçevesini ÇİZME — arkasındaki yüzey görünsün.
   * Profil ızgarasında bütün karolar aynı zemini paylaşsın diye gerekiyor.
   */
  bare?: boolean;
  /**
   * Sanal denemeye gönderilecek ÜRÜN GÖRSELİ için: tüm parçalar çizilir
   * (4 sınırı yok), "+N" rozeti basılmaz, kutu beyaz ve çerçevesizdir.
   * Bunlar galeri önizlemesinde iyi ama FASHN'a giden karede zararlı.
   */
  capture?: boolean;
}) {
  const placed = layout
    ? items
        .filter((i) => layout[i.id])
        .map((i) => ({ item: i, ...layout[i.id] }))
        .sort((a, b) => a.z - b.z)
    : [];

  // Tuval çerçevesini koru (kırpma yok): parçalar canvas'taki tam konumlarıyla,
  // boş alanlar dahil kareye orantılı sığdırılır.
  if (placed.length >= 2 && frame && !cropToContent && frame.w > 0 && frame.h > 0) {
    const f = size / Math.max(frame.w, frame.h);
    const offX = (size - frame.w * f) / 2;
    const offY = (size - frame.h * f) / 2;
    return (
      <View style={[styles.box, { width: size, height: size }, bare && styles.bareBox, capture && styles.captureBox]}>
        {placed.map((p) => {
          const s = CANVAS_BASE * p.scale * f;
          return (
            <View
              key={p.item.id}
              style={{
                position: 'absolute',
                left: offX + p.x * f,
                top: offY + p.y * f,
                width: s,
                height: s,
                // Canvas'ta döndürülen parça önizlemede de dönük dursun
                transform: p.rot ? [{ rotate: `${p.rot}deg` }] : undefined,
              }}
            >
              {p.item.imageUri ? (
                <Image source={{ uri: p.item.imageUri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
              ) : (
                <GarmentArt category={p.item.category} subcategory={p.item.subcategory} colorId={p.item.colorId} size={s} />
              )}
            </View>
          );
        })}
      </View>
    );
  }

  if (placed.length >= 2) {
    // Yerleşimin sınır kutusunu bul, önizlemeye sığdır (düzen aynen korunur)
    const pad = 8;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of placed) {
      const s = CANVAS_BASE * p.scale;
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + s);
      maxY = Math.max(maxY, p.y + s);
    }
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const factor = (size - pad * 2) / Math.max(bw, bh);
    // İçeriği ortala
    const offX = pad + (size - pad * 2 - bw * factor) / 2;
    const offY = pad + (size - pad * 2 - bh * factor) / 2;

    return (
      <View style={[styles.box, { width: size, height: size }, bare && styles.bareBox, capture && styles.captureBox]}>
        {placed.map((p) => {
          const s = CANVAS_BASE * p.scale * factor;
          return (
            <View
              key={p.item.id}
              style={{
                position: 'absolute',
                left: offX + (p.x - minX) * factor,
                top: offY + (p.y - minY) * factor,
                width: s,
                height: s,
                transform: p.rot ? [{ rotate: `${p.rot}deg` }] : undefined,
              }}
            >
              {p.item.imageUri ? (
                <Image
                  source={{ uri: p.item.imageUri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              ) : (
                <GarmentArt category={p.item.category} subcategory={p.item.subcategory} colorId={p.item.colorId} size={s} />
              )}
            </View>
          );
        })}
      </View>
    );
  }

  /*
    Kılık yerleşimi — Giydir beni / öneri gibi Canvas düzeni olmayan kombinler.
    `capture` (FASHN'a giden ürün görseli) HARİÇ: oradaki ızgara, tüm parçaları
    4 sınırı olmadan sığdırdığı için kullanılıyor ve sonucu kanıtlanmış durumda.
  */
  if (!capture && items.length >= 2) {
    const look = lookPlacement(items);
    if (look) {
      return (
        <View style={[styles.box, { width: size, height: size }, bare && styles.bareBox]}>
          {look.map(({ item, box }) => {
            const w = box.w * size;
            const h = box.h * size;
            return (
              <View
                key={item.id}
                style={{
                  position: 'absolute',
                  left: box.x * size,
                  top: box.y * size,
                  width: w,
                  height: h,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.imageUri ? (
                  /*
                    Gerçek kıyafet fotoğrafları HER ZAMAN `contain`: arka planı
                    silinmiş uzun/dar parçaları (elbise, palto) `cover` kırpıyor.
                  */
                  <Image
                    source={{ uri: item.imageUri }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                  />
                ) : (
                  <GarmentArt
                    category={item.category}
                    subcategory={item.subcategory}
                    colorId={item.colorId}
                    size={Math.min(w, h) * 0.98}
                  />
                )}
              </View>
            );
          })}
        </View>
      );
    }
  }

  // Izgara kolaj (kılık yerleşimine oturmayan / yakalama kareleri) — 2x2 kare
  const shown = capture ? items : items.slice(0, 4);
  const extra = items.length - shown.length;
  // Yakalamada tüm parçalar sığsın: 3 parça → 2 sütun, 5-9 parça → 3 sütun…
  const cols = capture ? Math.max(2, Math.ceil(Math.sqrt(shown.length))) : 2;
  // Kare boyutu GERÇEK iç genişlikten hesaplanır: React Native'de `width`
  // kenarlık ve iç boşluğu da kapsar. Bunlar düşülmezse satır birkaç piksel
  // taşar, flexWrap kareleri alt alta atar ve bir kısmı görünmez olur.
  const inner = size - BORDER * 2 - PAD * 2;
  const cell = Math.max(1, Math.floor((inner - GAP * (cols - 1)) / cols));
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, padding: PAD },
        bare && styles.bareBox,
        capture && styles.captureBox,
      ]}
    >
      <View style={styles.grid}>
        {shown.map((item) => (
          <View key={item.id} style={[styles.cell, { width: cell, height: cell }]}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.img} contentFit="contain" />
            ) : (
              <GarmentArt category={item.category} colorId={item.colorId} size={cell * 0.8} />
            )}
          </View>
        ))}
      </View>
      {/* 4'ten fazla parça varsa kalanı say (küçük önizlemelerde gizli) */}
      {extra > 0 && size >= 120 && !capture ? (
        <View style={styles.moreBadge}>
          <Text style={styles.moreText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  captureBox: { backgroundColor: '#FFFFFF', borderWidth: 0, borderRadius: 0 },
  /** Şeffaf: arkadaki yüzey görünsün (profil ızgarası). */
  bareBox: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0 },
  box: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    /*
      NÖTR çerçeve/karo: eski okyanus paletinin mavimsi tonları
      (#E3EEF1 / #FAFDFE) fildişi sayfalarda soğuk duruyordu. Bu tonlar iki
      temada da sırıtmıyor.
    */
    borderColor: '#E7E3DD',
    overflow: 'hidden',
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    alignContent: 'center',
    justifyContent: 'center',
  },
  moreBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: colors.overlay,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  moreText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    /*
      Parçanın ARKASINDA renk YOK. Her silüetin altında açık gri bir kare
      vardı; kolajlar yama gibi görünüyordu. Arkada kartın kendi yüzeyi ne ise
      o duruyor.
    */
  },
  img: { width: '100%', height: '100%', borderRadius: radius.sm },
});
