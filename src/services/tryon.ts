/**
 * FASHN AI sanal deneme (virtual try-on).
 * Ayarlar'dan FASHN API anahtarı girildiğinde aktifleşir.
 * https://docs.fashn.ai — POST /v1/run ile iş başlatılır, /v1/status/:id ile beklenir.
 *
 * Kullanılan model: **`tryon-max`**. `tryon-v1.6`'dan farkı:
 *   - `prompt` KABUL EDİYOR (v1.6 etmiyor) — editoryal yönerge doğrudan gidiyor,
 *     ikinci bir `background-change` çağrısına gerek kalmıyor.
 *   - `product_image` olarak KOMBİN KOLAJI gönderilebiliyor; parçaları tek tek
 *     giydirmeye (her parça = 1 çağrı = 1 kredi) gerek yok.
 *   - Kredi: fast 1k = 1, balanced 1k = 2, quality 1k = 3 (num_images ile çarpılır).
 *     v1.6 sabit 1 kredi/görsel ama prompt yok ve parça başına çağrı gerekiyordu.
 *
 * Yani 2 parçalı bir kombin eskiden ~3-4 kredi ederken şimdi 1 çağrı / 1 kredi.
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

The model's identity must remain 100% unchanged.
Preserve the exact facial structure, eyes, eyebrows, lips, nose, skin tone, hairstyle, body proportions, hands, fingers, nails, posture, and natural anatomy.

Create the feeling of a luxury fashion campaign photographed for Pinterest, Zara, COS, Massimo Dutti, Jacquemus, Revolve, and high-end editorial magazines.

POSE:
Elegant, confident, relaxed luxury fashion pose.
Natural weight shift.
Long neck.
Relaxed shoulders.
Beautiful hand placement.
Editorial body language.
Strong feminine energy.
Minimal but expensive-looking pose.
No awkward limbs.
No exaggerated fashion pose.

EXPRESSION:
Calm.
Confident.
Magnetic.
Sophisticated.
Slight mysterious expression.
Soft relaxed lips.
Natural eyes.
Luxury editorial emotion.
No exaggerated smile.

CAMERA:
Medium-format Hasselblad X2D photography.
80mm portrait lens.
Eye-level composition.
Perfect perspective.
Natural proportions.
No wide-angle distortion.
Ultra high dynamic range.
Professional fashion photography.

LIGHTING:
Large softbox from front-left.
Large fill light.
Subtle rim light separating the subject.
Natural studio shadows.
Beautiful skin highlights.
Luxury editorial lighting.
Soft contrast.
No harsh shadows.
No blown highlights.

BACKGROUND:
A perfectly seamless premium studio cyclorama with a single solid matte light gray background (#F5F5F5).

Completely uniform color across both floor and wall with an invisible infinity curve.
No gradients.
No textures.
No plaster.
No concrete.
No architecture.
No windows.
No wall panels.
No shadows cast on the background except a subtle natural contact shadow beneath the model.
No furniture.
No decorations.
No props.
No reflections.
No distracting elements.

The background must remain absolutely identical in every generated image, ensuring perfect consistency across the entire fashion catalog. Only the model pose may change between generations.

The result should resemble the clean, premium e-commerce photography used by Zara, COS, Massimo Dutti, Uniqlo, and luxury fashion brands.

COMPOSITION:
Centered composition.
Full-body.
Perfect symmetry.
Professional fashion framing.
Enough negative space.
Pinterest editorial composition.
Instagram luxury campaign aesthetic.

FABRIC PHYSICS:
Physically accurate cloth simulation.
Natural gravity.
Realistic folds.
Luxury fabric weight.
Correct tension.
Beautiful draping.
Rich volume.
Fine wrinkles only where physically expected.

SKIN:
Ultra realistic skin pores.
Natural makeup.
Healthy skin texture.
Luxury beauty retouching.
No plastic skin.
Natural subsurface scattering.

HAIR:
Perfectly groomed.
Natural volume.
Individual hair strands.
Luxury hair photography.
No flyaway artifacts.

COLOR GRADING:
Luxury editorial color grading.
Soft warm neutrals.
Natural skin tones.
Clean neutral grays.
Rich whites.
Gentle contrast.
Timeless premium aesthetic.
Premium fashion catalog look.

QUALITY:
Ultra photorealistic.
Impossible to distinguish from real photography.
Award-winning fashion photography.
Luxury campaign.
Editorial masterpiece.
Medium-format realism.
16-bit color.
HDR.
Global illumination.
Ray-traced lighting.
Extremely sharp garment details.
Hyper realistic.
8K.
Insanely detailed.

AVOID:
low quality, blurry, CGI, cartoon, anime, AI generated look, bad anatomy, extra fingers, missing fingers, deformed hands, duplicate limbs, stretched body, distorted face, asymmetrical eyes, identity drift, different hairstyle, clothing deformation, incorrect garment fit, melted fabric, texture loss, washed colors, oversaturated colors, watermark, logo, text, cropped feet, cropped hands, unrealistic shadows, harsh lighting, background gradients, textured background, architectural background, furniture, decorations, props, inconsistent background color, plastic skin, wax face, over-retouched skin, noise, artifacts, compression artifacts, motion blur`;

/** Kullanıcının yazdığı metni sabit editoryal yönergeyle birleştirir. */
export function buildPrompt(userPrompt?: string): string {
  const extra = userPrompt?.trim();
  return extra ? `${extra}\n\n${EDITORIAL_PROMPT}` : EDITORIAL_PROMPT;
}

