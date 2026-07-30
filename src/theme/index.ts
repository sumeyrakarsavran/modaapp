/**
 * BETTA tasarım sistemi — betta balığı / okyanus teması.
 * Derin deniz lacivertleri + betta yüzgeçlerinin canlı renkleri.
 */

export const colors = {
  // Zemin
  background: '#F2FAFB', // deniz köpüğü
  card: '#FFFFFF',
  deep: '#062A3A', // derin okyanus — koyu zeminler, splash
  deepSoft: '#0E4A5E',

  // Metin
  ink: '#0B2733',
  inkSoft: '#4A6572',
  inkFaint: '#8AA4AE',

  // Betta aksanları
  aqua: '#00B4D8', // ana aksan — iridescent turkuaz
  aquaDark: '#0090B0',
  aquaSoft: '#D6F3F9',
  coral: '#FF4D6D', // betta kızılı — vurgu / favori
  coralSoft: '#FFE3E9',
  violet: '#7B5EA7', // mor yüzgeç
  violetSoft: '#EDE6F7',
  gold: '#F4B942', // koi sarısı
  goldSoft: '#FCF0D7',
  seagreen: '#2EC4B6',
  seagreenSoft: '#DCF5F2',

  // Durum
  success: '#2EC4B6',
  warning: '#F4B942',
  danger: '#E5383B',

  border: '#E3EEF1',
  overlay: 'rgba(6,42,58,0.55)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const type = {
  /** Büyük serif başlıklar (Whering'deki editorial hava) */
  display: {
    fontSize: 32,
    fontWeight: '600' as const,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.ink },
  subtitle: { fontSize: 16, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.ink },
  caption: { fontSize: 12.5, fontWeight: '500' as const, color: colors.inkSoft },
  tiny: { fontSize: 11, fontWeight: '500' as const, color: colors.inkFaint },
} as const;

export const shadow = {
  card: {
    shadowColor: '#062A3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  float: {
    shadowColor: '#062A3A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

/** Betta türleri → stil arketipleri. Uygulamanın kimlik sistemi. */
export interface BettaArchetype {
  id: string;
  fish: string; // betta türü
  styleName: string; // stil adı
  emoji: string;
  color: string;
  colorSoft: string;
  tagline: string;
  description: string;
  keywords: string[]; // kıyafet etiketleriyle eşleşen stil anahtar kelimeleri
}

export const BETTA_ARCHETYPES: BettaArchetype[] = [
  {
    id: 'halfmoon',
    fish: 'Halfmoon Betta',
    styleName: 'Zarif',
    emoji: '🌙',
    color: '#7B5EA7',
    colorSoft: '#EDE6F7',
    tagline: '180° açılan kuyruk, kusursuz duruş.',
    description:
      'Halfmoon gibi her detayın yerli yerinde. Klasik kesimler, ipeksi kumaşlar, zamansız parçalar senin imzan.',
    keywords: ['klasik', 'şık', 'elegant', 'ofis', 'blazer', 'ipek', 'midi'],
  },
  {
    id: 'crowntail',
    fish: 'Crowntail Betta',
    styleName: 'Asi',
    emoji: '🔥',
    color: '#E5383B',
    colorSoft: '#FBE2E2',
    tagline: 'Taç gibi dikenli yüzgeçler, kural tanımaz.',
    description:
      'Crowntail\'in sivri yüzgeçleri gibi keskin bir tarzın var. Deri, metal detaylar, siyahın elli tonu.',
    keywords: ['deri', 'rock', 'siyah', 'bot', 'zincir', 'denim', 'oversize'],
  },
  {
    id: 'veiltail',
    fish: 'Veiltail Betta',
    styleName: 'Romantik',
    emoji: '🌸',
    color: '#FF4D6D',
    colorSoft: '#FFE3E9',
    tagline: 'Duvak gibi süzülen kuyruk, yumuşacık.',
    description:
      'Veiltail\'in akışkan kuyruğu gibi uçuşan elbiseler, pastel tonlar, dantel ve fırfır sana yakışıyor.',
    keywords: ['elbise', 'pastel', 'çiçek', 'dantel', 'fırfır', 'pembe', 'etek'],
  },
  {
    id: 'plakat',
    fish: 'Plakat Betta',
    styleName: 'Sportif',
    emoji: '⚡',
    color: '#00B4D8',
    colorSoft: '#D6F3F9',
    tagline: 'Kısa yüzgeç, saf enerji.',
    description:
      'Plakat gibi pratik ve hızlısın. Sneaker, athleisure, rahat ama iddialı parçalar senin dünyanın.',
    keywords: ['spor', 'sneaker', 'eşofman', 'crop', 'rahat', 'tayt', 'hoodie'],
  },
  {
    id: 'koi',
    fish: 'Koi Betta',
    styleName: 'Renkli',
    emoji: '🎨',
    color: '#F4B942',
    colorSoft: '#FCF0D7',
    tagline: 'Her pulda başka bir desen.',
    description:
      'Koi betta\'nın benekleri gibi tarzın da öngörülemez. Desen üstüne desen, cesur renkler, vintage hazineler.',
    keywords: ['desen', 'renkli', 'vintage', 'retro', 'baskı', 'karma', 'aksesuar'],
  },
  {
    id: 'dumbo',
    fish: 'Dumbo Betta',
    styleName: 'Rahat',
    emoji: '☁️',
    color: '#2EC4B6',
    colorSoft: '#DCF5F2',
    tagline: 'Fil kulağı yüzgeçler, yumuşak süzülüş.',
    description:
      'Dumbo\'nun geniş yüzgeçleri gibi bol ve konforlu seviyorsun. Örgü triko, bol paça, doğal tonlar.',
    keywords: ['triko', 'bol', 'bej', 'keten', 'basic', 'minimal', 'konfor'],
  },
];

export function getArchetype(id?: string | null): BettaArchetype | undefined {
  return BETTA_ARCHETYPES.find((a) => a.id === id);
}
