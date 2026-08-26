import { startJob } from '@/services/tryon';

/**
 * FASHN `image-to-video`: bir kareyi kısa videoya çeviriyor.
 *
 * Doküman (docs.fashn.ai/api-reference/image-to-video, kontrol 2026-08):
 * - `model_name: 'image-to-video'`
 * - girdiler: `image` (zorunlu), `prompt`, `duration` (5 | 10), `resolution`
 *   ('480p' | '720p' | '1080p'), `end_image`
 * - çıktı: `output` dizisinde MP4 adresi (şimdilik tek video)
 *
 * İş başlatma/bekleme akışı sanal denemeyle AYNI uçtan gidiyor (`/v1/run`,
 * `/v1/status/:id`), o yüzden `startJob` ve `waitForJob` paylaşılıyor.
 */
export type VideoResolution = '480p' | '720p' | '1080p';
export type VideoDuration = 5 | 10;

/** Kredi tablosu (doküman, 2026-08): 10 saniye 5 saniyenin iki katı. */
export const VIDEO_CREDITS: Record<VideoDuration, Record<VideoResolution, number>> = {
  5: { '480p': 1, '720p': 3, '1080p': 6 },
  10: { '480p': 2, '720p': 6, '1080p': 12 },
};

/**
 * Hareket yönergesi.
 *
 * Doküman AÇIKÇA "detaylı prompt önerilmez, hareketi kontrol etmek zor;
 * en iyi sonuç için boş bırakın" diyor. Bu yüzden metin KISA: yalnızca
 * kadrajın ve kıyafetin bozulmamasını istiyoruz.
 */
export const VIDEO_PROMPT =
  'Subtle, natural fashion motion: slight body sway and fabric movement. Keep the same person, ' +
  'outfit, framing and background.';

export interface VideoOptions {
  duration?: VideoDuration;
  resolution?: VideoResolution;
  /** Kullanıcının yazdığı ek hareket notu. */
  prompt?: string;
}

export async function startImageToVideo(
  apiKey: string,
  image: string,
  { duration = 5, resolution = '720p', prompt }: VideoOptions = {},
): Promise<string> {
  const extra = prompt?.trim();
  return startJob(apiKey, 'image-to-video', {
    image,
    prompt: extra ? `${extra} ${VIDEO_PROMPT}` : VIDEO_PROMPT,
    duration,
    resolution,
  });
}
