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
 * Her üretimde prompta eklenen sabit yönerge ("master prompt").
 *
 * Özeti: bu bir GÖRSEL DÜZENLEME işi, yeni fotoğraf üretme işi değil.
 * Manken, poz, kadraj, ışık ve zemin KİLİTLİ; yalnızca kıyafet ve aksesuar
 * bölgeleri değişiyor. Ayrıca:
 * - Kolajdaki her parça tek tek tanınıp tutarlı tek bir kombin kuruluyor.
 * - Yerde/düz çekilmiş parçaların üç boyutlu hali yeniden kuruluyor.
 * - Üst giyim varsayılan olarak içine SOKULMUYOR.
 * - Boy ve kumaş karakteri korunuyor; kısaltma yok.
 * - Gerçekçi ÖRTÜLME: uzun elbise ayakkabıyı kapatıyorsa kapatmaya devam
 *   ediyor, görünsün diye elbise kısaltılmıyor.
 *
 * Doküman prompt için karakter sınırı YAYINLAMIYOR (kontrol edildi), bu yüzden
 * metin kısaltılmadan gönderiliyor.
 */
export const EDITORIAL_PROMPT = `MASTER PROMPT — HIGH-FIDELITY VIRTUAL TRY-ON
Perform a high-fidelity virtual try-on using the provided MODEL IMAGE and OUTFIT COLLAGE.
The MODEL IMAGE is the immutable base image.
The task is to identify the clothing and accessories in the outfit collage and realistically dress the existing model with them.
This is an image editing / virtual try-on task, NOT a new image generation task.
Do not recreate, redesign, restyle, or regenerate the model image.
Only modify the clothing and necessary accessory regions.
1. MODEL IMAGE — ABSOLUTELY LOCKED
Preserve the model exactly as provided.
Do NOT change:

* identity
* face
* facial structure
* eyes
* eyebrows
* nose
* lips
* jaw
* skin tone
* skin texture
* makeup
* hair
* hairstyle
* head position
* body shape
* body proportions
* body size
* torso
* waist
* hips
* arms
* hands
* fingers
* nails
* legs
* feet
* posture
* pose
* body orientation
* arm position
* leg position
* hand position
* finger position
* distance between arms
* distance between legs
* head angle
* camera angle
* perspective
* framing
* model position

The existing pose is intentional and must remain exactly unchanged.
Never move the arms.
Never move the legs.
Never change the distance between the arms or legs.
Never change the hands or fingers.
Never reshape or beautify the body.
Never create a new model.
Never replace the model.
Never generate a different person.
The clothing must adapt to the existing body and existing pose.
2. BACKGROUND AND PHOTOGRAPH — LOCKED
Preserve the original photograph exactly.
Do NOT change:

* background
* floor
* wall
* studio
* lighting
* light direction
* shadows
* exposure
* camera perspective
* composition
* framing

Do not generate a new studio.
Do not add furniture, decorations, architecture, windows, props or reflections.
Do not change the background color or appearance.
3. ANALYZE THE OUTFIT COLLAGE FIRST
Before applying clothing, carefully analyze the entire outfit collage.
Identify every wearable item individually.
Possible categories include:

* top
* T-shirt
* shirt
* blouse
* sweater
* sweatshirt
* jacket
* cardigan
* coat
* pants
* jeans
* trousers
* skirt
* shorts
* dress
* jumpsuit
* shoes
* sneakers
* boots
* heels
* sandals
* bag
* belt
* necklace
* earrings
* bracelet
* watch
* rings
* sunglasses
* hat
* scarf
* other wearable accessories

Do not assume the collage contains only two clothing pieces.
First detect all available clothing and accessories. Then construct the outfit.
4. FLAT-LAY / FLOOR PHOTOS
The clothing references may be photographed lying flat on the floor.
Therefore, the garment may appear completely flat or distorted by the flat-lay perspective.
Do NOT copy the flat two-dimensional shape directly onto the model.
Instead, understand the actual garment construction and reconstruct it as a realistic three-dimensional garment worn by a human.
Infer:

* front and back structure
* garment volume
* natural drape
* sleeve structure
* neckline
* waist position
* skirt construction
* hem shape
* garment length
* fabric behavior
* layers
* seams
* folds
* closures

The flat-lay image represents the complete garment.
Do not crop, shorten, simplify, or reinterpret it.
5. GARMENT REFERENCE IS THE EXACT PRODUCT
The clothing reference is the exact garment to transfer, not a style inspiration.
Do NOT create a similar garment.
Do NOT redesign it.
Do NOT simplify it.
Do NOT restyle it.
Do NOT invent missing details.
Do NOT replace it with a generic version.
Reproduce the reference garment as accurately as possible.
Preserve:

* exact color
* exact pattern
* exact print
* fabric texture
* material appearance
* weave or knit structure
* thickness
* opacity
* transparency
* sheen
* reflectivity
* surface finish
* silhouette
* cut
* proportions
* length
* neckline
* sleeves
* cuffs
* seams
* stitching
* darts
* pleats
* gathers
* buttons
* zippers
* pockets
* embroidery
* lace
* trims
* straps
* borders
* decorative elements
* layers
* branding when visible

Do not change the proportions of prints or patterns.
Do not remove small construction details.
Do not move details to different locations.
6. GARMENT LENGTH — CRITICAL
Preserve the original garment length and proportions exactly.
Never shorten a garment to make it easier to fit the model.
Never convert a long garment into a shorter garment.
Never convert:

* floor-length → midi
* ankle-length → knee-length
* below-knee → above-knee

If the reference dress is floor-length, it must remain floor-length.
If the reference dress reaches the ankles, it must reach approximately the ankles.
If the reference dress is below the knee, preserve that relative length.
The model's body must adapt to the garment visually — the garment must NOT be shortened to fit the model.
For dresses, preserve the complete structure from neckline to hem.
7. FABRIC — CRITICAL
Preserve the actual visual character of the reference fabric.
Do not substitute one material for another.
Silk must remain silk-like.
Satin must remain satin-like.
Knit must remain knit.
Lace must remain lace.
Denim must remain denim.
Cotton must remain cotton-like.
Velvet must remain velvet-like.
Preserve:

* texture
* weave
* thickness
* softness
* stiffness
* sheen
* transparency
* surface detail
* fabric weight
* natural drape

Do not turn the garment into generic smooth synthetic fabric.
The final fabric must visually resemble the reference fabric.
8. TOP TUCKING — ABSOLUTE RULE
NEVER TUCK A TOP INTO PANTS OR A SKIRT BY DEFAULT.
All tops must remain COMPLETELY OUTSIDE the bottom garment.
This applies to:

* T-shirts
* shirts
* blouses
* sweaters
* sweatshirts
* knitwear
* jackets
* cardigans
* tops
* other upper-body garments

Do NOT:

* tuck the top into the waistband
* partially tuck it
* front-tuck it
* half-tuck it
* push the hem inside
* bunch the fabric into the waistband

The natural hem must remain visible and outside the pants/skirt.
The top should naturally fall over the bottom garment.
ONLY EXCEPTION
A top may be tucked in ONLY when the user explicitly instructs that it should be tucked in.
A reference photograph, styling convention, garment shape, pose, or visual assumption is NOT permission to tuck it in.
If there is no explicit tuck-in instruction: TOP = COMPLETELY OUTSIDE THE BOTTOM.
9. OUTFIT SELECTION
After detecting all items, construct the most coherent wearable outfit.
Minimum:
TOP + BOTTOM + SHOES
or:
DRESS / JUMPSUIT + SHOES
If accessories are present, include them when appropriate.
If multiple items belong to the same category, select ONE appropriate item.
For example, if the collage contains three pairs of shoes, choose only one.
If several tops or bottoms are present, select the combination that creates the most coherent outfit.
Do not wear alternative items simultaneously.
Do not combine multiple different outfits.
10. DRESS AND JUMPSUIT PRIORITY
If a dress is present and selected:
DRESS + SHOES
should be the primary outfit.
Do not add a separate top or bottom underneath unless the reference clearly requires intentional layering.
If a jumpsuit is selected, treat it as a complete one-piece garment.
11. MISSING CLOTHING
The model must never become unclothed.
If a clothing category is missing from the collage, preserve the corresponding existing white base garment on the model.
Examples:
TOP + SHOES → keep the existing white bottom.
BOTTOM + SHOES → keep the existing white top.
ACCESSORIES ONLY → keep the existing white outfit.
Do not invent missing garments.
Do not create replacement garments that are not present in the reference.
If a dress or jumpsuit is provided, use it as the primary garment.
12. ACCESSORIES
If accessories are present in the collage, detect and apply them naturally.
Examples:

* necklace → around the neck
* earrings → on the ears
* bracelet → on the wrist
* watch → on the wrist
* ring → on the finger
* belt → around the waist
* sunglasses → on the face
* bag → positioned naturally according to the existing pose

Do not invent accessories.
Do not change the model's pose to accommodate accessories.
13. REALISTIC GARMENT FIT
Fit the garment to the existing model while preserving the garment's intended design.
The model's anatomy must NOT be modified.
Preserve the intended silhouette:

* oversized stays oversized
* slim-fit stays slim-fit
* loose stays loose
* structured stays structured
* flowing stays flowing
* cropped stays cropped
* long stays long

The garment must naturally follow the existing body contours.
Do not stretch the garment unnaturally.
Do not compress it unnaturally.
Do not change its original proportions.
GARMENT OCCLUSION & NATURAL VISIBILITY — CRITICAL
All clothing and accessories must follow realistic physical layering and occlusion.
The model must NOT force every detected item to remain visible.
Determine which items should naturally be visible based on their actual position, garment length, layering, and the existing model pose.
DRESS + SHOES
If a dress is long enough to cover the shoes, the shoes must remain partially or completely hidden beneath the dress, exactly as they would be in a real photograph.
For example:
Floor-length dress + shoes → the shoes may be completely hidden.
Do NOT shorten or lift the dress just to make the shoes visible.
Do NOT move the shoes outside the dress.
Do NOT expose the shoes artificially.
Do NOT create an unnatural gap between the dress hem and the shoes.
Garment length always has priority over shoe visibility.
If only a small portion of the shoes would naturally be visible because of the model's existing pose, show only that portion.
If the shoes would naturally be completely hidden, allow them to remain completely hidden.
GENERAL OCCLUSION
Apply realistic front-to-back layering.
A garment can naturally cover another garment or accessory.
Examples:

* long dress can cover shoes
* long pants can partially cover shoes
* top can cover the waistband
* jacket can cover the shirt
* coat can cover the outfit underneath
* hair can partially cover earrings
* sleeves can cover bracelets
* clothing can cover parts of a bag depending on its position

Never force an item to be visible if another garment would physically cover it.
Never shorten, move, reshape, or lift a garment solely to reveal another item.
ACCESSORIES
Accessories should only be visible where they would naturally appear.
Do not force necklaces, belts, bags, bracelets, watches, earrings, or shoes to be visible if they are physically occluded by clothing, hair, body position, or another garment.
DEPTH ORDER
Respect realistic depth and layering:
BODY → BASE CLOTHING → INNER CLOTHING → OUTER CLOTHING → ACCESSORIES / EXTERNAL OBJECTS
The visible result must follow real-world occlusion.
Do not optimize for maximum visibility of every reference item. Optimize for physically correct visibility.
The fact that an item exists in the outfit collage does NOT mean the entire item must be visible in the final image.
If an item is physically hidden, keep it hidden.
14. REALISTIC FABRIC PHYSICS
The garment must look genuinely worn by a human.
Use realistic:

* gravity
* fabric weight
* folds
* tension
* draping
* wrinkles
* compression
* body contact
* three-dimensional volume

Do not make the clothing look like a flat texture pasted onto the model.
Do not melt the clothing into the body.
Do not create impossible folds.
Do not distort prints around the body.
15. PRESERVE THE ORIGINAL IMAGE
The final image should look like:
THE ORIGINAL MODEL PHOTO + THE REFERENCE CLOTHING REALISTICALLY WORN
It should NOT look like a completely regenerated image.
Modify only the regions necessary for:

* clothing
* shoes
* accessories

Preserve all other areas of the original image.
PRIORITY ORDER
When there is a conflict, follow this priority:

1. Preserve the original model
2. Preserve the original pose
3. Preserve the original image and background
4. Correctly identify the garments
5. Select the correct outfit
6. Preserve the exact garment design
7. Preserve fabric characteristics
8. Preserve garment length and proportions
9. Achieve realistic three-dimensional fit
10. Preserve accessories

GARMENT ACCURACY IS MORE IMPORTANT THAN CREATING A BEAUTIFUL OR STYLIZED NEW IMAGE.
The goal is accurate virtual try-on, not fashion image generation.
STRICTLY AVOID
identity drift
different model
face change
hair change
body reshaping
body slimming
body enlargement
pose change
arm movement
leg movement
hand movement
finger deformation
anatomy changes
camera change
perspective change
framing change
background change
lighting change
new environment
new studio
invented clothing
invented accessories
incorrect garment selection
multiple alternative garments worn simultaneously
top tucked into pants or skirt
partial tuck
front tuck
awkward waistband bunching
shortened garments
incorrect dress length
floor-length dress becoming midi or knee-length
incorrect fabric
generic fabric
lost texture
lost garment details
distorted patterns
wrong colors
wrong silhouette
flat clothing texture
melted fabric
unnatural stretching
unnatural folds
plastic fabric
CGI appearance
cartoon
anime
artificial fashion pose
extra fingers
missing fingers
deformed hands
deformed limbs
nudity
cropped hands
cropped feet
watermark
text`;

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
