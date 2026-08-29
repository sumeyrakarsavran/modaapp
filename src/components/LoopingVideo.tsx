import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Sessiz, döngüde oynayan küçük video — vitrinde GIF gibi duruyor.
 *
 * ⚠️ Bu dosya `expo-video`'yu DOĞRUDAN (statik) içeri alıyor: modül eksikse
 * import anında patlıyor. O yüzden çağıran taraf dosyayı try/catch içinde
 * `require` ediyor (bkz. `VideoShowcase`) ve modül yoksa kapak fotoğrafına
 * düşüyor — native modül kuralı (AGENTS.md) böyle korunuyor.
 *
 * Ses KAPALI ve denetimler gizli: kart bir oynatıcı değil, vitrin.
 */
export function LoopingVideo({
  uri,
  active,
  style,
  onAspect,
}: {
  uri: string;
  /** Kart ekranda görünüyor mu — görünmezken oynatma boşuna pil yakıyor. */
  active: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Videonun GERÇEK oranı. Kutu kapak fotoğrafının oranıyla çizilirse
   * (video biraz farklı oranda geliyor) kenarlarda siyah şerit kalıyor;
   * oran oynatıcıdan öğrenilince kutu videoya tam oturuyor.
   */
  onAspect?: (aspect: number) => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  React.useEffect(() => {
    const report = (t: { size: { width: number; height: number } } | null) => {
      if (t && t.size.height > 0) onAspect?.(t.size.width / t.size.height);
    };
    // Parça zaten çözülmüş olabilir: önce mevcut değere bakılıyor.
    try {
      report(player.videoTrack);
    } catch {}
    const sub = player.addListener('videoTrackChange', (e) => report(e.videoTrack));
    return () => sub.remove();
  }, [player, onAspect]);

  React.useEffect(() => {
    // Oynatıcı hazır değilse çağrılar sessizce düşebiliyor; sarmalanıyor.
    try {
      if (active) player.play();
      else player.pause();
    } catch {}
  }, [active, player]);

  return (
    <VideoView
      player={player}
      style={style}
      /*
        Kutu zaten videonun oranında (`onAspect`); "cover" yuvarlama
        farkından kalan ince siyah şeridi de kapatıyor. "contain" ile
        kenarda birkaç piksellik kara bant kalıyordu.
      */
      contentFit="cover"
      nativeControls={false}
      /* Vitrin karesi: PiP burada anlamsız. */
      allowsPictureInPicture={false}
    />
  );
}