/**
 * İşi başlatır ve FASHN iş kimliğini döndürür.
 *
 * Başlatma ile beklemeyi AYIRIYORUZ: iş bir kez başladıysa kredi harcanmış
 * demektir. Beklerken vazgeçersek (zaman aşımı, ekrandan çıkma, uygulamanın
 * kapanması) sonucu kaybetmemek için kimliği saklayıp sonra devam edebilmeliyiz.
 */
export async function startJob(
  apiKey: string,
  modelName: string,
  inputs: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${BASE}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model_name: modelName, inputs }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`FASHN başlatma hatası (${res.status}): ${t.slice(0, 200)}`);
  }
  const { id } = await res.json();
  if (!id) throw new Error('FASHN iş kimliği alınamadı.');
  return id;
}

/**
 * Hangi işi kimin beklediğini tutar.
 *
 * Deneme ekranı modal olarak açılıyor, yani altındaki Stüdyo sekmesi canlı
 * kalıyor ve o da "yarım kalmış iş" görüp AYNI işi beklemeye başlıyordu:
 * sonuç iki kez indiriliyor, galeriye iki kez ekleniyordu. İşi bekleyen taraf
 * burada sahipleniyor, diğeri karışmıyor. (Bellek içi: uygulama kapanınca
 * sıfırlanır, zaten o durumda devam etmesi İSTENEN davranış.)
 */
const claimed = new Set<string>();

/** İşi sahiplen. Zaten sahiplenilmişse `false` döner. */
export function claimJob(jobId: string): boolean {
  if (claimed.has(jobId)) return false;
  claimed.add(jobId);
  return true;
}

export function releaseJob(jobId: string): void {
  claimed.delete(jobId);
}

/** Zaman aşımında iş kimliğini taşır ki sonra devam edilebilsin. */
export class TryOnPendingError extends Error {
  constructor(public jobId: string) {
    super('Sonuç henüz hazır değil. İş arka planda sürüyor — birazdan galeride görünecek.');
    this.name = 'TryOnPendingError';
  }
}

/**
 * İş bitene kadar bekler.
 * `tryon-max` üretken bir model; FASHN süre yayınlamıyor ve gözlemde 90 saniye
 * YETMEDİ. Sınır cömert tutuldu; dolarsa iş iptal edilmiyor, TryOnPendingError
 * ile kimlik geri veriliyor.
 */
export async function waitForJob(
  apiKey: string,
  id: string,
  onProgress?: (status: string) => void,
  timeoutMs = 6 * 60 * 1000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  // İlk saniyelerde sık, sonra seyrek sor: hem hızlı bitenler beklemesin
  // hem de uzun işlerde gereksiz istek atılmasın.
  let delay = 1500;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.3, 5000);
    const st = await fetch(`${BASE}/status/${id}`, {
      headers: { authorization: `Bearer ${apiKey}` },
    }).catch(() => null);
    if (!st?.ok) continue;
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
  throw new TryOnPendingError(id);
}

export type TryOnResolution = '1k' | '2k' | '4k';
export type TryOnMode = 'fast' | 'balanced' | 'quality';

/** Kredi tablosu (doküman, 2026-08): görsel başına, num_images ile çarpılır. */
export const TRYON_CREDITS: Record<TryOnMode, Record<TryOnResolution, number>> = {
  fast: { '1k': 1, '2k': 2, '4k': 3 },
  balanced: { '1k': 2, '2k': 3, '4k': 4 },
  quality: { '1k': 3, '2k': 4, '4k': 5 },
};

export interface TryOnMaxOptions {
  resolution?: TryOnResolution;
  mode?: TryOnMode;
}

/**
 * Kombin kolajını mankene giydirir — TEK çağrı.
 *
 * `product_image` olarak kombin kolajı (parçaların tek karede düz yerleşimi)
 * gönderilir; `tryon-max` bunu çözüp hepsini birden giydiriyor. Parçaları tek
 * tek giydirmeye (her biri ayrı çağrı = ayrı kredi) gerek yok.
 */
export async function startTryOnMax(
  apiKey: string,
  modelImage: string,
  productImage: string,
  prompt: string,
  { resolution = '1k', mode = 'fast' }: TryOnMaxOptions = {},
): Promise<string> {
  return startJob(apiKey, 'tryon-max', {
    model_image: modelImage,
    product_image: productImage,
    prompt,
    resolution,
    generation_mode: mode,
    num_images: 1,
    output_format: 'png',
  });
}
