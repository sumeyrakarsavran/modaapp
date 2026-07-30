/**
 * FASHN AI sanal deneme (virtual try-on).
 * Ayarlar'dan FASHN API anahtarı girildiğinde aktifleşir.
 * https://docs.fashn.ai — POST /v1/run ile iş başlatılır, /v1/status/:id ile beklenir.
 */

export interface TryOnResult {
  outputUrl: string;
}

const BASE = 'https://api.fashn.ai/v1';

export async function runTryOn(
  apiKey: string,
  modelImage: string, // URL veya base64 data URI — mankenin/kullanıcının fotoğrafı
  garmentImage: string, // URL veya base64 data URI — kıyafet fotoğrafı
  category: 'tops' | 'bottoms' | 'one-pieces' | 'auto' = 'auto',
  onProgress?: (status: string) => void,
): Promise<TryOnResult> {
  const startRes = await fetch(`${BASE}/run`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model_name: 'tryon-v1.6',
      inputs: {
        model_image: modelImage,
        garment_image: garmentImage,
        category,
      },
    }),
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
      return { outputUrl: url };
    }
    if (data.status === 'failed') {
      throw new Error(`FASHN işi başarısız: ${JSON.stringify(data.error ?? '').slice(0, 200)}`);
    }
  }
  throw new Error('FASHN zaman aşımı — lütfen tekrar dene.');
}
