import { Platform } from 'react-native';

import type { Category, Season } from '@/types';
import { CATEGORIES, ITEM_COLORS, SEASONS, SUBCATEGORIES, subcategoryById } from '@/types';

/**
 * Otomatik etiketleme:
 * 1. nearestColorId — piksel renginden en yakın uygulama rengi (ücretsiz)
 * 2. rulesFromName — Türkçe isimden kategori/renk/sezon/tarz kuralları (ücretsiz, anında)
 * 3. classifyWithClaude — Claude anahtarı girilmişse fotoğraftan tam tespit (opsiyonel)
 */

export interface AutoTags {
  name?: string;
  category?: Category;
  /** SUBCATEGORIES id'si. Verilirse kategori bundan türetilir. */
  subcategory?: string;
  colorId?: string;
  seasons?: Season[];
  tags?: string[];
}

/* ————— 1) Renk eşleme ————— */

/**
 * Kroma (max−min) tabanlı sınıflandırma. HSL doygunluğu yüksek açıklıkta
 * patladığı için gölgeli beyaz "bej/gri", parlamalı siyah "gri" çıkıyordu —
 * gerçek kıyafet ortalamalarıyla 18 vakalık testten geçirildi.
 */
export function nearestColorId(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  const { h, l } = rgbToHsl(r, g, b);
  const c = (Math.max(r, g, b) - Math.min(r, g, b)) / 255; // kroma

  if (l < 0.14) return 'siyah';
  if (c < 0.09) {
    if (l > 0.75) return 'beyaz';
    if (l < 0.3) return 'siyah';
    return 'gri';
  }
  if (h >= 20 && h < 60 && c < 0.28) return l > 0.55 ? 'bej' : 'kahve';
  if (h < 15 || h >= 345) return l > 0.75 ? 'pembe' : 'kirmizi';
  if (h < 40) {
    if (c < 0.45) return l > 0.55 ? 'bej' : 'kahve';
    return l < 0.35 ? 'kahve' : 'turuncu';
  }
  if (h < 68) return 'sari';
  if (h < 160) return 'yesil';
  if (h < 200) return 'turkuaz';
  if (h < 250) return l < 0.3 ? 'lacivert' : 'mavi';
  if (h < 300) return 'mor';
  return 'pembe';
}

/**
 * Ham RGBA/RGB piksellerinden renk tespiti — web ve native ortak algoritma.
 * Şeffaf pikseller (silinmiş arka plan) yok sayılır; 3+ güçlü ton kovası
 * varsa "desenli" döner.
 */
