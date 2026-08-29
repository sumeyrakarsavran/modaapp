import React from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { COUNTRIES, globePath } from '@/services/geo';
import { font, luxe, luxeType } from '@/theme/luxe';

/**
 * İnci küre — Global akışının başındaki giriş.
 *
 * Kürenin üstündeki kıtalar TEMSİLÎ ÇİZİM DEĞİL: harita ekranının kullandığı
 * gerçek sınır verisinin (Natural Earth) ortografik izdüşümü. Aynı veriden
 * çizilince küre ile harita aynı dünyayı gösteriyor.
 *
 * Derinlik boya ile veriliyor: içeriden dışarı açılan inci geçişi, sol üstte
 * sıcak bir parıltı, sağ altta soğuk bir gölge ve kenarda ince bir hale.
 * Gerçek 3B (GL) için ayrı bir motor gerekirdi; bu haliyle de küre duruyor
 * ve tek karede çiziliyor — kaydırırken bedeli yok.
 */
export function PearlGlobe({ size = 190, onPress }: { size?: number; onPress?: () => void }) {
  const r = size / 2;
  // Kıtalar kürenin biraz İÇİNDE kalıyor; tam yarıçapta kenara yapışıyorlar.
  const gr = r * 0.94;

  /* Yollar bir kez hesaplanıyor: 177 ülke her karede çizilecek şey değil. */
  const paths = React.useMemo(
    () => COUNTRIES.map((c) => globePath(c, gr)).filter((d) => d.length > 8),
    [gr],
  );

  /*
    Hafif salınım: küre yerinde asılı duruyormuş gibi. Dönme DEĞİL — dönmek
    için yolların her karede yeniden hesaplanması gerekirdi (177 ülke × JS).
  */
  const float = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 3800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 3800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [4, -4] });

  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Svg width={size} height={size} viewBox={`${-r} ${-r} ${size} ${size}`}>
          <Defs>
            {/* Gövde: ortada sıcak inci, kenara doğru leylak */}
            <RadialGradient id="pgBody" cx="38%" cy="32%" r="78%">
              <Stop offset="0" stopColor="#FFFDFA" />
              <Stop offset="0.42" stopColor="#F6EAE6" />
              <Stop offset="0.72" stopColor="#E9E2F0" />
              <Stop offset="1" stopColor="#D9CFDC" />
            </RadialGradient>
            {/* Sol üst parıltı */}
            <RadialGradient id="pgHi" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
            {/* Sağ altta şeftali yansıma — kürenin içinden geçen ışık */}
            <RadialGradient id="pgWarm" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#F3C6AC" stopOpacity="0.55" />
              <Stop offset="1" stopColor="#F3C6AC" stopOpacity="0" />
            </RadialGradient>
            {/* Kıta metali: açık bakırdan gül kurusuna */}
            <RadialGradient id="pgMetal" cx="30%" cy="25%" r="85%">
              <Stop offset="0" stopColor="#F6D6C3" />
              <Stop offset="0.55" stopColor="#E3A484" />
              <Stop offset="1" stopColor="#C97E5C" />
            </RadialGradient>
            {/* Kenar halesi: kürenin ucunda ışık kırılması */}
            <RadialGradient id="pgRim" cx="50%" cy="50%" r="50%">
              <Stop offset="0.82" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="0.96" stopColor="#F7DCCB" stopOpacity="0.75" />
              <Stop offset="1" stopColor="#E0B294" stopOpacity="0.9" />
            </RadialGradient>
          </Defs>

          <Circle cx="0" cy="0" r={r} fill="url(#pgBody)" />
          <Ellipse cx={-r * 0.3} cy={-r * 0.34} rx={r * 0.46} ry={r * 0.36} fill="url(#pgHi)" />
          <Ellipse cx={r * 0.26} cy={r * 0.3} rx={r * 0.5} ry={r * 0.42} fill="url(#pgWarm)" />

          {/* Kıtalar — kürenin ön yüzü */}
          <G opacity={0.92}>
            {paths.map((d, i) => (
              <Path key={i} d={d} fill="url(#pgMetal)" stroke="#C97E5C" strokeWidth={0.5} />
            ))}
          </G>

          {/* Camın kendi parlaklığı en üstte: kıtalar da camın altında kalsın */}
          <Ellipse
            cx={-r * 0.28}
            cy={-r * 0.4}
            rx={r * 0.34}
            ry={r * 0.2}
            fill="#FFFFFF"
            opacity={0.5}
          />
          <Circle cx="0" cy="0" r={r} fill="url(#pgRim)" />
        </Svg>
      </Animated.View>

      <View style={styles.caption}>
        <Text style={[luxeType.label, { color: luxe.primary }]}>Global stil</Text>
        <Text style={styles.sub}>Haritada kim ne giyiyor — dokun, gez</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 6, paddingBottom: 18 },
  caption: { alignItems: 'center', gap: 3, marginTop: 2 },
  sub: { fontFamily: font.body, fontSize: 12.5, color: luxe.outline },
});
