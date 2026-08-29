import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Sessiz, döngüde oynayan video.
 *
 * ⚠️ Bu dosya `expo-video`'yu DOĞRUDAN (statik) içeri alıyor: modül eksikse
 * import anında patlıyor. O yüzden çağıran taraf dosyayı try/catch içinde
 * `require` ediyor (bkz. `VideoBox`) ve modül yoksa kapak fotoğrafına
 * düşüyor — native modül kuralı (AGENTS.md) böyle korunuyor.
 *
 * Ses KAPALI: vitrinde de görüntüleyicide de kullanıcının müziğini kesmesin
 * (FASHN çıktılarında ses parçası yok).
 */
export function LoopingVideo({
  uri,
  active,
  style,
  fit = 'cover',
  controls = false,
  onAspect,
}: {
  uri: string;
  /** Ekranda görünüyor mu — görünmezken oynatma boşuna pil yakıyor. */
  active: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Vitrinde "cover" (kutu videonun oranında, yuvarlama farkı kapansın),
   * görüntüleyicide "contain" (koyu zeminde tamamı görünsün).
   */
  fit?: 'cover' | 'contain';
  /** Görüntüleyicide oynat/durdur ve ilerleme çubuğu. */
  controls?: boolean;
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
    if (!onAspect) return;
    const report = (t: { size: { width: number; height: number } } | null) => {
      if (t && t.size.height > 0) onAspect(t.size.width / t.size.height);
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
      contentFit={fit}
      nativeControls={controls}
      /* Vitrin karesi: PiP burada anlamsız. */
      allowsPictureInPicture={false}
    />
  );
}
