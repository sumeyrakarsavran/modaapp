/**
 * BETTA — editoryal tasarım dili ("luxe").
 *
 * Sıcak şeftali/kum paleti ve Playfair Display + DM Sans ikilisi. Kaynak:
 * kullanıcının paylaştığı ROSETAIL örneği; renkler Material 3 token'larından
 * birebir alındı, adlar BETTA'ya uyarlandı.
 *
 * ⚠️ Bu dosya `src/theme/index.ts`'i DEĞİŞTİRMİYOR, EKLİYOR. Eski okyanus
 * paleti hâlâ tüm ekranlarda çalışıyor; ekranlar teker teker buraya geçiyor
 * (şu an: Bugün). Böylece bir ekranın yeniden giydirilmesi diğerlerini bozmuyor.
 */

export const luxe = {
  /** Zemin — sıcak, pudralı beyaz */
  bg: '#FFF8F7',
  surface: '#FFFFFF',
  /** Kart zeminleri, açıktan koyuya */
  surfaceLow: '#FFF0EF',
  surfaceMid: '#FFE9E8',
  surfaceHigh: '#FFE1E0',

  /** Ana renk — sıcak kahve. Düğmeler, vurgular, marka yazısı. */
  primary: '#74593F',
  primaryDeep: '#5A422A',
  /** Şeftali konteyner — yumuşak bloklar, seçili durumlar */
  primaryContainer: '#FFDAB9',
  /** Ten/kum tonu — ayraçlar, ince çerçeveler */
  primarySoft: '#E3C0A0',

  /** Metin */
  ink: '#3B080B', // koyu bordo-siyah
  inkSoft: '#4F453D',
  outline: '#80756C',
  outlineSoft: '#D2C4B9',

  /** İkincil/üçüncül */
  tertiary: '#625F4F', // zeytin gri
  secondary: '#635D58',

  danger: '#BA1A1A',
  onPrimary: '#FFFFFF',

  /** Koyu zemin üstü metin katmanları (hero görselinde) */
  onDark: '#FFFFFF',
  onDarkSoft: 'rgba(255,255,255,0.82)',

  /** Bordo — hero perdesi. Kahve tonu kolajı çamurlaştırıyordu. */
  bordeaux: '#5E1428',
  overlay: 'rgba(59,8,11,0.5)',
} as const;

/**
 * Font aileleri. `@expo-google-fonts/*` paketlerinden yükleniyor
 * (kök `_layout.tsx`). Yükleme bitmemişse RN sistem fontuna düşer —
 * ekran yine çizilir, sadece tipografi sade görünür.
 */
export const font = {
  display: 'PlayfairDisplay_700Bold',
  displayItalic: 'PlayfairDisplay_600SemiBold_Italic',
  headline: 'PlayfairDisplay_600SemiBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  label: 'DMSans_700Bold',
} as const;

/**
 * Tipografi ölçeği — örnekteki Tailwind ölçeğinin mobil karşılığı.
 * `lineHeight` oranlar piksele çevrildi (RN oran kabul etmiyor).
 */
export const luxeType = {
  /** 32/1.2 — sayfa başlığı */
  display: {
    fontFamily: font.display,
    fontSize: 32,
    lineHeight: 38,
    color: luxe.ink,
  },
  /** Başlığın italik ikinci satırı (örnekte "Ethereal Luminary") */
  displayItalic: {
    fontFamily: font.displayItalic,
    fontSize: 32,
    lineHeight: 40,
    fontStyle: 'italic' as const,
    color: luxe.primary,
  },
  /** 24/1.3 — kart başlıkları */
  headline: {
    fontFamily: font.headline,
    fontSize: 22,
    lineHeight: 29,
    color: luxe.ink,
  },
  /** Hero üstündeki serif başlık */
  heroTitle: {
    fontFamily: font.display,
    fontSize: 26,
    lineHeight: 32,
    color: luxe.onDark,
  },
  /** 16/1.6 — gövde */
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
  /** 12/0.1em/700 uppercase — etiketler, düğme yazıları */
  label: {
    fontFamily: font.label,
    fontSize: 11,
    letterSpacing: 1.1,
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

export const luxeRadius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

/** Kartların yumuşak, dağınık gölgesi — örnekteki `shadow-sm` hissi. */
export const luxeShadow = {
  card: {
    shadowColor: '#74593F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  hero: {
    shadowColor: '#74593F',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 26,
    elevation: 7,
  },
} as const;
