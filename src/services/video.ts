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
 * Hareket yönergesi KIYAFETE GÖRE değişiyor.
 *
 * Pantolonda hareket sakin olmalı (adım + hafif dönüş); etek/elbisede asıl
 * güzellik kumaşın dönerken açılması. Tek bir metin ikisini de iyi anlatmıyor:
 * eteğe yazılmış "savrulsun" yönergesi pantolonda tuhaf duruyor, pantolona
 * yazılmış "sabit dur" yönergesi eteğin hakkını yemiyor.
 *
 * Not: FASHN dokümanı kısa prompt öneriyor ama kullanıcı kendi arayüzünde bu
 * uzun metinlerle belirgin şekilde daha iyi sonuç aldı; o yüzden kısaltılmadı.
 */
export type VideoOutfitKind = 'pants' | 'flowy';

/**
 * Pantolon/şort gibi ALT giyimli kombinler.
 *
 * Model bir adım öne gelip gövdesini kameraya doğru hafifçe çeviriyor.
 * (Kamera yörüngeli bir sürüm denendi, kullanıcı bu hâli tercih etti.)
 */
export const VIDEO_PROMPT_PANTS = `Create a 5-second ultra-premium photorealistic fashion editorial video using the provided reference image.

ABSOLUTE PRIORITY:
Preserve the model and outfit exactly as shown in the reference image. Do not redesign, reinterpret, replace, recolor, resize, shorten, lengthen, or modify any garment. The clothing must remain identical throughout the entire video.

PRESERVE THE OUTFIT:
Maintain the exact shirt/top, trousers, waistband, pockets, seams, stitching, buttons, zippers, pleats, belt loops, cuffs, fabric texture, print, color, silhouette, fit, proportions, and layering exactly as in the reference image.

The trousers must remain full-length if they are full-length in the reference. Preserve the exact waist position, rise, leg width, hem length, crease structure, drape, and fabric weight.

The top must remain exactly the same length and fit. Do not tuck it in, untuck it, crop it, stretch it, or change how it overlaps with the trousers.

Preserve all accessories and footwear exactly as shown.

MODEL:
The model remains the same person throughout the entire video.
Preserve her exact face, facial structure, hairstyle, hair color, skin tone, body proportions, height, hands, fingers, and anatomy.

She has a sophisticated, confident, effortlessly cool fashion-editorial attitude.

MOVEMENT:
The video begins with the model standing naturally and confidently.

During the first second, she makes a very subtle weight shift from one leg to the other while maintaining the exact outfit silhouette.

From approximately 1 to 3 seconds, she takes one slow, elegant step forward. Her movement is natural and confident, like a professional fashion model walking during a luxury campaign.

The trousers move naturally with her legs. The fabric responds to gravity and motion with physically accurate folds and subtle movement. The trouser legs maintain their original length and silhouette.

At approximately 3 seconds, she stops and makes a very subtle turn of her upper body toward the camera.

From 3 to 5 seconds, she gives a calm, confident look directly toward the camera. Her expression remains cool, sophisticated, magnetic, and effortless.

She makes one natural blink.

Her hair moves very slightly with her movement, with realistic individual strands and natural momentum.

CAMERA:
Professional high-end fashion cinematography.

Begin with a full-body editorial composition so the complete outfit, especially the trousers and shoes, remains visible.

The camera performs a very smooth, subtle cinematic dolly-in while maintaining the full outfit in frame.

No sudden camera movements. No dramatic zoom. No handheld shake. No excessive camera rotation. No perspective distortion.

The camera should feel like a professional luxury fashion campaign rather than an AI-generated video.

FABRIC PHYSICS:
Extremely realistic textile simulation.

The trousers should behave according to their actual material and weight. Natural folds appear around the knees, hips, waistband, and movement points.

No fabric melting. No rubber-like fabric. No excessive fluttering. No deformation. No changing garment geometry.

LIGHTING:
Premium fashion studio lighting. Soft large diffused key light from the front-left. Gentle fill light from the opposite side. Very subtle rim light separating the model from the background. Natural realistic shadows beneath the model and around the clothing. Accurate fabric highlights. Accurate skin tones. No overexposure. No harsh artificial lighting.

BACKGROUND:
Keep the exact same recognizable premium fashion studio environment throughout the entire 5-second video. Warm ivory/off-white architectural studio. Elegant microcement or matte stone floor. Subtle wall texture. Large soft architectural window shadows falling naturally across the background. Minimal luxury interior. Clean editorial environment. No furniture. No props. No people. No text. No logos. No background changes.

The background must remain completely stable and consistent.

VISUAL STYLE:
Pinterest-worthy luxury fashion editorial. High-end contemporary fashion campaign. Effortlessly cool. Sophisticated. Minimal. Expensive-looking. Timeless. Modern European fashion aesthetic.

The image should feel like a real campaign photograph brought subtly to life.

CAMERA QUALITY:
Professional medium-format fashion photography. Hasselblad X2D aesthetic. 80mm lens. Natural perspective. High dynamic range. Extremely detailed fabric. Realistic skin pores. Natural hair strands. Physically accurate shadows. Cinematic depth of field. Subtle realistic motion blur only where physically appropriate. Ultra-photorealistic. 8K-quality detail. Premium editorial color grading.

MOTION PHILOSOPHY:
Less movement, more attitude. Every movement must feel intentional, elegant, controlled, and expensive. The model must never look like she is dancing or performing for the camera. She should look like a professional fashion model naturally moving during an editorial shoot.

MODESTY (ABSOLUTE):
The body must stay modestly covered in every frame. Never show nipples, areolae, genitals or any intimate area of any person, of any gender. Fabric must never turn sheer, transparent or clingy over those areas, and no garment may slip, open or shift during movement to expose them. If the reference garment is thin, render it opaque enough to keep the body covered.

NEGATIVE PROMPT:
Do not change the clothing. Do not change garment color. Do not change garment length. Do not shorten trousers. Do not lengthen trousers. Do not change trouser width. Do not change waistband. Do not tuck or untuck the shirt. Do not change the top. Do not remove clothing. Do not add clothing. Do not add accessories. Do not remove accessories. Do not change shoes. Do not change hairstyle. Do not change face. Do not change body proportions. No identity drift. No face morphing. No anatomy distortion. No extra fingers. No missing fingers. No extra limbs. No deformed hands. No warped legs. No floating feet. No foot distortion. No fabric melting. No garment morphing. No texture flickering. No pattern changes. No color shifting. No background transformation. No background flickering. No excessive wind. No exaggerated hair movement. No dancing. No jumping. No fast spinning. No unrealistic walking. No camera shake. No sudden zoom. No fisheye. No wide-angle distortion. No CGI appearance. No cartoon appearance. No plastic skin. No artificial facial expression. No excessive smile. No visible nipples. No see-through clothing. No exposed intimate areas. No nudity. No wardrobe malfunction. No low resolution. No blur. No compression artifacts. No watermark. No text.`;

