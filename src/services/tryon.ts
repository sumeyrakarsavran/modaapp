/**
 * FASHN AI sanal deneme (virtual try-on).
 * Ayarlar'dan FASHN API anahtarı girildiğinde aktifleşir.
 * https://docs.fashn.ai — POST /v1/run ile iş başlatılır, /v1/status/:id ile beklenir.
 *
 * ⚠️ `tryon-v1.6` PROMPT KABUL ETMİYOR (2026-08 doküman kontrolü). Girdileri
 * yalnızca: model_image, garment_image, category, mode, seed, num_samples…
 * Bu yüzden editoryal prompt, giydirme bittikten SONRA ayrı bir çağrıyla
 * (`background-change`) uygulanıyor — o uç prompt alıyor.
 *
 * Kombin giydirme SIRAYLA yapılır: üst giydirilir, çıkan görsel yeni
 * model_image olur, sonra alt giydirilir. FASHN tek çağrıda tek parça alıyor;
 * kolaj görseli göndermek (birden çok kıyafet tek karede) sonucu bozuyor.
 */

export interface TryOnResult {
  outputUrl: string;
}

const BASE = 'https://api.fashn.ai/v1';

/**
 * Her üretimde prompta eklenen sabit editoryal yönerge.
 * Doküman prompt için karakter sınırı YAYINLAMIYOR (kontrol edildi), bu yüzden
 * metin kısaltılmadan gönderiliyor.
 */
export const EDITORIAL_PROMPT = `Create an ultra-premium luxury fashion editorial photograph using the provided human model and the provided clothing item.

The clothing must be transferred perfectly onto the model while preserving the exact garment design, silhouette, stitching, seams, embroidery, lace, buttons, zippers, fabric texture, colors, prints, transparency, folds, layers, proportions, branding, accessories, and every tiny construction detail exactly as in the reference garment.

The garment must fit naturally according to realistic tailoring. Follow accurate body contours while respecting the intended cut of the clothing. Preserve oversized, slim-fit, loose-fit, structured, or flowing silhouettes exactly as designed. Fabric must never melt into the body or look artificially stretched.

The model's identity must remain 100% unchanged. Preserve the exact facial structure, eyes, eyebrows, lips, nose, skin tone, hairstyle, body proportions, hands, fingers, nails, posture, and natural anatomy.

Create the feeling of a luxury fashion campaign photographed for Pinterest, Zara, COS, Massimo Dutti, Jacquemus, Revolve, and high-end editorial magazines.

POSE: Elegant, confident, relaxed luxury fashion pose. Natural weight shift. Long neck. Relaxed shoulders. Beautiful hand placement. Editorial body language. Strong feminine energy. Minimal but expensive-looking pose. No awkward limbs. No exaggerated fashion pose.

EXPRESSION: Calm. Confident. Magnetic. Sophisticated. Slight mysterious expression. Soft relaxed lips. Natural eyes. Luxury editorial emotion. No exaggerated smile.

CAMERA: Medium-format Hasselblad X2D photography. 80mm portrait lens. Eye-level composition. Perfect perspective. Natural proportions. No wide-angle distortion. Ultra high dynamic range. Professional fashion photography.

LIGHTING: Large softbox from front-left. Large fill light. Subtle rim light separating the subject. Natural studio shadows. Beautiful skin highlights. Luxury editorial lighting. Soft contrast. No harsh shadows. No blown highlights.

BACKGROUND: Use the exact same premium studio background in every generated image for perfect catalog consistency. A luxurious architectural fashion studio with an elegant seamless floor and wall transition. Warm off-white plaster walls. Soft ivory microcement floor. Minimal Scandinavian architecture. Large arched window shadows. Soft natural daylight entering from one side. Elegant wall panels. Minimal luxury atmosphere. Clean composition. No furniture. No decorations. No distracting objects. No color distractions. The background must always remain identical between generations while only the model pose changes. The environment should immediately look recognizable as a premium luxury fashion campaign rather than a generic AI studio.

COMPOSITION: Centered composition. Full-body. Perfect symmetry. Professional fashion framing. Enough negative space. Pinterest editorial composition. Instagram luxury campaign aesthetic.

FABRIC PHYSICS: Physically accurate cloth simulation. Natural gravity. Realistic folds. Luxury fabric weight. Correct tension. Beautiful draping. Rich volume. Fine wrinkles only where physically expected.

SKIN: Ultra realistic skin pores. Natural makeup. Healthy skin texture. Luxury beauty retouching. No plastic skin. Natural subsurface scattering.

HAIR: Perfectly groomed. Natural volume. Individual hair strands. Luxury hair photography. No flyaway artifacts.

COLOR GRADING: Luxury editorial color grading. Soft warm neutrals. Natural skin tones. Rich whites. Cream highlights. Gentle contrast. Timeless premium aesthetic. Pinterest trending fashion photography. Expensive magazine look.

QUALITY: Ultra photorealistic. Impossible to distinguish from real photography. Award-winning fashion photography. Luxury campaign. Editorial masterpiece. Medium-format realism. 16-bit color. HDR. Global illumination. Ray-traced lighting. Extremely sharp garment details. Hyper realistic. 8K. Insanely detailed.

AVOID: low quality, blurry, CGI, cartoon, anime, AI generated look, bad anatomy, extra fingers, missing fingers, deformed hands, duplicate limbs, stretched body, distorted face, asymmetrical eyes, identity drift, different hairstyle, clothing deformation, incorrect garment fit, melted fabric, texture loss, washed colors, oversaturated colors, watermark, logo, text, cropped feet, cropped hands, unrealistic shadows, harsh lighting, background changes, inconsistent studio, plastic skin, wax face, over-retouched skin, noise, artifacts, compression artifacts, motion blur`;

