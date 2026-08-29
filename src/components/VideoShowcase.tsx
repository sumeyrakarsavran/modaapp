import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';

import { Frame, ShowcaseCard, aspectOf, showcase } from '@/components/ShowcaseCard';
import { luxe } from '@/theme/luxe';

/*
  `expo-video` NATIVE modül. Eski bir derlemede yoksa dosyanın import'u
  patlar, o yüzden try/catch ile alınıyor: modül yoksa vitrin videonun
  kapak karesini gösterip oynat rozeti koyuyor, özellik sessizce atlanıyor
  (AGENTS.md: native modüller dinamik/korumalı çağrılır).
*/
let LoopingVideo: typeof import('@/components/LoopingVideo').LoopingVideo | null = null;
try {
  LoopingVideo = (require('@/components/LoopingVideo') as typeof import('@/components/LoopingVideo'))
    .LoopingVideo;
} catch {
  LoopingVideo = null;
}

/**
 * Videonun VİTRİNİ: giydirilmiş kare → hareket eden video.
 *
 * Sanal deneme kartıyla aynı kabuğu kullanıyor (`ShowcaseCard`), çünkü ikisi
 * de aynı soruyu cevaplıyor: "bu bana ne yapacak?". Fark, sonucun hareketli
 * olması — video kart ekranda GÖRÜNDÜĞÜNDE sessizce ve döngüde oynuyor.
 *
 * Örnek yine TEMSİLÎ DEĞİL: kullanıcının kendi son videosu. Videosu yoksa
 * sonuç karesi kesikli çerçeveyle boş kalıyor.
 */
export function VideoShowcase({
  frameUri,
  videoUri,
  posterUri,
  active,
  status,
  ctaLabel,
  onPress,
  onLayout,
}: {
  /** Girdi: mankenin kombinli fotoğrafı (bir sanal giydirme karesi). */
  frameUri?: string;
  /** Kullanıcının son videosu — yoksa kare boş kalır. */
  videoUri?: string;
  /** Videonun kapak karesi; oranı buradan okunuyor. */
  posterUri?: string;
  /** Kart ekranda mı — oynatma buna bağlı. */
  active: boolean;
  status: string;
  ctaLabel: string;
  onPress: () => void;
  onLayout?: (y: number, height: number) => void;
}) {
  const [frameAspect, setFrameAspect] = React.useState<number>();
  /*
    Kutunun oranı önce KAPAKTAN geliyor (oynatıcı hazır olana kadar kutu
    zıplamasın diye), video parçası çözülünce videonun KENDİ oranıyla
    değiştiriliyor — ikisi birebir aynı değil ve fark kenarda siyah şerit
    bırakıyordu.
  */
  const [posterAspect, setPosterAspect] = React.useState<number>();
  const [videoAspect, setVideoAspect] = React.useState<number>();
  const onVideoAspect = React.useCallback(
    (a: number) => setVideoAspect((cur) => (cur && Math.abs(cur - a) < 0.001 ? cur : a)),
    [],
  );

  return (
    <ShowcaseCard
      label="Video"
      title="Kombinin hareket etsin"
      note="Giydirdiğin kareyi seç; yapay zeka 5 ya da 10 saniyelik kısa videoya çevirsin."
      status={status}
      ctaLabel={ctaLabel}
      onPress={onPress}
      onLayout={onLayout}
      resultAspect={videoAspect ?? posterAspect}
      resultEmpty={!videoUri}
      resultCaption="Video"
      inputs={
        <Frame label="Giydirilmiş kare" aspect={frameAspect}>
          {frameUri ? (
            <Image
              source={{ uri: frameUri }}
              style={showcase.fill}
              contentFit="contain"
              onLoad={(e) => setFrameAspect(aspectOf(e))}
            />
          ) : (
            <Ionicons name="person-outline" size={22} color={luxe.outlineSoft} />
          )}
        </Frame>
      }
      result={
        videoUri ? (
          <View style={showcase.fill}>
            {/*
              Kapak videonun ALTINDA duruyor: oynatıcı ilk kareyi çizene
              kadar kutu boş/siyah kalmasın diye.
            */}
            {posterUri ? (
              <Image
                source={{ uri: posterUri }}
                style={[showcase.fill, { position: 'absolute' }]}
                contentFit="contain"
                onLoad={(e) => setPosterAspect(aspectOf(e))}
              />
            ) : null}
            {LoopingVideo ? (
              <LoopingVideo
                uri={videoUri}
                active={active}
                style={showcase.fill}
                onAspect={onVideoAspect}
              />
            ) : (
              <View style={[showcase.fill, { alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="play" size={26} color={luxe.onDark} />
              </View>
            )}
          </View>
        ) : (
          <Ionicons name="film-outline" size={26} color={luxe.outlineSoft} />
        )
      }
    />
  );
}
