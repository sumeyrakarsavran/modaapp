/**
 * upng-js tip bildirimi (paket kendi tiplerini getirmiyor).
 *
 * Neden upng-js: `fast-png` saf ESM (`"type": "module"`) ve Metro'da ad alanı
 * boş geliyor — cihazda kanıtlandı: `keys=[default] default=[]`, `decode` hep
 * undefined kalıyordu. upng-js CommonJS olduğu için React Native'de sorunsuz.
 */
declare module 'upng-js' {
  interface UPNGImage {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: unknown[];
    tabs: Record<string, unknown>;
    data: Uint8Array;
  }

  /** PNG baytlarını çözer. */
  export function decode(buffer: ArrayBuffer): UPNGImage;

  /** Kare(ler)i 8-bit RGBA'ya çevirir — şeffaflık korunur. */
  export function toRGBA8(img: UPNGImage): ArrayBuffer[];

  const UPNG: {
    decode: typeof decode;
    toRGBA8: typeof toRGBA8;
  };
  export default UPNG;
}
