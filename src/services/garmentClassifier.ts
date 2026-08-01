/**
 * Kıyafet sınıflandırma — cihaz içi, ücretsiz, anahtarsız.
 *
 * Model: MobileNetV3-Small, 20 kıyafet sınıfı (assets/models/).
 * Sözleşme `assets/models/labels.json` ve MODEL.md'de; ImageNet normalizasyonu
 * ve softmax ONNX grafiğinin İÇİNDE, dışarıda tekrar uygulanmaz.
 *
 * ⚠️ ÖN İŞLEME EN KRİTİK KISIM. Model, beyaz zemine ortalanmış TEK bir kıyafet
 * görmek üzere eğitildi. Doğru çerçeveleme olmadan isabet %78'den %30'lara
 * düşüyor (ölçülmüş). Bu yüzden `classifyGarment` arka planı SİLİNMİŞ,
 * kırpılmış, alfa kanallı bir PNG bekler — BETTA'da `processGarmentPhoto`
 * (six33 + `trim: true`) tam olarak bunu üretiyor. Normal bir fotoğraf
 * verilirse kod hata vermez, sessizce yanlış çalışır.
 *
 * ⚠️ BELLEK: ONNX Runtime oturumu açıkken 30-80MB tutuyor. Bu cihazda
 * (Galaxy S20 FE, boş RAM ~144MB) sürekli açık tutmak süreç ölümü riskini
 * artırıyor — bu yüzden oturum KALICI DEĞİL: ekran `acquire`/`release` ile
 * ömrünü yönetiyor.
 */

import { toByteArray } from 'base64-js';
import { Image } from 'react-native';
import UPNG from 'upng-js';

import { withTimeout } from '@/services/async';
import metadata from '../../assets/models/labels.json';

const MODEL = require('../../assets/models/clothing-classifier.onnx');

const { imageSize: IMAGE_SIZE, margin: MARGIN, classes: CLASSES } = metadata;
/** Kıyafetin ölçeklendikten sonraki en uzun kenarı; kalanı kenar boşluğu. */
const CONTENT_SIZE = Math.round(IMAGE_SIZE / (1 + 2 * MARGIN));
/** Bu oranın altında opak piksel varsa kesit boş demektir, kıyafet değil. */
const MIN_COVERAGE = 0.01;

export interface Prediction {
  id: string;
  label: string;
  confidence: number;
}

export interface Classification {
  /** SUBCATEGORIES id'si (modelin sınıf id'si ile aynı). */
  subcategoryId: string;
  confidence: number;
  /** Sonraki iki tahmin — arayüzde alternatif olarak gösterilir. */
  alternatives: Prediction[];
}

/* ————— Oturum yönetimi ————— */

type Session = {
  run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: unknown }>>;
  inputNames: string[];
  outputNames: string[];
  release?: () => Promise<void>;
};

let session: Promise<Session | null> | null = null;
let holders = 0;

async function createSession(): Promise<Session | null> {
  try {
    // Native modül — yoksa (ör. Expo Go) özellik sessizce atlanır.
    const ort = await import('onnxruntime-react-native');
    const { Asset } = await import('expo-asset');

    const asset = Asset.fromModule(MODEL);
    if (!asset.localUri) await asset.downloadAsync();
    const path = (asset.localUri ?? asset.uri).replace(/^file:\/\//, '');

    // Yol veriyoruz, Uint8Array DEĞİL: 6MB'lık grafiği JS belleğine okumaya gerek yok.
    return (await withTimeout(
      ort.InferenceSession.create(path, {
        intraOpNumThreads: 2,
        graphOptimizationLevel: 'all',
      }) as Promise<unknown>,
      20000,
      null,
      'sınıflandırıcı oturumu',
    )) as Session | null;
  } catch {
    return null;
  }
}

/**
 * Oturumu açar (zaten açıksa paylaşır) ve sayaç artırır.
 * Kıyafet ekleme ekranı mount olurken çağrılmalı — böylece kullanıcı
 * fotoğrafı seçtiğinde model çoktan hazır olur.
 */
export function acquireClassifier(): void {
  holders += 1;
  if (!session) {
    session = createSession();
    session.catch(() => {
      session = null;
    });
  }
}

/** Sayaç sıfırlanınca oturumu gerçekten serbest bırakır (belleği geri verir). */
export function releaseClassifier(): void {
  holders = Math.max(0, holders - 1);
  if (holders > 0) return;
  const pending = session;
  session = null;
  pending
    ?.then((s) => s?.release?.())
    .catch(() => {
      // Serbest bırakma hatası önemli değil; oturum referansı zaten bırakıldı.
    });
}

/* ————— Ön işleme ————— */

interface Size {
  width: number;
  height: number;
}

/** Kıyafeti, en uzun kenarı kenar boşluğu düşülmüş tuvali dolduracak şekilde ölçekler. */
function contentBox({ width, height }: Size): Size {
  const scale = CONTENT_SIZE / Math.max(width, height);
  return {
    width: Math.max(1, Math.min(IMAGE_SIZE, Math.round(width * scale))),
    height: Math.max(1, Math.min(IMAGE_SIZE, Math.round(height * scale))),
  };
}

/** Yalnızca başlığı okur — 12MP fotoğraf burada tam bitmap'e dönüşmesin. */
function measure(uri: string): Promise<Size | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null),
    );
  });
}

