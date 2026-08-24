/**
 * Sanal deneme için hazır manken fotoğrafları.
 *
 * Neden hazır model: FASHN try-on, mankenin duruşunu ve kimliğini korur —
 * girdi ne kadar temizse sonuç o kadar iyi. Bu iki fotoğraf tam boy, düz duruş,
 * beyaz zemin ve beyaz iç katmanla üretildi; kullanıcının rastgele bir
 * selfie'sinden çok daha tutarlı çıktı veriyor.
 */

export interface TryOnModel {
  id: string;
  label: string;
  /** require() ile paketlenen görsel. */
  source: number;
  /**
   * Yüzün MERKEZİ, görsel yüksekliğinin oranı olarak.
   * Yuvarlak "yalnızca yüz" küçük görsellerinde kırpma buna göre hizalanıyor;
   * tek bir sabitle iki mankenin kafası aynı yere gelmiyordu (ölçüldü:
   * saç üstü sarışında %3.2, esmerde %6.1).
   */
  faceTop: number;
}

export const TRYON_MODELS: TryOnModel[] = [
  {
    id: 'sarisin',
    label: 'Model 1',
    source: require('../../assets/people/model-sarisin.png'),
    faceTop: 0.105,
  },
  {
    id: 'esmer',
    label: 'Model 2',
    source: require('../../assets/people/model-esmer.png'),
    faceTop: 0.134,
  },
];