export function colorIdFromPixels(
  data: Uint8Array | Uint8ClampedArray,
  channels: 3 | 4,
  /** Çağıran isterse: görselde hiç şeffaf piksel görüldü mü (alfa kaybı teşhisi) */
  stats?: { hadTransparent: boolean },
): string | null {
  let r = 0, g = 0, b = 0, n = 0;
  const hueBuckets = new Map<number, number>();
  // Büyük görsellerde CPU'yu korumak için ~40 bin piksel örnekle
  const totalPx = Math.floor(data.length / channels);
  const stride = Math.max(1, Math.floor(totalPx / 40000)) * channels;
  for (let i = 0; i + channels - 1 < data.length; i += stride) {
    if (channels === 4 && data[i + 3] < 128) {
      if (stats) stats.hadTransparent = true;
      continue; // şeffaf → arka plan
    }
    const pr = data[i], pg = data[i + 1], pb = data[i + 2];
    r += pr; g += pg; b += pb; n++;
    const { h, s, l } = rgbToHsl(pr, pg, pb);
    if (s > 0.25 && l > 0.15 && l < 0.9) {
      const bucket = Math.floor(h / 45); // 8 ton kovası
      hueBuckets.set(bucket, (hueBuckets.get(bucket) ?? 0) + 1);
    }
  }
  if (n < 20) return null;

  const strong = [...hueBuckets.values()].filter((c) => c / n > 0.12).length;
  if (strong >= 3) return 'desenli';

  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return nearestColorId(`#${toHex(r / n)}${toHex(g / n)}${toHex(b / n)}`);
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

/* ————— 2) İsimden kurallar ————— */

/**
 * İsimden ALT TÜR — kategori bundan türetilir (`subcategoryById`).
 * Id'ler sınıflandırma modelinin sınıflarıyla aynı, böylece isim kuralı ile
 * model aynı dili konuşuyor. Sıra önemli: önce daha spesifik olanlar.
 */
const SUBCATEGORY_WORDS: [string, string[]][] = [
  ['dress', ['elbise', 'tulum', 'abiye']],
  ['jacket', ['ceket', 'mont', 'kaban', 'palto', 'trençkot', 'trenckot', 'trench', 'parka', 'blazer', 'hırka', 'hirka', 'yelek', 'rüzgarlık', 'ruzgarlik']],
  ['jeans', ['jean', 'kot pantolon', 'denim pantolon']],
  ['leggings', ['tayt']],
  ['shorts', ['şort', 'sort']],
  ['skirt', ['etek']],
  ['trousers', ['pantolon', 'jogger', 'eşofman', 'esofman', 'paça', 'paca', 'chino']],
  ['tshirt', ['tişört', 'tisort', 't-shirt', 'tshirt']],
  ['shirt', ['gömlek', 'gomlek']],
  ['sweatshirt', ['sweat', 'hoodie', 'kapüşonlu', 'kapusonlu']],
  ['sweater', ['kazak', 'triko', 'süveter', 'suveter']],
  ['top', ['bluz', 'body', 'crop', 'tunik', 'büstiyer', 'bustiyer']],
  ['undershirt', ['atlet', 'fanila']],
  ['bra', ['sütyen', 'sutyen', 'büstiyer sütyen']],
  ['briefs', ['külot', 'kulot', 'boxer', 'slip']],
  ['heels', ['topuklu', 'stiletto']],
  ['sandals', ['sandalet']],
  ['flip_flops', ['terlik', 'parmak arası', 'parmak arasi']],
  ['formal_shoes', ['klasik ayakkabı', 'klasik ayakkabi', 'loafer', 'babet', 'oxford']],
  ['sneakers', ['sneaker', 'spor ayakkabı', 'spor ayakkabi']],
];

/** Alt tür bulunamazsa kategori düzeyinde kaba eşleşme (ör. "bot" bir alt tür değil). */
const CATEGORY_WORDS: [Category, string[]][] = [
  ['ayakkabi', ['ayakkabı', 'ayakkabi', 'bot', 'çizme', 'cizme']],
  ['aksesuar', ['çanta', 'canta', 'kolye', 'küpe', 'kupe', 'bileklik', 'yüzük', 'yuzuk', 'şapka', 'sapka', 'bere', 'atkı', 'atki', 'fular', 'şal', 'sal', 'kemer', 'gözlük', 'gozluk', 'saat', 'toka', 'eldiven', 'çorap', 'corap']],
  ['ic', ['iç giyim', 'ic giyim', 'pijama', 'gecelik']],
];

const COLOR_WORDS: [string, string[]][] = [
  ['siyah', ['siyah', 'antrasit']],
  ['beyaz', ['beyaz', 'krem', 'ekru', 'kırık beyaz', 'kirik beyaz']],
  ['gri', ['gri', 'füme', 'fume', 'duman']],
  ['bej', ['bej', 'ten', 'kum', 'camel']],
  ['kahve', ['kahve', 'kahverengi', 'taba', 'çikolata', 'cikolata', 'vizon']],
  ['lacivert', ['lacivert', 'gece mavisi']],
  ['mavi', ['mavi', 'indigo', 'buz']],
  ['turkuaz', ['turkuaz', 'petrol', 'camgöbeği', 'camgobegi', 'aqua']],
  ['yesil', ['yeşil', 'yesil', 'haki', 'zümrüt', 'zumrut', 'mint', 'çağla', 'cagla']],
  ['sari', ['sarı', 'sari', 'hardal', 'limon', 'altın', 'altin', 'gold']],
  ['turuncu', ['turuncu', 'oranj', 'mercan', 'kiremit']],
  ['kirmizi', ['kırmızı', 'kirmizi', 'bordo', 'vişne', 'visne', 'nar']],
  ['pembe', ['pembe', 'pudra', 'fuşya', 'fusya', 'gül', 'gul kurusu']],
  ['mor', ['mor', 'lila', 'lavanta', 'mürdüm', 'murdum', 'eflatun']],
  ['desenli', ['desenli', 'desen', 'çiçekli', 'cicekli', 'leopar', 'çizgili', 'cizgili', 'ekose', 'kareli', 'puantiyeli', 'batik', 'etnik', 'baskılı', 'baskili']],
];

const SEASON_WORDS: [Season[], string[]][] = [
  [['kis', 'sonbahar'], ['kazak', 'triko', 'süveter', 'suveter', 'kaban', 'mont', 'palto', 'parka', 'bot', 'çizme', 'cizme', 'atkı', 'atki', 'bere', 'eldiven', 'polar', 'yün', 'yun', 'kaşe', 'kase']],
  [['yaz'], ['şort', 'sort', 'sandalet', 'terlik', 'bikini', 'mayo', 'keten', 'şifon', 'sifon', 'askılı', 'askili', 'plaj', 'atlet']],
  [['ilkbahar', 'sonbahar'], ['trençkot', 'trenckot', 'trench', 'hırka', 'hirka', 'yelek', 'blazer']],
];

const STYLE_WORDS: [string[], string[]][] = [
  [['deri', 'rock'], ['deri', 'zincir', 'biker']],
  [['romantik'], ['dantel', 'fırfır', 'firfir', 'çiçekli', 'cicekli', 'fiyonk', 'volanlı', 'volanli']],
  [['spor'], ['spor', 'sneaker', 'eşofman', 'esofman', 'jogger', 'tayt', 'hoodie', 'crop']],
  [['şık', 'gece'], ['saten', 'ipek', 'abiye', 'payet', 'kadife', 'topuklu', 'stiletto']],
  [['vintage'], ['vintage', 'retro']],
  [['klasik', 'ofis'], ['blazer', 'gömlek', 'gomlek', 'kalem etek', 'plise', 'pileli']],
  [['bol', 'rahat'], ['oversize', 'bol', 'salaş', 'salas', 'wide leg']],
  [['denim'], ['jean', 'kot', 'denim']],
];

export function rulesFromName(name: string): AutoTags {
  const t = ` ${name.toLocaleLowerCase('tr')} `;
  const out: AutoTags = {};

  // Önce alt tür: bulunursa kategori ondan türetilir (daha isabetli)
  for (const [subId, words] of SUBCATEGORY_WORDS) {
    if (words.some((w) => t.includes(w))) {
      out.subcategory = subId;
      out.category = subcategoryById(subId)?.category;
      break;
    }
  }
  if (!out.category) {
    for (const [cat, words] of CATEGORY_WORDS) {
      if (words.some((w) => t.includes(w))) {
        out.category = cat;
        break;
      }
    }
  }
  for (const [colorId, words] of COLOR_WORDS) {
    if (words.some((w) => t.includes(w))) {
      out.colorId = colorId;
      break;
    }
  }
  const seasons = new Set<Season>();
  for (const [seas, words] of SEASON_WORDS) {
    if (words.some((w) => t.includes(w))) seas.forEach((s) => seasons.add(s));
  }
  if (seasons.size) out.seasons = [...seasons];

  const tags = new Set<string>();
  for (const [tagList, words] of STYLE_WORDS) {
    if (words.some((w) => t.includes(w))) tagList.forEach((x) => tags.add(x));
  }
  if (tags.size) out.tags = [...tags];

  return out;
}

/* ————— 3) Görsel etiketlerinden tespit (MLKit / ImageNet, ücretsiz) ————— */

/** İngilizce görsel etiketlerini kategori/sezon/tarza eşler (alt-dize eşleşmesi). */
/**
 * ML Kit etiketlerinden ALT TÜR. Kıyafet sınıflandırma modeli (ONNX) bu işi
 * çok daha iyi yapıyor; bu yol yalnızca model yoksa (web) ya da yüklenemezse
 * devreye giren yedek. Sıra önemli: spesifikten genele.
 */
const LABEL_SUBCATEGORY: [string, string[]][] = [
  ['dress', ['dress', 'gown', 'kimono', 'abaya', 'overskirt', 'hoopskirt', 'vestment', 'robe']],
  ['jacket', ['coat', 'jacket', 'outerwear', 'blazer', 'parka', 'cloak', 'poncho', 'cape', 'cardigan']],
  ['jeans', ['jean', 'denim']],
  ['leggings', ['legging']],
  ['shorts', ['short', 'swimming trunks']],
  ['skirt', ['skirt', 'sarong']],
  ['trousers', ['trouser', 'pant']],
  ['heels', ['heel', 'stiletto', 'pump']],
  ['sandals', ['sandal']],
  ['flip_flops', ['flip-flop', 'slipper', 'clog']],
  ['formal_shoes', ['loafer', 'moccasin', 'oxford', 'brogue']],
  ['sneakers', ['sneaker', 'running shoe', 'trainer']],
  ['sweatshirt', ['sweatshirt', 'hoodie']],
  ['sweater', ['sweater', 'jersey', 'pullover', 'knit']],
  ['shirt', ['shirt']],
  ['tshirt', ['tee', 't-shirt']],
  ['undershirt', ['tank', 'undershirt']],
  ['bra', ['brassiere', 'bra ']],
  ['briefs', ['brief', 'underpants', 'boxer']],
  ['top', ['blouse', 'top']],
];

/** Alt türe oturmayan etiketler için kategori düzeyinde yedek. */
const LABEL_CATEGORY: [Category, string[]][] = [
  ['ayakkabi', ['shoe', 'boot', 'footwear']],
  ['ic', ['pajama', 'nightgown', 'lingerie']],
  ['aksesuar', ['bag', 'backpack', 'purse', 'handbag', 'wallet', 'hat', 'cap', 'bonnet', 'sombrero', 'scarf', 'stole', 'muffler', 'glasses', 'sunglass', 'watch', 'necklace', 'jewelry', 'earring', 'bracelet', 'belt', 'buckle', 'sock', 'stocking', 'glove', 'mitten', 'tie', 'bow', 'umbrella', 'helmet']],
  ['ust', ['suit', 'bib']],
];

const LABEL_TAGS: [string[], string[]][] = [
  [['denim'], ['jean', 'denim']],
  [['spor'], ['sneaker', 'running shoe', 'jersey', 'sweatshirt', 'legging', 'tracksuit']],
  [['şık'], ['heel', 'gown', 'suit', 'necklace']],
  [['bot', 'rock'], ['boot']],
  [['triko', 'konfor'], ['sweater', 'cardigan']],
];

const LABEL_SEASONS: [Season[], string[]][] = [
  [['yaz'], ['sandal', 'short', 'swimming', 'bikini', 'tank', 'slipper']],
  [['kis', 'sonbahar'], ['boot', 'coat', 'sweater', 'parka', 'scarf', 'glove', 'mitten', 'sweatshirt', 'cardigan']],
];

export function tagsFromLabels(labels: string[]): AutoTags {
  const t = labels.join(' | ').toLowerCase();
  const out: AutoTags = {};

  for (const [subId, words] of LABEL_SUBCATEGORY) {
    if (words.some((w) => t.includes(w))) {
      out.subcategory = subId;
      out.category = subcategoryById(subId)?.category;
      break;
    }
  }
  if (!out.category) {
    for (const [cat, words] of LABEL_CATEGORY) {
      if (words.some((w) => t.includes(w))) {
        out.category = cat;
        break;
      }
    }
  }
  const tags = new Set<string>();
  for (const [tagList, words] of LABEL_TAGS) {
    if (words.some((w) => t.includes(w))) tagList.forEach((x) => tags.add(x));
  }
  if (tags.size) out.tags = [...tags];

  const seasons = new Set<Season>();
  for (const [seas, words] of LABEL_SEASONS) {
    if (words.some((w) => t.includes(w))) seas.forEach((s) => seasons.add(s));
  }
  if (seasons.size) out.seasons = [...seasons];

  return out;
}

/* ————— 4) Claude ile fotoğraftan tespit ————— */

export async function classifyWithClaude(
  apiKey: string,
  imageUri: string,
): Promise<AutoTags | null> {
  try {
    const { data, mediaType } = await uriToBase64(imageUri);
    const catIds = CATEGORIES.map((c) => c.id).join('|');
    const colorIds = ITEM_COLORS.map((c) => c.id).join('|');
    const seasonIds = SEASONS.map((s) => s.id).join('|');
    // Alt türü de isteyelim: kategori zaten alt türden türetilebiliyor ve
    // "Ceket / Mont" gibi ayrımlar (dış giyim katmanı) buna bağlı.
    const subIds = SUBCATEGORIES.map((s) => s.id).join('|');

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
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data },
              },
              {
                type: 'text',
                text:
                  `Bu bir kıyafet/aksesuar fotoğrafı. SADECE şu JSON'u döndür, başka hiçbir şey yazma:\n` +
                  `{"name":"Türkçe kısa ürün adı (örn. Siyah Deri Ceket)","category":"${catIds}","subcategory":"${subIds}","colorId":"${colorIds}","seasons":["${seasonIds}"],"tags":["stil etiketleri, küçük harf, en fazla 4"]}\n` +
                  `category, subcategory, colorId ve seasons alanları yalnızca verilen değerlerden olmalı. ` +
                  `Parça bu alt türlerin hiçbirine uymuyorsa (ör. çanta, şapka) subcategory alanını boş bırak.`,
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text: string = json.content?.map((b: any) => (b.type === 'text' ? b.text : '')).join('') ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);

    const out: AutoTags = {};
    if (typeof parsed.name === 'string' && parsed.name.trim()) out.name = parsed.name.trim();
    if (CATEGORIES.some((c) => c.id === parsed.category)) out.category = parsed.category;
    // Alt tür geçerliyse kategoriyi ondan türet — ikisi çelişirse alt tür kazanır
    const sub = subcategoryById(parsed.subcategory);
    if (sub) {
      out.subcategory = sub.id;
      out.category = sub.category;
    }
    if (ITEM_COLORS.some((c) => c.id === parsed.colorId)) out.colorId = parsed.colorId;
    if (Array.isArray(parsed.seasons)) {
      const seas = parsed.seasons.filter((s: string) => SEASONS.some((x) => x.id === s));
      if (seas.length) out.seasons = seas;
    }
    if (Array.isArray(parsed.tags)) {
      out.tags = parsed.tags
        .filter((t: unknown) => typeof t === 'string')
        .map((t: string) => t.toLocaleLowerCase('tr').trim())
        .filter(Boolean)
        .slice(0, 4);
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

async function uriToBase64(
  uri: string,
): Promise<{ data: string; mediaType: 'image/png' | 'image/jpeg' }> {
  if (uri.startsWith('data:')) {
    const mediaType = uri.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    return { data: uri.split(',')[1] ?? '', mediaType };
  }
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const dataUri: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return {
      data: dataUri.split(',')[1] ?? '',
      mediaType: dataUri.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
    };
  }
  const FileSystem = await import('expo-file-system/legacy');
  const data = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
  return { data, mediaType: uri.endsWith('.png') ? 'image/png' : 'image/jpeg' };
}
