/**
 * Sanal deneme için hazır manken fotoğrafları.
 *
 * Neden hazır model: FASHN try-on, mankenin duruşunu ve kimliğini korur —
 * girdi ne kadar temizse sonuç o kadar iyi. Fotoğraflar tam boy, düz duruş,
 * düz zemin ve beyaz iç katmanla üretildi; kullanıcının rastgele bir
 * selfie'sinden çok daha tutarlı çıktı veriyor.
 *
 * ⚠️ YENİ MANKEN EKLERKEN: dosyayı `assets/people/` içine koymak YETMEZ,
 * buraya da bir satır eklenmeli. Metro `require()` yolunu derleme anında
 * çözüyor; klasörü çalışma anında tarayan bir yol yok.
 * Dosya adı ASCII ve boşluksuz olmalı (ör. `model-kadin-esmer-2.png`) —
 * boşluk/Türkçe karakter içeren adlar paketlemede sorun çıkarıyor.
 */

export interface TryOnModel {
  id: string;
  label: string;
  /** require() ile paketlenen görsel. */
  source: number;
  /**
   * Yüzün MERKEZİ, görsel yüksekliğinin oranı olarak.
   * Yuvarlak "yalnızca yüz" küçük görsellerinde kırpma buna göre hizalanıyor;
   * tek bir sabitle her mankenin kafası aynı yere gelmiyor. Değerler
   * ölçülerek bulundu: saç üstü + baş yüksekliğinin yarısı.
   */
  faceTop: number;
}

export const TRYON_MODELS: TryOnModel[] = [
  // ————— Kadın —————
  {
    id: 'kadin-esmer',
    label: 'Kadın · Esmer',
    source: require('../../assets/people/model-kadin-esmer.png'),
    faceTop: 0.132,
  },
  {
    id: 'kadin-esmer-2',
    label: 'Kadın · Esmer 2',
    source: require('../../assets/people/model-kadin-esmer-2.png'),
    faceTop: 0.127,
  },
  {
    id: 'kadin-sarisin',
    label: 'Kadın · Sarışın',
    source: require('../../assets/people/model-kadin-sarisin.png'),
    faceTop: 0.136,
  },
  {
    id: 'kadin-sarisin-2',
    label: 'Kadın · Sarışın 2',
    source: require('../../assets/people/model-kadin-sarisin-2.png'),
    faceTop: 0.129,
  },
  {
    id: 'kadin-koreli',
    label: 'Kadın · Koreli',
    source: require('../../assets/people/model-kadin-koreli.png'),
    faceTop: 0.135,
  },
  {
    id: 'kadin-koreli-2',
    label: 'Kadın · Koreli 2',
    source: require('../../assets/people/model-kadin-koreli-2.png'),
    faceTop: 0.128,
  },

  // ————— Erkek —————
  {
    id: 'erkek-esmer',
    label: 'Erkek · Esmer',
    source: require('../../assets/people/model-erkek-esmer.png'),
    faceTop: 0.126,
  },
  {
    id: 'erkek-esmer-2',
    label: 'Erkek · Esmer 2',
    source: require('../../assets/people/model-erkek-esmer-2.png'),
    faceTop: 0.123,
  },
  {
    id: 'erkek-sarisin',
    label: 'Erkek · Sarışın',
    source: require('../../assets/people/model-erkek-sarisin.png'),
    faceTop: 0.125,
  },
  {
    id: 'erkek-sarisin-2',
    label: 'Erkek · Sarışın 2',
    source: require('../../assets/people/model-erkek-sarisin-2.png'),
    faceTop: 0.127,
  },
  {
    id: 'erkek-koreli',
    label: 'Erkek · Koreli',
    source: require('../../assets/people/model-erkek-koreli.png'),
    faceTop: 0.124,
  },
  {
    id: 'erkek-koreli-2',
    label: 'Erkek · Koreli 2',
    source: require('../../assets/people/model-erkek-koreli-2.png'),
    faceTop: 0.124,
  },

  /*
    İlk iki manken. Kimlikleri DEĞİŞMEDİ: eski sanal giydirme kayıtları
    `modelId` ile bunlara bakıyor. Zeminleri beyaz, yenilerinki gri —
    o yüzden listenin sonunda.
  */
  {
    id: 'sarisin',
    label: 'Model 1',
    source: require('../../assets/people/model-sarisin.png'),
    faceTop: 0.103,
  },
  {
    id: 'esmer',
    label: 'Model 2',
    source: require('../../assets/people/model-esmer.png'),
    faceTop: 0.134,
  },
];
