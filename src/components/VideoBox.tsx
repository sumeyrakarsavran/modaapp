import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { luxe } from '@/theme/luxe';

/*
  `expo-video` NATIVE modül. Eski bir derlemede yoksa dosyanın import'u
  patlar, o yüzden try/catch ile alınıyor: modül yoksa kapak karesi + oynat
  rozeti gösteriliyor, özellik sessizce atlanıyor (AGENTS.md: native
  modüller korumalı çağrılır).
*/
let LoopingVideo: typeof import('@/components/LoopingVideo').LoopingVideo | null = null;
try {
  LoopingVideo = (require('@/components/LoopingVideo') as typeof import('@/components/LoopingVideo'))
    .LoopingVideo;
} catch {
  LoopingVideo = null;
}

/**
 * Kapak fotoğrafı + üstünde oynayan video.
 *
 * Kapak ALTTA duruyor: oynatıcı ilk kareyi çizene kadar kutu boş/siyah
 * kalmasın diye. Hem vitrin kartı hem büyütülmüş görüntüleyici bunu
 * kullanıyor; tek fark `fit` ve `controls`.
 */
export function VideoBox({
  videoUri,
  posterUri,
  active,
  fit = 'cover',
  controls = false,
  style,
  onPosterAspect,
  onVideoAspect,
}: {
  videoUri: string;
  posterUri?: string;
  active: boolean;
  fit?: 'cover' | 'contain';
  controls?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Kapağın oranı — kutu, oynatıcı hazır olmadan da doğru boyda dursun. */
  onPosterAspect?: (aspect: number) => void;
  /** Videonun GERÇEK oranı; kapağınkiyle birebir aynı olmayabiliyor. */
  onVideoAspect?: (aspect: number) => void;
}) {
  return (
    <View style={[styles.fill, style]}>
      {posterUri ? (
        <Image
          source={{ uri: posterUri }}
          /* RN 0.86'da `StyleSheet.absoluteFillObject` yok — düz obje. */
          style={[styles.fill, { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }]}
          contentFit={fit}
          onLoad={
            onPosterAspect
              ? (e) => {
                  const s = e.source;
                  if (s && s.height > 0) onPosterAspect(s.width / s.height);
                }
              : undefined
          }
        />
      ) : null}
      {LoopingVideo ? (
        <LoopingVideo
          uri={videoUri}
          active={active}
          style={styles.fill}
          fit={fit}
          controls={controls}
          onAspect={onVideoAspect}
        />
      ) : (
        <View style={[styles.fill, styles.center]}>
          <Ionicons name="play" size={26} color={luxe.onDark} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
