import React, { useId, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, FeDropShadow, Filter, LinearGradient, Path, Stop } from 'react-native-svg';

/**
 * Organik biçimler — CSS'teki ELİPTİK köşenin SVG karşılığı.
 *
 *   border-radius: 60% 40% 70% 30% / 30% 60% 40% 70%;
 *
 * Her köşenin İKİ yarıçapı var: yatay (genişliğin yüzdesi) ve dikey
 * (yüksekliğin yüzdesi). RN'in `borderRadius`'ında karşılığı yok — dört köşeye
 * farklı piksel vermek yaklaşık bile değil, biçim "dijital" duruyor. SVG'de tam
 * karşılığı var: eliptik yay (`A rx ry ...`).
 *
 * Yol artık ELDE YAZILMIYOR, oranlardan üretiliyor (`pathOf`) — böylece aynı
 * mantıkla farklı siluetler tanımlanabiliyor.
 */

/** Bir siluet: köşe yarıçapları. Sıra saat yönünde — sol üst, sağ üst, sağ alt, sol alt. */
export interface Shape {
  /** Yatay yarıçaplar (genişliğin yüzdesi) */
  h: [number, number, number, number];
  /** Dikey yarıçaplar (yüksekliğin yüzdesi) */
  v: [number, number, number, number];
}

/**
 * Hazır siluetler.
 *
 * Bir kenardaki iki yarıçapın toplamı %100 olduğunda o kenarda DÜZ parça hiç
 * kalmıyor; biçimin organik görünmesinin sebebi bu. `card` bilerek böyle
 * DEĞİL: toplamlar 100'ün altında, yani kenarların ortası düz kalıyor ve
 * içindeki yazı taşmıyor — yalnızca köşeler elle kesilmiş gibi duruyor.
 */
export const SHAPES = {
  /** Örnekteki `fin-curve` — Bugün'ün gün kartları. */
  fin: { h: [60, 40, 70, 30], v: [30, 60, 40, 70] },
  /** Daha yuvarlak, mühür gibi. */
  pebble: { h: [46, 54, 44, 56], v: [54, 46, 56, 44] },
  /** İki köşe dolgun, iki köşe sivri — yaprak. */
  leaf: { h: [72, 28, 72, 28], v: [28, 72, 28, 72] },
  /** Yatayda salınan, dalga gibi. */
  wave: { h: [34, 66, 36, 64], v: [64, 36, 66, 34] },
  /** Kart siluetı: köşeler eğri, kenarların ortası düz (yazı taşmasın). */
  card: { h: [13, 5, 11, 7], v: [30, 13, 26, 16] },
  /**
   * DÜĞME siluetı: uçlar tam yuvarlak ama dört köşe birbirinden farklı —
   * hap gibi ama elle kesilmiş. Dikey yarıçaplar %50'ye yakın (uçlar dolgun),
   * yatay yarıçaplar küçük ve düzensiz (elle çizilmiş his).
   */
  button: { h: [26, 16, 22, 18], v: [55, 45, 52, 48] },
} as const satisfies Record<string, Shape>;

export type ShapeName = keyof typeof SHAPES;

/**
 * Gölgeli blobun kutu İÇİNDE ayırdığı pay (px).
 * Çağıranların bilmesi gerekiyor: biçimin görünen kenarı kutunun kenarı değil,
 * bu kadar içerisi. Kart gibi kenarları hizalanması gereken yerlerde bu pay
 * negatif kenar boşluğuyla geri alınıyor.
 */
export const BLOB_SHADOW_PAD = 18;

/**
 * DÜĞMEDE gölge payı. Düğme kutusu alçak: 18px pay biçimi yiyor. Çağıran
 * kendi iç boşluğuna bu kadar EKLİYOR, böylece görünen düğme eskisiyle aynı
 * boyda kalıyor, pay da gölgeye gidiyor.
 */
export const BTN_PAD = 7;

/**
 * 100×100 kutuda kapalı yol. Köşeler eliptik yay, aralar düz çizgi — yarıçap
 * toplamı %100 olan kenarlarda çizgiler sıfır uzunlukta olup kayboluyor.
 */
function pathOf({ h, v }: Shape): string {
  const [hTL, hTR, hBR, hBL] = h;
  const [vTL, vTR, vBR, vBL] = v;
  return [
    `M ${hTL} 0`,
    `L ${100 - hTR} 0`,
    `A ${hTR} ${vTR} 0 0 1 100 ${vTR}`,
    `L 100 ${100 - vBR}`,
    `A ${hBR} ${vBR} 0 0 1 ${100 - hBR} 100`,
    `L ${hBL} 100`,
    `A ${hBL} ${vBL} 0 0 1 0 ${100 - vBL}`,
    `L 0 ${vTL}`,
    `A ${hTL} ${vTL} 0 0 1 ${hTL} 0`,
    'Z',
  ].join(' ');
}

/**
 * `preserveAspectRatio="none"`: yüzdeler CSS'te olduğu gibi kutunun ölçüsüne
 * esner.
 *
 * Gölge SVG filtresiyle (`FeDropShadow`): RN'in gölgesi görünümün DİKDÖRTGEN
 * dış hattını kullanıyor, blobun arkasında gri bir kutu çıkıyor (cihazda
 * görüldü). Filtre gerçek biçimi takip ediyor.
 */
