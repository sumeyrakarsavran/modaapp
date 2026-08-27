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

/** Pantolon/şort gibi ALT giyimli kombinler. */
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

/** Etek ya da elbiseli kombinler — kumaşın dökümü öne çıkıyor. */
export const VIDEO_PROMPT_FLOWY = `Create a 5-second ultra-premium, photorealistic fashion editorial video from the provided reference image.

The reference image is the absolute source of truth. Preserve the exact model, exact outfit, exact styling, exact proportions, exact colors, exact garment construction, and exact background throughout the entire video.

MODEL IDENTITY:
Preserve the model's face, facial structure, eyes, eyebrows, nose, lips, skin tone, hairstyle, hair color, body proportions, height, hands, fingers, and natural anatomy exactly. No identity drift or facial changes.

OUTFIT PRESERVATION:
Preserve the exact skirt or dress from the reference image without any redesign.

Keep the exact garment length, waist position, silhouette, skirt volume, hemline, pleats, ruffles, layers, gathers, seams, stitching, buttons, closures, embroidery, lace, prints, colors, fabric texture, transparency, proportions and construction details.

If the garment is a long dress, it must remain a long dress. If the skirt reaches below the knees or to the ankles, preserve that exact length. Do not shorten the garment during movement.

Do not tuck, untuck, crop, stretch, shrink, or reinterpret any part of the outfit.

MOVEMENT:
The model begins in the exact pose from the reference image.

During the first second, she makes a subtle, elegant shift of her weight while maintaining a confident editorial posture.

From approximately 1 to 3 seconds, she takes one graceful step and makes a controlled, elegant quarter-turn toward the camera.

As she turns, the skirt or lower part of the dress responds naturally to her movement. The fabric gently follows her body with realistic inertia and gravity.

The hemline moves naturally and maintains its original length.

If the skirt is voluminous, layered, pleated, or ruffled, the layers separate and flow subtly during the turn, revealing the beautiful construction of the garment without changing its shape.

If the dress is lightweight or flowing, the fabric creates elegant soft waves as she moves.

From approximately 3 to 4 seconds, the model completes the turn and briefly faces the camera. She gives a calm, magnetic, sophisticated look directly into the camera. One natural blink. A very subtle confident facial expression, almost imperceptible, with no exaggerated smile.

During the final second, she slightly turns her head away from the camera while the fabric settles naturally around her body.

The overall movement should feel effortless, graceful, cool, feminine, and extremely sophisticated.

CAMERA:
Professional luxury fashion campaign cinematography. Start with a full-body composition showing the entire garment from head to toe. Perform a smooth, slow cinematic dolly-in combined with a very subtle lateral camera movement. Keep the complete garment visible throughout the shot.

Do not crop the hemline. Do not crop the shoes. Do not crop the head. Do not zoom too aggressively.

The camera movement should feel expensive and intentional, like a real fashion campaign filmed on a professional cinema camera.

BACKGROUND:
Keep the exact same premium fashion studio environment from the reference image. The background must remain stable and recognizable throughout all 5 seconds. Warm ivory architectural studio. Elegant matte microcement or stone floor. Soft textured plaster walls. Subtle architectural details. Large soft window-shaped shadows. Minimal European luxury fashion atmosphere.

No new objects. No furniture. No props. No people. No environmental changes. No background morphing.

LIGHTING:
Maintain consistent premium editorial lighting throughout the video. Large soft diffused key light. Subtle fill light. Gentle rim light around the model. Soft realistic shadows. Natural skin highlights. Beautiful highlights on the fabric. Accurate garment colors. No lighting flicker. No exposure changes. No sudden color shifts.

FABRIC PHYSICS:
Use physically accurate fabric movement. The skirt or dress must have realistic weight, gravity, inertia, friction, folds, and draping. Fabric should move according to the actual material shown in the reference.

Silk should flow softly. Chiffon should move lightly. Cotton should have natural weight. Denim should remain structured. Tulle should have airy layered movement. Pleated fabric should preserve its pleats. Ruffled fabric should preserve every ruffle layer.

Never make the fabric look rubbery, liquid, melted, frozen, or weightless.

HAIR:
Preserve the exact hairstyle. Hair moves naturally in response to the model's turn. Only subtle realistic motion. Individual strands move with believable momentum. No dramatic artificial wind.

EXPRESSION & ENERGY:
The model should feel magnetic rather than cheerful. Elegant. Cool. Confident. Feminine. Mysterious. Effortlessly beautiful. High-fashion presence.

She should look completely comfortable in front of the camera, as if this is a professional luxury campaign. Do not make her overly happy. Do not make her smile broadly. Do not make her look like she is dancing or acting.

The emotional tone is: effortlessly cool luxury fashion.

VISUAL QUALITY:
Ultra-photorealistic luxury fashion film. Real human movement. Realistic fabric simulation. Realistic skin texture. Natural pores. Individual hair strands. Physically accurate shadows. High dynamic range. Natural depth of field. Cinematic motion blur. Professional editorial retouching. Premium European fashion campaign aesthetic. Pinterest-worthy fashion photography. Luxury magazine quality. Medium-format photography aesthetic. Hasselblad X2D look. 80mm lens. 8K-quality detail.

FINAL IMPRESSION:
The result should look like a real photograph from a high-end fashion campaign that has been subtly brought to life. Every frame must look professionally photographed. The outfit remains the hero. The model's movement enhances the garment rather than distracting from it.

MODESTY (ABSOLUTE):
The body must stay modestly covered in every frame. Never show nipples, areolae, genitals or any intimate area of any person, of any gender. Fabric must never turn sheer, transparent or clingy over those areas, and no garment may slip, open or shift during movement to expose them. If the reference garment is thin, render it opaque enough to keep the body covered.

NEGATIVE PROMPT:
identity drift, face change, facial morphing, different person, body deformation, anatomy distortion, extra fingers, missing fingers, extra limbs, deformed hands, warped legs, distorted feet, clothing change, garment redesign, garment morphing, wrong garment length, shortened skirt, shortened dress, altered hemline, changed silhouette, changed fabric, changed texture, changed color, missing ruffles, missing pleats, missing layers, melted fabric, rubber fabric, liquid fabric, floating fabric, unrealistic fabric physics, transparent clothing when not present, visible nipples, see-through clothing, exposed intimate areas, nudity, exposed body, wardrobe malfunction, excessive wind, exaggerated hair movement, dancing, jumping, spinning too fast, unnatural walking, exaggerated smile, exaggerated facial expression, background change, background morphing, background flicker, lighting flicker, exposure shift, camera shake, fisheye, wide-angle distortion, excessive zoom, cropped feet, cropped hemline, cropped head, CGI, cartoon, plastic skin, AI artifacts, flickering, jitter, low resolution, blur, watermark, text, logo.`;

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
