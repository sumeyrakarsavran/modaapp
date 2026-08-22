import type { Outfit, WardrobeItem, WeatherDay } from '@/types';
import { ITEM_COLORS, OUTER_SUBCATEGORY } from '@/types';

/**
 * AI Stilist.
 * - Anthropic API anahtarı girilmişse Claude'a sorar.
 * - Anahtar yoksa yerel kural tabanlı öneri üretir (uygulama anahtarsız da çalışır).
 */

export interface SuggestedOutfit {
  itemIds: string[];
  reason: string;
}

const NEUTRALS = new Set(['siyah', 'beyaz', 'gri', 'bej', 'kahve', 'lacivert']);

function seasonForTemp(tempMax: number): 'yaz' | 'ilkbahar' | 'sonbahar' | 'kis' {
  if (tempMax >= 24) return 'yaz';
  if (tempMax >= 16) return 'ilkbahar';
  if (tempMax >= 8) return 'sonbahar';
  return 'kis';
}

function colorsCompatible(a: string, b: string): boolean {
  if (NEUTRALS.has(a) || NEUTRALS.has(b)) return true;
  if (a === b) return true;
  const pairs = [
    ['mavi', 'turkuaz'], ['pembe', 'kirmizi'], ['mor', 'pembe'],
    ['sari', 'turuncu'], ['yesil', 'turkuaz'], ['mavi', 'desenli'],
  ];
  return pairs.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

function pick<T>(arr: T[], rand: () => number): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(rand() * arr.length)];
}

/** Yerel kural tabanlı kombin: hava + renk uyumu + az giyilene öncelik. */
export function localSuggest(
  items: WardrobeItem[],
  weather?: WeatherDay,
  seedRandom: () => number = Math.random,
): SuggestedOutfit | null {
  const active = items.filter((i) => !i.archived);
  const season = weather ? seasonForTemp(weather.tempMax) : undefined;

  const bySeason = (i: WardrobeItem) =>
    !season || i.seasons.length === 0 || i.seasons.includes(season);

  // Az giyilenlere hafif öncelik ver
  const weighted = (list: WardrobeItem[]) =>
    [...list].sort(
      (a, b) => a.wearDates.length - b.wearDates.length + (seedRandom() - 0.5) * 4,
    );

  const cat = (c: WardrobeItem['category']) => weighted(active.filter((i) => i.category === c && bySeason(i)));

  // Dış giyim ayrı bir kategori değil (kategoriler sınıflandırma modelinin grup
  // listesiyle hizalı): "Üst giyim" içindeki `jacket` alt türü. Üst katmanı da
  // ceketleri dışlamalı, yoksa aynı parça hem üst hem dış olarak seçilebilir.
  const isOuter = (i: WardrobeItem) => i.subcategory === OUTER_SUBCATEGORY;

  const tops = weighted(active.filter((i) => i.category === 'ust' && !isOuter(i) && bySeason(i)));
  const bottoms = cat('alt');
  const dresses = cat('elbise');
  const shoes = cat('ayakkabi');
  const outer = weighted(active.filter((i) => i.category === 'ust' && isOuter(i) && bySeason(i)));
  const acc = cat('aksesuar');

  /*
    Kombin KURALLARI (giyilebilirlik sezondan önce gelir):
      • ayakkabı HER ZAMAN var,
      • üst varsa alt da var — tek başına üst kombin değil,
      • elbise varsa alt YOK.
    Sezon süzgeci bir kategoriyi boşaltıyorsa o kategoride sezon YOK SAYILIYOR:
    yoksa yazlık gardıropta soğuk bir günde "üst var, alt yok" gibi eksik
    kombinler çıkıyordu.
  */
  const anyOf = (c: WardrobeItem['category']) => weighted(active.filter((i) => i.category === c));
  const shoesAll = shoes.length ? shoes : anyOf('ayakkabi');
  const bottomsAll = bottoms.length ? bottoms : anyOf('alt');
  const dressesAll = dresses.length ? dresses : anyOf('elbise');
  const topsAll = tops.length
    ? tops
    : weighted(active.filter((i) => i.category === 'ust' && !isOuter(i)));

  /** Üst+alt ancak İKİSİ de varsa kurulabilir. */
  const canPair = topsAll.length > 0 && bottomsAll.length > 0;
  const useDress = dressesAll.length > 0 && (!canPair || seedRandom() < 0.35);
  if (!useDress && !canPair) return null;

  const chosen: WardrobeItem[] = [];

  if (useDress) {
    const d = pick(dressesAll.slice(0, 4), seedRandom);
    if (d) chosen.push(d);
    // Elbisenin altına alt giyim EKLENMEZ.
  } else {
    const top = pick(topsAll.slice(0, 5), seedRandom);
    if (top) chosen.push(top);
    const bottom =
      pick(
        bottomsAll.filter((b) => !top || colorsCompatible(top.colorId, b.colorId)).slice(0, 5),
        seedRandom,
      ) ?? pick(bottomsAll.slice(0, 5), seedRandom);
    if (bottom) chosen.push(bottom);
    // Renk uyumu tutmazsa bile alt ŞART: eksik kombin önerilmiyor.
    if (!top || !bottom) return null;
  }

  const shoe = pick(shoesAll.slice(0, 4), seedRandom);
  if (shoe) chosen.push(shoe);

  const cold = weather ? weather.tempMax < 18 : false;
  const rainy = weather ? weather.precipProb > 45 : false;
  let addedOuter = false;
  if ((cold || rainy || seedRandom() < 0.3) && outer.length) {
    const o = pick(outer.slice(0, 4), seedRandom);
    if (o) {
      chosen.push(o);
      addedOuter = true;
    }
  }
  if (acc.length && seedRandom() < 0.6) {
    const a = pick(acc.slice(0, 4), seedRandom);
    if (a) chosen.push(a);
  }

  if (chosen.length < 2) return null;

  const parts: string[] = [];
  if (weather) {
    parts.push(
      `Bugün ${weather.tempMax}°C ${rainy ? 've yağmur ihtimali var' : ''}`.trim() + '.',
    );
    if (addedOuter) parts.push('Üstüne bir dış katman ekledim.');
  }
  const least = chosen.reduce((m, i) => (i.wearDates.length < m.wearDates.length ? i : m));
  if (least.wearDates.length <= 1) {
    parts.push(`"${least.name}" bir süredir dolapta bekliyor — bugün onun günü.`);
  }
  return { itemIds: chosen.map((i) => i.id), reason: parts.join(' ') || 'Renk uyumuna göre seçtim.' };
}

