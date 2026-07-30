/**
 * Bir sözü zaman sınırına bağlar. Native modüller (arka plan silme, ML Kit)
 * bazı cihazlarda hiç dönmeyebiliyor; o zaman ekran sonsuza kadar "işleniyor"
 * kalıp donuk görünüyordu. Süre dolarsa fallback ile devam edilir.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label?: string,
): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      if ((globalThis as any).__DEV__ && label) {
        console.warn(`[timeout] ${label} ${ms}ms içinde bitmedi, atlandı`);
      }
      resolve(fallback);
    }, ms);
    promise
      .then((v) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      })
      .catch(() => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}
