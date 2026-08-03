import React, { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, FeDropShadow, Filter, Path } from 'react-native-svg';

/**
 * Örnek tasarımdaki `fin-curve` biçiminin BİREBİR karşılığı.
 *
 *   border-radius: 60% 40% 70% 30% / 30% 60% 40% 70%;
 *
 * Bu ELİPTİK köşe: her köşenin iki yarıçapı var (yatay = genişliğin yüzdesi,
 * dikey = yüksekliğin yüzdesi). RN'in `borderRadius`'ında karşılığı yok —
 * dört köşeye farklı piksel vermek yaklaşık bile değil, biçim "dijital"
 * duruyor. SVG'de tam karşılığı var: eliptik yay (`A rx ry ...`).
 *
 * Köşe yarıçapları (viewBox 100×100, yani doğrudan yüzde):
 *   sol üst  rx 60 ry 30   ·  sağ üst  rx 40 ry 60
 *   sağ alt  rx 70 ry 40   ·  sol alt  rx 30 ry 70
 * Her kenarda yarıçaplar toplamı tam %100 olduğu için düz kenar HİÇ kalmıyor;
 * biçimin organik görünmesinin sebebi bu.
 *
 * `preserveAspectRatio="none"`: yüzdeler CSS'te olduğu gibi kutunun ölçüsüne
 * esner.
 *
 * Gölge de SVG filtresiyle (`FeDropShadow`): RN'in gölgesi görünümün
 * DİKDÖRTGEN dış hattını kullanıyor, blobun arkasında gri bir kutu çıkıyor
 * (cihazda görüldü). Filtre gerçek biçimi takip ediyor.
 */
export function FinBlob({
  color,
  shadow,
  style,
}: {
  color: string;
  shadow?: boolean;
  /** Ek konumlandırma; varsayılan olarak kapsayıcıyı tamamen kaplar. */
  style?: StyleProp<ViewStyle>;
}) {
  /*
    Gölge payı. SVG'yi kapsayıcının DIŞINA taşırmak işe yaramıyor: Android
    çocuğu ebeveyn sınırında kırpıyor, gölge soldan ve alttan kesiliyordu
    (cihazda görüldü). Bu yüzden pay kutunun İÇİNDE: kutu bu kadar büyük,
    blob iç dikdörtgene çiziliyor.
  */
  const M = shadow ? 18 : 0;
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
        <Svg
          width={box.w}
          height={box.h}
          viewBox={`${-mx} ${-my} ${100 + 2 * mx} ${100 + 2 * my}`}
          preserveAspectRatio="none"
        >
          {shadow ? (
            <Defs>
              <Filter id="finShadow" x="-40%" y="-40%" width="180%" height="180%">
                <FeDropShadow
                  dx="0"
                  dy={my * 0.3}
                  stdDeviation={my * 0.42}
                  floodColor="#70585B"
                  floodOpacity="0.3"
                />
              </Filter>
            </Defs>
          ) : null}
          <Path
            d="M60 0 A40 60 0 0 1 100 60 A70 40 0 0 1 30 100 A30 70 0 0 1 0 30 A60 30 0 0 1 60 0 Z"
            fill={color}
            filter={shadow ? 'url(#finShadow)' : undefined}
          />
        </Svg>
      ) : null}
    </View>
  );
}

/* RN 0.86'da StyleSheet.absoluteFillObject yok — düz obje. */
const fill: ViewStyle = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 };