/** Claude API ile stilist sohbeti. */
export async function askClaude(
  apiKey: string,
  userMessage: string,
  items: WardrobeItem[],
  outfits: Outfit[],
  weather?: WeatherDay,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): Promise<string> {
  const colorName = (id: string) => ITEM_COLORS.find((c) => c.id === id)?.label ?? id;
  const wardrobe = items
    .filter((i) => !i.archived)
    .map(
      (i) =>
        `- [${i.id}] ${i.name} (${i.category}, renk: ${colorName(i.colorId)}${
          i.brand ? `, marka: ${i.brand}` : ''
        }${i.tags.length ? `, etiketler: ${i.tags.join('/')}` : ''}, ${i.wearDates.length} kez giyildi)`,
    )
    .join('\n');

  const system =
    `Sen BETTA uygulamasının stilistisin: betta balığı temalı bir dijital gardırop uygulaması. ` +
    `Samimi, kısa ve Türkçe konuş; ara sıra deniz/betta göndermeleri yap (abartma). ` +
    `Kullanıcının gardırobundaki parçalardan kombin öner; gardırobunda olmayan şeyler önerme. ` +
    `Kombin önerdiğinde parçaları madde işaretiyle ve GARDIROPTAKİ ADIYLA yaz, nedenini 1-2 cümleyle açıkla.\n` +
    /*
      Kombin kuralları prompt'a da yazılıyor: yerel öneri bunlara uyuyor,
      Claude uymazsa aynı ekranda iki farklı mantık oluyor. Adların birebir
      yazılması ayrıca ŞART — uygulama parçaların fotoğrafını metinde geçen
      ada bakarak yelpazede gösteriyor.
    */
    `KURALLAR: kombinde ayakkabı her zaman olsun; üst giyim önerdiysen alt giyim de öner; ` +
    `elbise önerdiysen ayrıca alt giyim önerme.\n\n` +
    `GARDIROP:\n${wardrobe}\n` +
    (weather
      ? `\nBUGÜNÜN HAVASI: en yüksek ${weather.tempMax}°C, en düşük ${weather.tempMin}°C, yağış ihtimali %${weather.precipProb}.`
      : '');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system,
      messages: [...history, { role: 'user', content: userMessage }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API hatası (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.map((b: any) => (b.type === 'text' ? b.text : '')).join('') ?? '';
}