/** Kullanıcının yazdığı metni sabit editoryal yönergeyle birleştirir. */
export function buildPrompt(userPrompt?: string): string {
  const extra = userPrompt?.trim();
  return extra ? `${extra}\n\n${EDITORIAL_PROMPT}` : EDITORIAL_PROMPT;
}

/** İş başlat + bitene kadar bekle. */
async function runJob(
  apiKey: string,
  modelName: string,
  inputs: Record<string, unknown>,
  onProgress?: (status: string) => void,
): Promise<string> {
  const startRes = await fetch(`${BASE}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model_name: modelName, inputs }),
  });
  if (!startRes.ok) {
    const t = await startRes.text();
    throw new Error(`FASHN başlatma hatası (${startRes.status}): ${t.slice(0, 200)}`);
  }
  const { id } = await startRes.json();
  if (!id) throw new Error('FASHN iş kimliği alınamadı.');

  // Sonucu bekle (maks ~90 sn)
  for (let attempt = 0; attempt < 45; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    const st = await fetch(`${BASE}/status/${id}`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!st.ok) continue;
    const data = await st.json();
    onProgress?.(data.status);
    if (data.status === 'completed') {
      const url = data.output?.[0];
      if (!url) throw new Error('FASHN çıktı vermedi.');
      return url;
    }
    if (data.status === 'failed') {
      throw new Error(`FASHN işi başarısız: ${JSON.stringify(data.error ?? '').slice(0, 200)}`);
    }
  }
  throw new Error('FASHN zaman aşımı — lütfen tekrar dene.');
}

export type TryOnCategory = 'tops' | 'bottoms' | 'one-pieces' | 'auto';

/** Tek parça giydirme. */
export async function runTryOn(
  apiKey: string,
  modelImage: string,
  garmentImage: string,
  category: TryOnCategory = 'auto',
  onProgress?: (status: string) => void,
): Promise<TryOnResult> {
  const outputUrl = await runJob(
    apiKey,
    'tryon-v1.6',
    { model_image: modelImage, garment_image: garmentImage, category, mode: 'quality' },
    onProgress,
  );
  return { outputUrl };
}

export interface OutfitPiece {
  image: string;
  category: TryOnCategory;
  name: string;
}

/**
 * Kombini SIRAYLA giydirir: her adımın çıktısı bir sonraki adımın modeli olur.
 * FASHN tek çağrıda tek parça aldığı için kombin böyle giydirilir.
 */
export async function runOutfitTryOn(
  apiKey: string,
  modelImage: string,
  pieces: OutfitPiece[],
  onProgress?: (status: string) => void,
): Promise<TryOnResult> {
  if (!pieces.length) throw new Error('Giydirilecek parça yok.');
  // Elbise/tulum tek başına giyilir; yoksa önce üst, sonra alt.
  const order: TryOnCategory[] = ['one-pieces', 'tops', 'bottoms'];
  const sorted = [...pieces].sort(
    (a, b) => order.indexOf(a.category) - order.indexOf(b.category),
  );

  let current = modelImage;
  for (let i = 0; i < sorted.length; i++) {
    const piece = sorted[i];
    onProgress?.(`${piece.name} giydiriliyor (${i + 1}/${sorted.length})`);
    current = await runJob(apiKey, 'tryon-v1.6', {
      model_image: current,
      garment_image: piece.image,
      category: piece.category,
      mode: 'quality',
    });
  }
  return { outputUrl: current };
}

/**
 * Giydirilmiş görsele editoryal görünüm uygular.
 *
 * `tryon-v1.6` prompt almadığı için prompt BURADA devreye giriyor:
 * `background-change` görseldeki kişiyi ve kıyafeti koruyup sahneyi
 * prompta göre yeniden kuruyor (lüks stüdyo, ışık, renk).
 */
export async function applyEditorialLook(
  apiKey: string,
  imageUrl: string,
  prompt: string,
  onProgress?: (status: string) => void,
): Promise<TryOnResult> {
  const outputUrl = await runJob(
    apiKey,
    'background-change',
    { image: imageUrl, prompt },
    onProgress,
  );
  return { outputUrl };
}
