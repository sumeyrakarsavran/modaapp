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
 * Her üretimde prompta eklenen sabit yönerge.
 *
 * Metin MANKENİ KİLİTLİYOR: poz, kadraj, ışık, zemin ve kimlik aynı kalacak,
 * yalnızca kıyafet değişecek. Kolajdaki parçaları tek tek tanıyıp tutarlı bir
 * kombin kurmasını ve eksik kategoride mankenin beyaz iç katmanını
 * korumasını da burada söylüyoruz.
 *
 * Sonradan eklenen iki kural:
 * - Kolajdaki parçalar YERDE/DÜZ çekilmiş olabiliyor; düz siluet olduğu gibi
 *   aktarılmasın, giyildiğindeki üç boyutlu hâli yeniden kurulsun.
 * - ÜST GİYİM varsayılan olarak pantolonun/eteğin İÇİNE SOKULMASIN; yalnızca
 *   referansta öyle görünüyorsa içine girsin.
 *
 * Doküman prompt için karakter sınırı YAYINLAMIYOR (kontrol edildi), bu yüzden
 * metin kısaltılmadan gönderiliyor.
 */
export const EDITORIAL_PROMPT = `Perform a high-fidelity virtual try-on using the provided MODEL IMAGE and OUTFIT COLLAGE.
The MODEL IMAGE is the immutable base image. Do not regenerate or redesign it. Only modify the clothing and necessary accessories.
MODEL — STRICTLY LOCKED
Preserve the model exactly as provided:

* identity and face
* hair and skin
* body shape and proportions
* hands, fingers, arms and legs
* posture and pose
* head angle
* arm and leg positions
* distance between arms and legs
* camera angle and perspective
* framing and model position
* lighting and shadows
* background and floor

Never change the model's pose, body, face, hair, camera, lighting or background.
The clothing must adapt to the existing model and existing pose — never modify the model to fit the clothing.
OUTFIT COLLAGE ANALYSIS
First analyze the entire outfit collage and identify every visible wearable item:

* tops
* bottoms
* dresses
* jumpsuits
* shoes
* bags
* belts
* necklaces
* earrings
* bracelets
* watches
* rings
* sunglasses
* hats
* other accessories

The clothing may be photographed lying flat on the floor, so the garments will appear flat and two-dimensional in the reference.
Do not transfer the flat-lay shape directly onto the model.
Understand the garment's actual construction, cut, silhouette and structure, then reconstruct its natural three-dimensional appearance when worn by a person.
The garment must naturally wrap around the existing body with realistic volume, folds, draping and fabric behavior.
GARMENT ACCURACY
Preserve the reference garment's:

* exact color
* pattern and print
* fabric texture
* silhouette and intended fit
* length
* neckline and sleeves
* seams and stitching
* buttons and zippers
* embroidery and lace
* transparency and layers
* decorative details
* branding when visible

Do not simplify, redesign, recolor or invent garment details.
TOPS — IMPORTANT TUCKING RULE
Unless the reference image clearly shows that the top is designed or intentionally styled to be tucked into the bottom, KEEP THE TOP OUTSIDE THE PANTS/SKIRT.
Do not tuck shirts, T-shirts, blouses, sweaters or other tops into pants or skirts by default.
The natural default is:
TOP OVER THE BOTTOM, OUTSIDE THE WAISTBAND.
Only tuck the top inside the pants/skirt when:

* the reference clearly shows a tucked-in styling, or
* the garment is specifically designed to be worn tucked in.

When left outside, preserve the natural length and hemline of the original garment.
Never partially tuck, awkwardly bunch, or incorrectly stuff the top into the waistband.
OUTFIT SELECTION
Build the most coherent outfit from all detected items.
Minimum:
TOP + BOTTOM + SHOES
or
DRESS/JUMPSUIT + SHOES
If multiple items from the same category exist, select only one that best matches the outfit.
Do not combine alternative outfits.
If accessories are present, add them naturally when compatible with the existing pose.
MISSING CLOTHING
Never leave the model unclothed.
If a category is missing from the collage, keep the model's existing white base garment for that category.
Examples:

* TOP + SHOES → keep existing white bottom
* BOTTOM + SHOES → keep existing white top
* ACCESSORIES ONLY → keep existing white outfit

Do not invent missing garments.
If a dress or jumpsuit is present, use it as the primary outfit.
REALISTIC TRY-ON
Make every garment look genuinely worn by the model.
The clothing must follow realistic:

* gravity
* fabric weight
* folds
* tension
* draping
* wrinkles
* body contact
* three-dimensional volume

Do not make clothing look pasted onto the body.
Do not stretch, melt, flatten or distort the garment.
Preserve the intended silhouette:
oversized stays oversized, fitted stays fitted, loose stays loose, structured stays structured.
IMAGE PRESERVATION
The final result must look like the original model photograph with the selected garments realistically worn.
Do not create a new fashion photograph.
Do not change the composition, model, pose, camera, lighting or background.
Only modify the relevant clothing and accessory regions.
Priority:

1. Correct garment detection
2. Correct outfit selection
3. Accurate garment details
4. Natural 3D garment reconstruction from flat-lay references
5. Realistic fit and fabric behavior
6. Exact preservation of model, pose and image

AVOID:
identity drift, new model, face change, hair change, body reshaping, pose change, arm/leg movement, hand deformation, camera change, background change, lighting change, invented clothing, incorrect garment selection, tucked-in tops unless explicitly intended, awkward tucking, partially tucked shirts, distorted patterns, lost garment details, wrong colors, unnatural fabric, melted clothing, flat texture, extra fingers, missing fingers, deformed anatomy, nudity, cropped hands or feet, CGI, cartoon, anime, artificial fashion pose.`;

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
