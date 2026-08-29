/**
 * BETTA — "İnci Küre" paleti (deneme).
 *
 * Kaynak: kullanıcının paylaştığı cam/inci dünya görseli. Renkler görselden
 * okundu; buradaki her ton görselde KARŞILIĞI OLAN bir yüzeyden geliyor,
 * uydurma ara renk yok.
 *
 * Görselin karakteri — palet bunu korumak zorunda:
 * 1. SAF BEYAZ VE SAF SİYAH YOK. En açık nokta bile kremimsi (~#FDFBF6), en
 *    koyu nokta kahverengi-bronz (~#7A4E3A). Bu yüzden nötrlerin hepsi sıcağa
 *    çalıyor; #FFFFFF ve #000000 kullanılmıyor.
 * 2. TEK DOYGUN RENK: kürenin kenarlarındaki gül kurusu/bakır metal. Geri
 *    kalan her şey düşük doygunlukta. Renk bu yüzden AZ yerde ve KÜÇÜK
 *    yüzeylerde durmalı; geniş yüzeye yayılınca görselin sakinliği gidiyor.
 * 3. İNCİ ETKİSİ SICAK-SOĞUK KARŞITLIĞINDAN geliyor: sıcak krem zeminin
 *    üstünde soğuk leylak/mavi parıltılar (#D8D8EC, #CCCFE6). Parıltıları
 *    atarsan elde kalan şey sadece "bej" olur.
 * 4. IŞIK YÜKSEK ANAHTARLI (high-key): tonların çoğu 0.85–0.98 parlaklık
 *    aralığında, koyu alan çok dar. Gölgeler bu yüzden derin değil, geniş ve
 *    yumuşak; siyaha değil kahveye düşüyor.
 *
 * ⚠️ Bu dosya `luxe.ts`'i DEĞİŞTİRMİYOR. Şimdilik yalnızca Bugün ekranı
 * kullanıyor (deneme): ekran `luxe` yerine bunu içeri alıyor, diğer ekranlar
 * eski paletle çalışmaya devam ediyor. API birebir aynı ki geçiş/geri dönüş
 * tek satır olsun.
 */

import { font } from '@/theme/luxe';

export const pearl = {
  /* ————— Zemin: görselin AÇIK kumu ————— */
  /*
    Zemin bilerek yüksek anahtarlı: görselde kürenin çevresi doygun bir bej
    değil, ışığın içinde erimiş açık kum. Koyu bej denendi, sayfa hemen
    "toprak" gibi ağırlaştı ve inci parıltısı kayboldu.
  */
  /** Kumun ana tonu — görselin en geniş alanı */
  bg: '#FAF6EE',
  /** Kürenin arkasındaki ışık halesi (en açık nokta) */
  bgGlow: '#FFFDF9',
  /** Köşelere düşen kum (ışığın uzağı) — yine açık */
  bgEdge: '#F2EADC',

  /**
   * Yüzey: BEYAZ DEĞİL, LEYLAĞA çalan inci beyazı. Görselde kürenin gövdesi
   * kremin üstünde soğuk bir parıltı taşıyor; kartlar bu yüzden zeminden
   * hafifçe MAVİ-MOR tarafa ayrılıyor. Kartı da kremleştirmek her şeyi tek
   * bir bej lekeye çeviriyordu.
   */
  surface: '#FBF8FD',
  surfaceLow: '#F3EFF8',
  surfaceMid: '#E9E3F1',
  surfaceHigh: '#DCD5E8',

  /* ————— Mürekkep: kürenin en koyu bronzu ————— */
  /**
   * Metin rengi görseldeki en koyu kıta çizgisinden alındı ve okunabilirlik
   * için koyulaştırıldı: sıcak kahve-eriği. Nötr siyah bu paletin içinde
   * yabancı duruyor — krem zeminle yan yana mavimsi/kirli görünüyor.
   */
  primary: '#3B2A24',
  primaryDeep: '#2A1D19',
  /** Gül kurusu metalin pastel karşılığı — düz renk gereken yerlerde */
  primaryContainer: '#F3DDCE',
  primarySoft: '#D8B7A3',

  /* ————— Nötr kum ————— */
  secondary: '#6B564C',
  secondaryContainer: '#F1E7D9',
  onSecondaryContainer: '#6A5648',

  /* ————— Metin katmanları ————— */
  ink: '#3B2A24',
  inkSoft: '#6B564C',
  outline: '#9C877C',
  outlineSoft: '#E0D2C2',

  danger: '#B3261E',
  onPrimary: '#FFF8F1',

  onDark: '#FFF8F1',
  onDarkSoft: 'rgba(255,248,241,0.85)',

  /**
   * Hero perdesi — kürenin alt gölgesinden gelen sıcak bronz-kahve.
   * Kömür grisi denenmedi: bu palette griye düşen her şey görseldeki sıcak
   * havayı kesiyor.
   */
  scrim: '#3A2620',
  scrimRgb: '58,38,32',
  overlay: 'rgba(59,42,36,0.5)',

  /** Gölge — nötr siyah değil, kürenin altındaki kahve */
  shadow: '#6E4C3E',

  /**
   * IŞILTILI BAKIR — görselde kıtaların metali. Küçük ve KOYU yüzeyler için
   * (seçili gün). Üstüne krem yazı geliyor, o yüzden açık uç bile yeterince
   * koyu: parlak şeftali tonunda krem metin okunmuyordu.
   */
  copper: '#96593A',
  onCopper: '#FFF6EC',
} as const;

