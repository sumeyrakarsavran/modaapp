/**
 * Fotoğraftan nesne etiketleri — web (ÜCRETSİZ, tarayıcı-içi).
 * transformers.js CDN'den çalışma zamanında yüklenir (Metro, onnxruntime'ın
 * dinamik importlarını paketleyemediği için bundle'a dahil edilmez).
 * Küçük bir açık kaynak ImageNet sınıflandırıcısı kullanılır; model ilk
 * kullanımda indirilir, sonrası tarayıcı önbelleğinden çalışır.
 */

// Metro'nun statik analizini atlayan gerçek dinamik import
// eslint-disable-next-line no-new-func
const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<any>;

const CDN_CANDIDATES = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js',
];

const MODEL_CANDIDATES = [
  // mobilevit-small daha küçük ama kuantize hali isabetsiz; resnet-50 güvenilir
  'Xenova/resnet-50', // ~25MB, q8 — öncelik
  'Xenova/vit-base-patch16-224', // yedek
  'Xenova/mobilevit-small', // son çare
];

let pipePromise: Promise<any> | null = null;

async function getPipeline(): Promise<any> {
  if (!pipePromise) {
    pipePromise = (async () => {
      let lib: any = null;
      let lastErr: unknown;
      for (const url of CDN_CANDIDATES) {
        try {
          lib = await dynamicImport(url);
          if (lib?.pipeline) break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!lib?.pipeline) throw lastErr ?? new Error('transformers.js yüklenemedi');
      for (const model of MODEL_CANDIDATES) {
        try {
          return await lib.pipeline('image-classification', model);
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr;
    })();
    // Başarısız olursa sonraki denemede yeniden kurulabilsin
    pipePromise.catch(() => {
      pipePromise = null;
    });
  }
  return pipePromise;
}

export async function classifyPhotoLabels(imageUri: string): Promise<string[] | null> {
  try {
    const pipe = await getPipeline();
    const out = await pipe(imageUri, { topk: 5 });
    if (!Array.isArray(out) || !out.length) return null;
    return out
      .filter((o: { score?: number }) => (o.score ?? 0) > 0.08)
      .map((o: { label: string }) => o.label);
  } catch (e) {
    if ((globalThis as any).__DEV__) console.warn('[photoClassify]', e);
    return null;
  }
}

// Geliştirme modunda konsoldan test edebilmek için
if (typeof window !== 'undefined' && (globalThis as any).__DEV__) {
  (window as any).__testClassify = classifyPhotoLabels;
  import('@/services/autotag').then((m) => {
    (window as any).__testTags = m.tagsFromLabels;
  });
}
