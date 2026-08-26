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
 * Her üretimde prompta eklenen sabit yönerge — BİLEREK KISA.
 *
 * Önce 13 bin karakterlik ayrıntılı bir "master prompt" denendi; sonuçlar kötüydü.
 * `tryon-max` bir KIYAFET AKTARMA ağı; `prompt` alanı ince ayar kolu, kural kitabı
 * değil. Uzun metinde önemli satırlar gömülüyor. Bu yüzden metin yalnızca en çok
 * hata yapılan altı noktayı emir kipinde söylüyor:
 * manken/poz/zemin sabit · düz çekim 3B'ye çevrilsin · renk-kumaş-desen aynen ·
 * BOY korunsun · üst içeri sokulmasın · kategoriden bir parça, eksik kategoride
 * beyaz iç katman kalsın.
 *
 * Uzun sürüm git geçmişinde duruyor (bkz. "master prompt" commit'i).
 */
export const EDITORIAL_PROMPT = `Dress the model in the garments from the collage. Keep the model, face, body, pose, hands, camera, lighting and background exactly as given — change clothing only. The garments are flat-lay photos: rebuild them as worn 3D clothing with natural drape. Keep each garment's exact color, fabric, print and LENGTH — a floor-length dress stays floor-length. Never tuck tops into pants or skirts, leave the hem outside. Use one item per category; if a category is missing, keep the white base garment.`;

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