/**
 * Etek ya da elbiseli kombinler — kumaşın dökümü öne çıkıyor: model neşeyle
 * dönüyor, etek açılıyor. (Ölçülü bir sürüm denendi, kullanıcı bu hâli
 * tercih etti.)
 */
export const VIDEO_PROMPT_FLOWY = `Create a 5-second ultra-photorealistic luxury fashion campaign video from the reference image. Preserve the model's identity, facial features, hairstyle, body proportions, skin tone, clothing design, colors, textures, and all fine details exactly. Do not redesign or replace any element.

The model is wearing a voluminous layered ruffled skirt. She radiates pure joy, confidence, and youthful energy with a bright, genuine smile.

She begins by taking a light playful step, then joyfully spins several times in place. The movement is energetic yet elegant, like a high-end fashion commercial. As she twirls, the large ruffled skirt blooms outward into a dramatic circular shape, with every layer flowing naturally through the air. The fabric ripples beautifully, creating soft waves and realistic motion.

She makes a small joyful jump during one of the spins, causing the skirt to lift and float gracefully before settling naturally. Her long straight hair flies outward with realistic physics, then flows smoothly behind her as she continues spinning. Individual hair strands catch the light and move naturally with momentum.

The camera smoothly circles around her while performing a gentle cinematic push-in, capturing the flowing movement of the skirt from multiple elegant angles. Motion remains fluid, stable, and luxurious.

Her facial expression is full of happiness and freedom. She laughs softly with sparkling eyes while looking toward the camera for a brief moment before continuing to spin naturally.

Lighting is soft, diffused, and premium with a seamless luxury off-white infinity studio background. The atmosphere feels magical, airy, fresh, feminine, elegant, and captivating.

Every movement follows realistic human biomechanics and natural fabric physics. The skirt has rich volume, soft folds, and beautiful flowing motion. Hair movement is dynamic, weightless, and realistic.

Luxury editorial fashion campaign, high-end couture commercial, cinematic slow-motion moments blended with real-time motion, ultra-photorealistic, medium format camera, Hasselblad X2D look, 80mm lens, HDR, realistic global illumination, premium color grading, crisp details, 8K.

MODESTY (ABSOLUTE):
The body must stay modestly covered in every frame. Never show nipples, areolae, genitals or any intimate area of any person, of any gender. Fabric must never turn sheer, transparent or clingy over those areas, and no garment may slip, open or shift during movement to expose them. If the reference garment is thin, render it opaque enough to keep the body covered.

Negative prompt: no identity drift, no clothing changes, no anatomy distortion, no extra limbs, no deformed hands, no AI artifacts, no flickering, no morphing, no unrealistic physics, no camera shake, no low quality, no blur, no visible nipples, no see-through clothing, no exposed intimate areas, no nudity, no wardrobe malfunction, preserve face and outfit exactly.`;

/** Kullanıcının ek notu varsa metnin BAŞINA ekleniyor. */
export function buildVideoPrompt(kind: VideoOutfitKind, userPrompt?: string): string {
  const base = kind === 'flowy' ? VIDEO_PROMPT_FLOWY : VIDEO_PROMPT_PANTS;
  const extra = userPrompt?.trim();
  return extra ? `${extra}\n\n${base}` : base;
}

export interface VideoOptions {
  duration?: VideoDuration;
  resolution?: VideoResolution;
  /** Kombin etekli/elbiseli mi, pantolonlu mu — yönergeyi bu seçiyor. */
  kind?: VideoOutfitKind;
  /** Kullanıcının yazdığı ek hareket notu. */
  prompt?: string;
}

export async function startImageToVideo(
  apiKey: string,
  image: string,
  { duration = 5, resolution = '720p', kind = 'pants', prompt }: VideoOptions = {},
): Promise<string> {
  return startJob(apiKey, 'image-to-video', {
    image,
    prompt: buildVideoPrompt(kind, prompt),
    duration,
    resolution,
  });
}
