/**
 * BETTA — editoryal tasarım dili ("Iridescent Ethereal").
 *
 * Kaynak: kullanıcının paylaştığı Rosetail örneği (DESIGN.md). Renkler
 * Material 3 token'larından birebir alındı, adlar BETTA'ya uyarlandı.
 * Karakteri: inci beyazı zemin, gülkurusu (mauve) ana renk, pembe/şeftali
 * konteynerler, cam (glassmorphism) yüzeyler, organik yumuşak köşeler.
 *
 * ⚠️ Bu dosya `src/theme/index.ts`'i DEĞİŞTİRMİYOR, EKLİYOR. Eski okyanus
 * paleti hâlâ diğer ekranlarda çalışıyor; ekranlar teker teker buraya geçiyor
 * (şu an: Bugün + sekme çubuğu).
 */

export const luxe = {
  /*
    İRİDESAN BETTA.
    Kimlik TEK RENK DEĞİL: fildişi bir sayfa, mürekkep bir tipografi ve
    ışığa göre dönen bir GEÇİŞ (petrol → mor → magenta). Geçiş yalnızca
    küçük yüzeylerde görünür — blob, ilerleme çubuğu, seçili sekme — ki
    sayfa sakin kalsın, renk bir olay olsun.

    Neden böyle: profesyonel his az renk + keskin metin kontrastından
    geliyor. Tek düz aksan seçmek her uygulamada var; bir betta yüzgecinin
    ışıkta renk değiştirmesi ise bu markaya ait.
  */

  /** Fildişi — sayfa */
  bg: '#F7F5F2',
  surface: '#FFFFFF',
  surfaceLow: '#F2F0EC',
  surfaceMid: '#EBE8E3',
  surfaceHigh: '#E3DFD9',

  /** Mürekkep — başlık, düğme, marka */
  primary: '#1F1F24',
  primaryDeep: '#101014',
  /** Geçişin pastel karşılığı — düz renk gereken yerlerde */
  primaryContainer: '#E8E3F0',
  primarySoft: '#C9C3D6',

  /** Nötr kum */
  secondary: '#5A5560',
  secondaryContainer: '#EFEBE4',
  onSecondaryContainer: '#565049',

  /** Metin */
  ink: '#17171A',
  inkSoft: '#4A4A50',
  outline: '#8A8790',
  outlineSoft: '#D9D4CC',

  danger: '#B3261E',
  onPrimary: '#FFFFFF',

  /** Koyu zemin üstü metin katmanları (hero görselinde) */
  onDark: '#FFFFFF',
  onDarkSoft: 'rgba(255,255,255,0.85)',

  /**
   * Hero perdesi — SICAĞA ÇALAN koyu kömür.
   * Mor denendi: sayfanın soğuk fildişiyle birleşince kombinin altı buz gibi
   * duruyordu. Saf siyah/gri de olmaz, beyaz kolajı griye düşürüp
   * çamurlaştırıyor. Bu ton ikisinin arası: nötr ama içinde kahve var.
   * `scrimRgb` gradyanda saydamlık kurmak için.
   */
  scrim: '#2E241C',
  scrimRgb: '46,36,28',
  overlay: 'rgba(23,23,26,0.5)',

  /** Gölge — nötr siyah yerine paletle akraba koyu mor */
  shadow: '#2A2430',
} as const;

/**
 * İridesan aksan: markanın kimliği. Düz renk olarak DEĞİL, geçiş olarak
 * kullanılır — bir betta yüzgecinin ışığa göre dönmesi gibi.
 */
export const iridescent = {
  /** Tam doygun — ince ve küçük yüzeyler (ilerleme çubuğu) */
  full: ['#1F6F78', '#6B4E9B', '#B93E7A'],
  /** Pastel — geniş yüzeyler (blob, seçili sekme); üstündeki yazı okunmalı */
  soft: ['#DCEBEC', '#E5DDF2', '#F7DCE9'],
} as const;

/**
 * Cam yüzey (glassmorphism). RN'de `backdrop-filter` yok — `expo-blur` da
 * kurulu değil; yarı saydam beyaz dolgu + açık kenarlıkla taklit ediliyor.
 * Zemindeki radyal parıltılar altından geçtiği için etki yakın duruyor.
 */
export const glass = {
  fill: 'rgba(255,255,255,0.62)',
  fillStrong: 'rgba(255,255,255,0.78)',
  border: 'rgba(255,255,255,0.75)',
} as const;

