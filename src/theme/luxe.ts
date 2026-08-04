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
  /** Zemin — inci beyazı */
  bg: '#FAF9F8',
  surface: '#FFFFFF',
  /** Kart zeminleri, açıktan koyuya */
  surfaceLow: '#F4F3F2',
  surfaceMid: '#EEEEED',
  surfaceHigh: '#E9E8E7',

  /** Ana renk — gülkurusu/mauve. Düğmeler, başlıklar, marka yazısı. */
  primary: '#70585B',
  primaryDeep: '#574144',
  /** Pudra pembe konteyner — yumuşak bloklar, seçili durumlar */
  primaryContainer: '#FADADD',
  /** Soluk gül — ince çerçeveler, ayraçlar */
  primarySoft: '#DEBFC2',

  /** İkincil: sıcak krem/şeftali */
  secondary: '#685D49',
  secondaryContainer: '#F0E1C7',
  onSecondaryContainer: '#6E634F',

  /*
    ÜÇÜNCÜL (menekşe) BİLEREK YOK. Editoryal markalar tek nötr + tek aksanla
    çalışır; burada nötr mauve, aksan pudra pembe, krem yalnızca zeminin sağ
    alt köşesinde. Menekşe eklenince palet dağılıp "uygulama" hissi veriyordu.
  */

  /** Metin */
  ink: '#1A1C1C',
  inkSoft: '#4F4445',
  outline: '#807475',
  outlineSoft: '#D2C3C4',

  danger: '#BA1A1A',
  onPrimary: '#FFFFFF',

  /** Koyu zemin üstü metin katmanları (hero görselinde) */
  onDark: '#FFFFFF',
  onDarkSoft: 'rgba(255,255,255,0.85)',

  /** Hero perdesinin koyu ucu (on-primary-fixed) */
  scrim: '#281719',
  overlay: 'rgba(26,28,28,0.45)',
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