/**
 * Görseldeki METAL ve PARILTI. Düz renk olarak değil geçiş olarak
 * kullanılıyor — kürenin kenarındaki gül kurusu da tek renk değil, açıktan
 * bakıra dönen bir geçiş.
 */
export const pearlIridescent = {
  /**
   * Doygun uç — ince/küçük yüzeyler (ilerleme çubuğu).
   * Bakır → gül kurusu → soğuk leylak: görselin sıcak-soğuk salınımı.
   */
  full: ['#C07A5B', '#E2A184', '#B4AECD'],
  /**
   * Pastel — geniş yüzeyler (blob, seçili gün). Üstündeki koyu yazı
   * okunabilsin diye üç ton da yüksek parlaklıkta.
   * Şeftali → inci → periwinkle: kürenin gövdesindeki geçişin ta kendisi.
   */
  soft: ['#F7E0D0', '#F1E7EE', '#DCE0F0'],
  /**
   * Metalin KENDİSİ: açık bakırdan koyu bronza. Seçili gün "yamuğu" bu
   * geçişle doluyor — görseldeki kıta kenarları da tek renk değil, ışığa
   * dönen bir metal.
   */
  copper: ['#C68A5F', '#96593A', '#6E3F28'],
} as const;

/**
 * Cam yüzey. Görseldeki cam SICAK: arkasındaki kremi geçirdiği için
 * beyazımsı değil, süt-krem. Saf beyaz saydamlık bu zeminde soğuk bir sis
 * gibi duruyordu.
 */
export const pearlGlass = {
  fill: 'rgba(255,252,247,0.62)',
  fillStrong: 'rgba(255,252,247,0.80)',
  border: 'rgba(255,252,247,0.78)',
} as const;

/**
 * Gölgeler: görseldeki gibi GENİŞ ve YUMUŞAK, koyu değil. Kürenin gölgesi
 * keskin bir leke değil, zemine yayılan sıcak bir koyulaşma.
 */
export const pearlShadow = {
  card: {
    shadowColor: '#6E4C3E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  hero: {
    shadowColor: '#6E4C3E',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 36,
    elevation: 20,
  },
} as const;

/**
 * Tipografi ÖLÇEĞİ değişmiyor — yalnızca renkler paletten geliyor.
 * (`luxeType` ile birebir aynı boyutlar; ekran alias ile bunu kullanıyor.)
 */
export const pearlType = {
  display: { fontFamily: font.display, fontSize: 32, lineHeight: 40, color: pearl.primary },
  displayItalic: {
    fontFamily: font.displayItalic,
    fontSize: 32,
    lineHeight: 40,
    fontStyle: 'italic' as const,
    color: pearl.primary,
  },
  headline: { fontFamily: font.headline, fontSize: 22, lineHeight: 30, color: pearl.primary },
  headlineItalic: {
    fontFamily: font.headlineItalic,
    fontSize: 22,
    lineHeight: 30,
    fontStyle: 'italic' as const,
    color: pearl.primary,
  },
  heroTitle: { fontFamily: font.display, fontSize: 28, lineHeight: 34, color: pearl.onDark },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 24, color: pearl.inkSoft },
  bodyStrong: { fontFamily: font.bodyMedium, fontSize: 15, lineHeight: 24, color: pearl.ink },
  label: {
    fontFamily: font.label,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: pearl.outline,
  },
  caption: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: pearl.outline },
  title: { fontFamily: font.headline, fontSize: 20, lineHeight: 27, color: pearl.primary },
  subtitle: { fontFamily: font.bodyMedium, fontSize: 15, lineHeight: 22, color: pearl.ink },
  tiny: { fontFamily: font.body, fontSize: 11, lineHeight: 16, color: pearl.outline },
} as const;