export function FinBlob({
  color,
  gradient,
  shadow,
  pad,
  stroke,
  strokeWidth = 1,
  variant = 'fin',
  style,
}: {
  color: string;
  /**
   * İridesan geçiş (petrol → mor → magenta). Verilirse `color` yerine bu
   * kullanılır — markanın kimliği düz renk değil, geçiş.
   */
  gradient?: readonly string[];
  shadow?: boolean;
  /**
   * Gölge/çizgi payı (px). Varsayılan `BLOB_SHADOW_PAD`; düğme gibi ALÇAK
   * kutularda 18px payı biçimi yiyor, oralarda küçük bir değer veriliyor.
   */
  pad?: number;
  /**
   * Dış hat rengi — çerçeveli (hayalet) düğmeler için.
   *
   * ⚠️ `shadow` ile BİRLİKTE kullanma: çok basık kutularda (düğme) filtre
   * biçimi ALTTAN KIRPIYOR — profildeki eylem düğmelerinde ölçüldü, kutu
   * 134×44 doğru ölçülmesine rağmen biçim yarıda kesiliyordu. Çerçeveli
   * düğme zaten gölge istemiyor.
   */
  stroke?: string;
  strokeWidth?: number;
  /** Hangi siluet — bkz. `SHAPES`. */
  variant?: ShapeName;
  /** Ek konumlandırma; varsayılan olarak kapsayıcıyı tamamen kaplar. */
  style?: StyleProp<ViewStyle>;
}) {
  /*
    Gölge payı. SVG'yi kapsayıcının DIŞINA taşırmak işe yaramıyor: Android
    çocuğu ebeveyn sınırında kırpıyor, gölge soldan ve alttan kesiliyordu
    (cihazda görüldü). Bu yüzden pay kutunun İÇİNDE: kutu bu kadar büyük,
    blob iç dikdörtgene çiziliyor.
  */
  /*
    Çizgi (stroke) yolun ÜSTÜNE ortalanır: yol tam kenara çizilirse çizginin
    yarısı kutunun dışında kalıp kırpılır. Bu yüzden çizgili biçimde kutu
    içinde bir kalınlık kadar pay bırakılıyor.
  */
  const M = pad ?? (shadow ? BLOB_SHADOW_PAD : stroke ? Math.ceil(strokeWidth) : 0);
  /*
    Benzersiz id: aynı ekranda birden fazla blob var (gün kartı, hava rozeti,
    sekme, palet lekeleri). Sabit id verilirse tanımlar birbirini eziyor.
  */
  const uid = useId().replace(/:/g, '_');
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  /*
    viewBox payı ÖLÇÜLEREK hesaplanıyor, göz kararı değil: yüzde cinsinden
    pay = 100 × M / kutuBoyutu. Böylece yolun 0–100 aralığı görünen kutunun
    tam sınırlarına oturuyor, kalan yer de gölgenin oluyor.
  */
  const cw = box ? box.w - 2 * M : 0;
  const ch = box ? box.h - 2 * M : 0;
  const mx = cw > 0 ? (100 * M) / cw : 0;
  const my = ch > 0 ? (100 * M) / ch : 0;

  return (
    <View
      style={[fill, style]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((b) => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
      }}
    >
      {box && cw > 0 && ch > 0 ? (
        /*
          Ölçü YALNIZCA payın yüzdesini hesaplamak için; SVG'nin kendisi
          kapsayıcıyı yüzdeyle dolduruyor. Piksel verilirse bayat bir ölçüm
          (esneyen satırda çocuk sonradan uzuyor) biçimi ALTTAN KIRPIYOR —
          profildeki eylem düğmelerinde görüldü.
        */
        <Svg
          width="100%"
          height="100%"
          viewBox={`${-mx} ${-my} ${100 + 2 * mx} ${100 + 2 * my}`}
          preserveAspectRatio="none"
        >
          <Defs>
            {gradient ? (
              <LinearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
                {gradient.map((c, i) => (
                  <Stop key={i} offset={i / (gradient.length - 1)} stopColor={c} />
                ))}
              </LinearGradient>
            ) : null}
            {shadow ? (
              <Filter id={`s${uid}`} x="-40%" y="-40%" width="180%" height="180%">
                <FeDropShadow
                  dx="0"
                  dy={my * 0.3}
                  stdDeviation={my * 0.42}
                  floodColor="#2A2430"
                  floodOpacity="0.28"
                />
              </Filter>
            ) : null}
          </Defs>
          <Path
            d={pathOf(SHAPES[variant])}
            fill={gradient ? `url(#g${uid})` : color}
            stroke={stroke}
            strokeWidth={stroke ? strokeWidth : undefined}
            /*
              `preserveAspectRatio="none"` viewBox'ı iki eksende FARKLI
              ölçeklediği için çizgi kalınlığı da bozulurdu — bu, kalınlığı
              ölçekten muaf tutuyor.
            */
            vectorEffect={stroke ? 'non-scaling-stroke' : undefined}
            filter={shadow ? `url(#s${uid})` : undefined}
          />
        </Svg>
      ) : null}
    </View>
  );
}

/* RN 0.86'da StyleSheet.absoluteFillObject yok — düz obje. */
const fill: ViewStyle = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 };