/**
 * Font aileleri. `@expo-google-fonts/*` paketlerinden yükleniyor
 * (kök `_layout.tsx`, yükleme BEKLENİYOR — yoksa metinler sistem fontuyla
 * ölçülüp kırpılıyor).
 *
 * Playfair'in İNCE kesimleri kullanılıyor (400/500): DESIGN.md "airy" duruş
 * için hafif ağırlık istiyor, kalın kesim editoryal havayı bozuyor.
 */
export const font = {
  display: 'PlayfairDisplay_400Regular',
  displayItalic: 'PlayfairDisplay_400Regular_Italic',
  headline: 'PlayfairDisplay_500Medium',
  headlineItalic: 'PlayfairDisplay_400Regular_Italic',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  label: 'DMSans_700Bold',
} as const;

/** Tipografi ölçeği — DESIGN.md'deki değerlerin mobil karşılığı. */
export const luxeType = {
  /** 32/40 — sayfa başlığı */
  display: {
    fontFamily: font.display,
    fontSize: 32,
    lineHeight: 40,
    color: luxe.primary,
  },
  displayItalic: {
    fontFamily: font.displayItalic,
    fontSize: 32,
    lineHeight: 40,
    fontStyle: 'italic' as const,
    color: luxe.primary,
  },
  /** 24/32 — bölüm ve kart başlıkları */
  headline: {
    fontFamily: font.headline,
    fontSize: 22,
    lineHeight: 30,
    color: luxe.primary,
  },
  headlineItalic: {
    fontFamily: font.headlineItalic,
    fontSize: 22,
    lineHeight: 30,
    fontStyle: 'italic' as const,
    color: luxe.primary,
  },
  /** Hero üstündeki serif başlık */
  heroTitle: {
    fontFamily: font.display,
    fontSize: 28,
    lineHeight: 34,
    color: luxe.onDark,
  },
  /** 16/24 — gövde */
  body: {
    fontFamily: font.body,
    fontSize: 15,
    lineHeight: 24,
    color: luxe.inkSoft,
  },
  bodyStrong: {
    fontFamily: font.bodyMedium,
    fontSize: 15,
    lineHeight: 24,
    color: luxe.ink,
  },
  /** 14/20/0.05em — etiketler; DESIGN.md: büyük harf + geniş harf aralığı */
  label: {
    fontFamily: font.label,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: luxe.outline,
  },
  caption: {
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 19,
    color: luxe.outline,
  },
} as const;

/** DESIGN.md: keskin köşe yok; kartlar çok yumuşak, düğmeler tam hap. */
export const luxeRadius = { sm: 10, md: 16, lg: 28, xl: 40, pill: 999 } as const;

/**
 * Organik "yüzgeç" köşe — örnekteki `fin-curve`.
 * CSS'teki eliptik yarıçap (`60% 40% ... / ...`) RN'de yok; köşeler farklı
 * piksel değerleriyle yaklaşık veriliyor, asimetri hissi korunuyor.
 */
export const finCurve = {
  /*
    Köşeler bilerek DÖRDÜ DE FARKLI: eşit çiftler verince biçim simetrik bir
    "yaprak" gibi duruyor, örnekteki elle çizilmiş yamuk his kayboluyordu.
  */
  borderTopLeftRadius: 52,
  borderTopRightRadius: 20,
  borderBottomRightRadius: 40,
  borderBottomLeftRadius: 30,
} as const;

/** Biçimi hafifçe yatırır — "yamuk yumuk" hissi CSS'teki eliptik yarıçapın yerini tutar. */
export const finTilt = { transform: [{ rotate: '-2deg' }] } as const;

/**
 * Gölge HİYERARŞİK: hero > kart > gün kartı (düz).
 * Her yüzey aynı yükseklikteyse derinlik bilgi taşımaz, yalnızca gürültü
 * olur — kartlar hero'dan daha ağır gölgeliydi, sıralama ters dönmüştü.
 *
 * Android'de görünürlüğü belirleyen `elevation`; `shadow*` değerleri iOS için.
 */
export const luxeShadow = {
  card: {
    shadowColor: '#4A2F33',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 10,
  },
  hero: {
    shadowColor: '#4A2F33',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.32,
    shadowRadius: 34,
    elevation: 20,
  },
} as const;