/**
 * Kırpılmış kesiti ölçekler, beyaz kareye ortalar ve şeffaf pikselleri beyaza
 * kompozitler (`renk × alfa + 255 × (1 − alfa)`). Eğitimdeki `trim_and_square`
 * ile aynı çerçeveleme — JPEG'e çevirip alfayı düzleştirmek YASAK, siyaha düşer
 * ve koyu kıyafetleri yok eder.
 */
async function prepareImage(uri: string): Promise<{ data: Float32Array; coverage: number } | null> {
  const Manip = await import('expo-image-manipulator');
  const anyManip = Manip as any;
  if (!anyManip.ImageManipulator?.manipulate) return null;

  const measured = (await measure(uri)) ?? null;
  let ctx = anyManip.ImageManipulator.manipulate(uri);
  if (measured) {
    ctx = ctx.resize(contentBox(measured));
  }
  const rendered = await ctx.renderAsync();
  // Ölçü alınamadıysa (bazı content:// URI'leri) tam çözümden sonra ölçekle
  const fitted = measured
    ? rendered
    : await anyManip.ImageManipulator.manipulate(rendered)
        .resize(contentBox({ width: rendered.width, height: rendered.height }))
        .renderAsync();

  // PNG şart: arka plan silmenin ürettiği alfa kanalı korunmalı.
  const saved = await fitted.saveAsync({
    format: anyManip.SaveFormat?.PNG ?? 'png',
    compress: 1,
  });

  const FileSystem = await import('expo-file-system/legacy');
  const base64 = await FileSystem.readAsStringAsync(saved.uri, { encoding: 'base64' as any });
  await FileSystem.deleteAsync(saved.uri, { idempotent: true }).catch(() => {});

  const bytes = toByteArray(base64);
  const ab = (bytes.buffer as ArrayBuffer).slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  const decoded = UPNG.decode(ab);
  const rgba = new Uint8Array(UPNG.toRGBA8(decoded)[0]);

  const pixels = IMAGE_SIZE * IMAGE_SIZE;
  // 1 ile doldur = beyaz zemin; kıyafet ortaya kompozitlenecek
  const data = new Float32Array(3 * pixels).fill(1);
  const offsetX = Math.floor((IMAGE_SIZE - decoded.width) / 2);
  const offsetY = Math.floor((IMAGE_SIZE - decoded.height) / 2);
  let opaque = 0;

  for (let y = 0; y < decoded.height; y += 1) {
    const rowStart = (y + offsetY) * IMAGE_SIZE + offsetX;
    for (let x = 0; x < decoded.width; x += 1) {
      const from = (y * decoded.width + x) * 4;
      const to = rowStart + x;
      const alpha = rgba[from + 3] / 255;
      if (alpha > 0.5) opaque += 1;
      data[to] = (rgba[from] / 255) * alpha + (1 - alpha);
      data[pixels + to] = (rgba[from + 1] / 255) * alpha + (1 - alpha);
      data[2 * pixels + to] = (rgba[from + 2] / 255) * alpha + (1 - alpha);
    }
  }

  return { data, coverage: opaque / pixels };
}

/* ————— Sınıflandırma ————— */

/**
 * Arka planı silinmiş kıyafet PNG'sini sınıflandırır.
 * Model yoksa, oturum kurulamazsa ya da kesit boşsa `null` döner — çağıran
 * taraf elle seçime düşer, akış asla kilitlenmez.
 */
export async function classifyGarment(uri: string): Promise<Classification | null> {
  try {
    if (!session) acquireClassifier();
    const [model, image] = await Promise.all([session, prepareImage(uri)]);
    if (!model || !image) return null;
    if (image.coverage < MIN_COVERAGE) return null;

    const ort = await import('onnxruntime-react-native');
    const tensor = new ort.Tensor('float32', image.data, [1, 3, IMAGE_SIZE, IMAGE_SIZE]);

    const outputs = await withTimeout(
      model.run({ [model.inputNames[0]]: tensor }) as Promise<any>,
      15000,
      null,
      'kıyafet sınıflandırma',
    );
    if (!outputs) return null;

    const probabilities = outputs[model.outputNames[0]].data as Float32Array;
    const ranked = CLASSES.map((entry, index) => ({
      id: entry.id,
      label: entry.label,
      confidence: probabilities[index],
    })).sort((a, b) => b.confidence - a.confidence);

    const [best, ...rest] = ranked;
    if (!best) return null;
    return {
      subcategoryId: best.id,
      confidence: best.confidence,
      alternatives: rest.slice(0, 2),
    };
  } catch {
    return null;
  }
}
