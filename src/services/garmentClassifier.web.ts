/**
 * Web sürümü — kıyafet sınıflandırma yalnızca native'de çalışır.
 *
 * `onnxruntime-react-native` web'de yok ve 6MB'lık modeli tarayıcıya indirmek
 * bu ekranın hızını bozar. Web'de sınıflandırma sessizce atlanır; kullanıcı
 * kategoriyi ve alt türü elle seçer (isim kuralları yine çalışıyor).
 */

export interface Prediction {
  id: string;
  label: string;
  confidence: number;
}

export interface Classification {
  subcategoryId: string;
  confidence: number;
  alternatives: Prediction[];
}

export function acquireClassifier(): void {
  // Web'de oturum yok.
}

export function releaseClassifier(): void {
  // Web'de oturum yok.
}

export async function classifyGarment(_uri: string): Promise<Classification | null> {
  return null;
}
