import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { BTN_PAD, FinBlob } from '@/components/FinBlob';
import { OutfitCollage } from '@/components/OutfitCollage';
import { Button } from '@/components/UI';
import { TRYON_MODELS } from '@/data/tryonModels';
import { resizeForProcessing } from '@/services/imageResize';
import { photoFromParams, pickPhoto, type PickedPhoto } from '@/services/photoPicker';
import { persistGarmentPhoto, persistRemoteImage } from '@/services/photoStore';
import {
  buildPrompt,
  claimJob,
  releaseJob,
  startTryOnMax,
  TRYON_CREDITS,
  TryOnPendingError,
  waitForJob,
  type TryOnMode,
  type TryOnResolution,
} from '@/services/tryon';
import { useStore } from '@/store/useStore';
import { font, glass, luxe, luxeRadius, luxeType } from '@/theme/luxe';
import type { WardrobeItem } from '@/types';

/** URI'yi FASHN'ın kabul ettiği biçime çevir (URL veya base64 data URI). */
async function toDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:') || uri.startsWith('http')) return uri;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }
  const FileSystem = await import('expo-file-system/legacy');
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
  // MIME tipi dosya uzantısından gelmeli: arka planı silinmiş PARÇA fotoğrafları
  // PNG (şeffaflık için), model fotoğrafları JPEG olabiliyor.
  const mime = uri.split('?')[0].toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${b64}`;
}

/**
 * Paketlenmiş manken görselini data URI'ye çevirir.
 * FASHN zaten 864×1296'da işliyor; 1023×1537'lik dosyayı olduğu gibi base64'e
 * çevirmek isteği gereksiz büyütüyor, o yüzden önce küçültülüyor.
 */
async function modelSourceToDataUri(source: number, maxDim: number): Promise<string> {
  const { Asset } = await import('expo-asset');
  const asset = Asset.fromModule(source);
  if (!asset.localUri) await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const small = await resizeForProcessing(uri, asset.width ?? undefined, asset.height ?? undefined, maxDim);
  return toDataUri(small);
}

/** Kolajın yakalanacağı çözünürlük — FASHN'a gidecek ürün görseli. */
const COLLAGE_PX = 1024;

/**
 * Mankeni çıktı çözünürlüğüne göre küçült. Daha büyüğünü göndermenin faydası
 * yok — FASHN görseli kendi çözünürlüğüne indiriyor — ama base64 gövdesini
 * büyütüp yüklemeyi uzatıyor.
 */
const MODEL_PX: Record<TryOnResolution, number> = { '1k': 1024, '2k': 1536, '4k': 2048 };

export default function TryOn() {
  const params = useLocalSearchParams<{ outfitId?: string }>();
  const { items, outfits, api, pro, addTryOn, pendingTryOn, setPendingTryOn } = useStore();

  const [modelId, setModelId] = useState<string>(TRYON_MODELS[0]?.id ?? '');
  /** Kendi fotoğrafını kullanmak isteyenler için (küçük seçenek). */
  const [ownModelUri, setOwnModelUri] = useState<string | undefined>();
  const [outfitId, setOutfitId] = useState<string | undefined>(params.outfitId);
  const [prompt, setPrompt] = useState('');
  const [resultUrl, setResultUrl] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resolution] = useState<TryOnResolution>('1k');
  const [mode, setMode] = useState<TryOnMode>('fast');
  /** Ekran dışında çizilen kombin kolajı — FASHN'a ürün görseli olarak gider. */
  const collageRef = useRef<View>(null);

  /** Kendi model fotoğrafı — kalıcı kopya saklanır. */
  const saveOwnModel = async (photo: PickedPhoto) => {
    const small = await resizeForProcessing(photo.uri, photo.width, photo.height, 1400);
    const saved = await persistGarmentPhoto(small).catch(() => small);
    setOwnModelUri(saved);
    setResultUrl(undefined);
  };

  const pickOwnModel = async (fromCamera = false) => {
    const photo = await pickPhoto({ fromCamera, aspect: [3, 4], quality: 0.9, purpose: 'model' });
    if (photo) await saveOwnModel(photo);
  };

  // Android'de süreç öldüyse kök layout model fotoğrafını parametreyle buraya yollar
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (recoveredRef.current) return;
    const photo = photoFromParams(params);
    if (!photo) return;
    recoveredRef.current = true;
    saveOwnModel(photo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const outfit = outfits.find((o) => o.id === outfitId);
  const outfitItems = useMemo(
    () =>
      (outfit?.itemIds ?? [])
        .map((id) => items.find((i) => i.id === id))
        .filter(Boolean) as WardrobeItem[],
    [outfit, items],
  );
  /** Kolaja girecek parçalar — fotoğrafı olanlar. */
  const wearable = useMemo(() => outfitItems.filter((i) => i.imageUri), [outfitItems]);
  const skipped = outfitItems.length - wearable.length;
  const credits = TRYON_CREDITS[mode][resolution];

  const run = async () => {
    const model = TRYON_MODELS.find((m) => m.id === modelId);
    let startedJobId: string | undefined;
    if (!api.fashnKey || !wearable.length) return;
    setBusy(true);
    setError(null);
    setResultUrl(undefined);
    try {
      setStatus('Manken hazırlanıyor…');
      const modelImage = ownModelUri
        ? await toDataUri(ownModelUri)
        : model
          ? await modelSourceToDataUri(model.source, MODEL_PX[resolution])
          : null;
      if (!modelImage) throw new Error('Manken seçilmedi.');

      // Kombin kolajını görsele çevir. tryon-max tek bir `product_image`
      // alıyor ve kolajdaki parçaların hepsini birden giydiriyor — parçaları
      // tek tek göndermeye (her biri ayrı çağrı = ayrı kredi) gerek yok.
      setStatus('Kombin görseli hazırlanıyor…');
      const { captureRef } = await import('react-native-view-shot');
      // JPEG: kolaj zaten beyaz zemine kompozitleniyor, şeffaflığa gerek yok.
      // PNG kayıpsız olduğu için fotoğraflı kolajda 1-3 MB tutuyordu; base64'e
      // çevrilince %33 daha büyüyüp yüklemeyi (mobil veride) çok uzatıyordu.
      const shot = await captureRef(collageRef, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
      });
      const productImage = await toDataUri(shot);

      setStatus('Giydiriliyor…');
      // Başlatma ile bekleme AYRI: iş başladığı an kredi harcanıyor. Kimliği
      // hemen saklıyoruz ki zaman aşımı/ekrandan çıkma/uygulama kapanması
      // durumunda sonucu kaybetmeyelim — sonra kaldığımız yerden devam ederiz.
      const jobId = await startTryOnMax(api.fashnKey, modelImage, productImage, buildPrompt(prompt), {
        resolution,
        mode,
      });
      startedJobId = jobId;
      setPendingTryOn({
        jobId,
        modelId: ownModelUri ? undefined : modelId,
        outfitId: outfit?.id,
        outfitName: outfit?.name,
        prompt: prompt.trim() || undefined,
        startedAt: new Date().toISOString(),
      });

      claimJob(jobId);
      const outputUrl = await waitForJob(api.fashnKey, jobId, setStatus);

      setStatus('Kaydediliyor…');
      const saved = await persistRemoteImage(outputUrl).catch(() => outputUrl);
      setResultUrl(saved);
      addTryOn({
        imageUri: saved,
        jobId,
        modelId: ownModelUri ? undefined : modelId,
        outfitId: outfit?.id,
        outfitName: outfit?.name,
        prompt: prompt.trim() || undefined,
      });
      setPendingTryOn(null);
    } catch (e: any) {
      // Zaman aşımı iş İPTAL demek değil: kimlik saklı, arka planda sürüyor.
      setError(
        e instanceof TryOnPendingError
          ? 'Üretim uzun sürüyor ama iptal olmadı — sonuç hazır olunca "Sanal giydirmelerim"de görünecek.'
          : (e?.message ?? 'Bilinmeyen hata'),
      );
    } finally {
      if (startedJobId) releaseJob(startedJobId);
      setBusy(false);
      setStatus('');
    }
  };

  /** Adım başlığı — küçük, geniş harf aralıklı. */
  const Step = ({ n, title }: { n: number; title: string }) => (
    <Text style={[luxeType.label, styles.step]}>
      {n} · {title}
    </Text>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      {/* Diğer ekranlarla AYNI zemin */}
      <Backdrop />
      <View style={styles.header}>
        <Text style={[luxeType.display, { flex: 1 }]}>Sanal deneme</Text>
        <Pressable onPress={() => router.back()} style={styles.close} hitSlop={8}>
          <Ionicons name="close" size={20} color={luxe.primary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!pro ? (
            <View style={styles.gate}>
              <Ionicons name="lock-closed-outline" size={26} color={luxe.outlineSoft} />
              <Text style={[luxeType.headlineItalic, { marginTop: 12, textAlign: 'center' }]}>
                Sanal deneme Pro&apos;ya özel
              </Text>
              <Text style={[luxeType.body, { textAlign: 'center', marginTop: 8 }]}>
                Hazır bir manken seç, kombinini giydir, editoryal kareyi al.
              </Text>
              <Button
                title="BETTA Pro'ya geç"
                onPress={() => router.push('/pro')}
                style={{ marginTop: 20 }}
              />
            </View>
          ) : !api.fashnKey ? (
            <View style={styles.gate}>
              <Ionicons name="key-outline" size={26} color={luxe.outlineSoft} />
              <Text style={[luxeType.headlineItalic, { marginTop: 12, textAlign: 'center' }]}>
                FASHN anahtarı gerekli
              </Text>
              <Text style={[luxeType.body, { textAlign: 'center', marginTop: 8 }]}>
                Sanal deneme FASHN AI ile çalışıyor. Anahtarı Ayarlar&apos;a ekleyince kombinlerini
                manken üzerinde deneyebilirsin.
              </Text>
              <Button
                title="Ayarlar'a git"
                onPress={() => router.push('/settings')}
                style={{ marginTop: 20 }}
              />
            </View>
          ) : (
            <>
              <View style={styles.section}>
                <Step n={1} title="Manken" />
                <View style={styles.modelRow}>
                  {TRYON_MODELS.map((m) => {
                    const active = !ownModelUri && modelId === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => {
                          setModelId(m.id);
                          setOwnModelUri(undefined);
                          setResultUrl(undefined);
                        }}
                        style={[styles.pick, active && styles.pickActive]}
                      >
                        <Image source={m.source} style={styles.modelImg} contentFit="cover" />
                        <Text style={[styles.pickLabel, active && styles.pickLabelActive]}>
                          {m.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {ownModelUri ? (
                    <Pressable
                      onPress={() => setResultUrl(undefined)}
                      style={[styles.pick, styles.pickActive]}
                    >
                      <Image
                        source={{ uri: ownModelUri }}
                        style={styles.modelImg}
                        contentFit="cover"
                      />
                      <Text style={[styles.pickLabel, styles.pickLabelActive]}>Kendi fotoğrafım</Text>
                    </Pressable>
                  ) : null}
                </View>
                {/*
                  Kendi fotoğrafı İKİNCİL: hazır mankenler tutarlı duruş ve
                  zemin sayesinde belirgin şekilde daha iyi sonuç veriyor.
                */}
                <View style={styles.ownRow}>
                  <PillBtn
                    icon="camera-outline"
                    title="Kendi fotoğrafım"
                    onPress={() => pickOwnModel(true)}
                  />
                  <PillBtn
                    icon="images-outline"
                    title="Galeriden"
                    onPress={() => pickOwnModel(false)}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Step n={2} title="Kombin" />
                {outfits.length === 0 ? (
                  <Text style={luxeType.body}>
                    Henüz kombin yok. Stüdyo&apos;dan bir kombin oluşturunca burada seçebilirsin.
                  </Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {outfits.map((o) => {
                        const its = o.itemIds
                          .map((id) => items.find((i) => i.id === id))
                          .filter(Boolean) as WardrobeItem[];
                        const active = outfitId === o.id;
                        return (
                          <Pressable
                            key={o.id}
                            onPress={() => {
                              setOutfitId(o.id);
                              setResultUrl(undefined);
                            }}
                            style={[styles.pick, active && styles.pickActive]}
                          >
                            <OutfitCollage
                              items={its}
                              size={96}
                              layout={o.layout}
                              frame={o.canvasFrame}
                              cropToContent={o.cropToContent}
                            />
                            <Text
                              style={[styles.pickLabel, active && styles.pickLabelActive]}
                              numberOfLines={1}
                            >
                              {o.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
                {outfit && skipped > 0 ? (
                  <Text style={[luxeType.tiny, { marginTop: 8 }]}>
                    {skipped} parçanın fotoğrafı yok, kolaja girmeyecek.
                  </Text>
                ) : null}
              </View>

              <View style={styles.section}>
                <Step n={3} title="Ek yönerge (isteğe bağlı)" />
                <TextInput
                  value={prompt}
                  onChangeText={setPrompt}
                  placeholder="Örn. altın saatli, saçlar topuz, hafif gülümseme…"
                  placeholderTextColor={luxe.outline}
                  style={styles.prompt}
                  multiline
                />
                <Text style={[luxeType.tiny, { marginTop: 6 }]}>
                  Editoryal yönerge (poz, ışık, stüdyo, kalite) her üretime otomatik ekleniyor.
                </Text>
              </View>

              <View style={styles.section}>
                <Step n={4} title="Kalite" />
                <View style={styles.modeRow}>
                  {(['fast', 'balanced', 'quality'] as TryOnMode[]).map((m) => {
                    const active = mode === m;
                    const label = m === 'fast' ? 'Hızlı' : m === 'balanced' ? 'Dengeli' : 'Kaliteli';
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setMode(m)}
                        style={[styles.modeChip, active && styles.modeChipActive]}
                      >
                        <Text style={[styles.modeText, active && { color: luxe.onPrimary }]}>
                          {label}
                        </Text>
                        <Text style={[styles.modeCredit, active && { color: luxe.onDarkSoft }]}>
                          {TRYON_CREDITS[m][resolution]} kredi
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Button
                title={busy ? status || 'Deneniyor…' : `Giydir · ${credits} kredi`}
                onPress={run}
                disabled={!wearable.length || busy}
                loading={busy}
              />
              {error ? (
                <Text style={[luxeType.caption, { color: luxe.danger, marginTop: 10 }]}>{error}</Text>
              ) : null}

              {resultUrl ? (
                <View style={{ marginTop: 26 }}>
                  <Text style={luxeType.label}>Sonuç</Text>
                  <Image
                    source={{ uri: resultUrl }}
                    style={[styles.resultImg, { marginTop: 10 }]}
                    contentFit="contain"
                  />
                  <Text style={[luxeType.tiny, { marginTop: 10, textAlign: 'center' }]}>
                    Stüdyo → Sanal deneme → &quot;Sanal giydirmelerim&quot;de saklanıyor.
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/*
        FASHN'a gidecek ürün görseli: kombin kolajı, ekran DIŞINDA tam
        çözünürlükte çiziliyor ve captureRef ile yakalanıyor.
        - Beyaz zemin: `tryon-max` ürün fotoğrafı bekliyor, düz zemin en iyi sonucu veriyor.
        - `collapsable={false}` Android'de ŞART: yoksa React Native görünümü
          optimize edip kaldırıyor ve yakalanacak bir şey kalmıyor.
        - Ekranda görünmesin diye konumlandırıldı; `opacity: 0` KULLANILMAZ,
          bazı cihazlarda boş kare yakalanıyor.
      */}
      <View style={styles.offscreen} pointerEvents="none">
        <View ref={collageRef} collapsable={false} style={styles.collage}>
          <OutfitCollage
            capture
            items={wearable}
            size={COLLAGE_PX}
            layout={outfit?.layout}
            frame={outfit?.canvasFrame}
            cropToContent={outfit?.cropToContent}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Uygulamanın küçük siluetli düğmesi — yeni parça ekranındakiyle aynı. */
function PillBtn({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, pressed && { opacity: 0.8 }]}>
      <FinBlob variant="button" pad={BTN_PAD} color={glass.fill} stroke={luxe.outlineSoft} />
      <Ionicons name={icon} size={14} color={luxe.primary} />
      <Text style={styles.pillText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: glass.fill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
  },
  container: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 2 },
  /*
    KART YOK: adımlar ince çizgiyle ayrılıyor — Ayarlar ve yeni parça
    ekranlarıyla aynı karar. Ekran zaten uzun bir akış.
  */
  section: {
    paddingBottom: 18,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: luxe.outlineSoft,
  },
  step: { marginBottom: 12, color: luxe.primary },
  gate: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 10 },
  modelRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  /** Seçilebilir kare (manken / kombin) — seçiliyse mürekkep çerçeve. */
  pick: {
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: luxeRadius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pickActive: { borderColor: luxe.primary, backgroundColor: glass.fillStrong },
  pickLabel: { fontFamily: font.body, fontSize: 11, color: luxe.outline, maxWidth: 104 },
  pickLabelActive: { fontFamily: font.bodyMedium, color: luxe.primary },
  modelImg: { width: 104, height: 156, borderRadius: luxeRadius.md },
  ownRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9 + BTN_PAD,
    paddingHorizontal: 13 + BTN_PAD,
  },
  pillText: {
    fontFamily: font.label,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: luxe.primary,
  },
  prompt: {
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: font.body,
    fontSize: 15,
    color: luxe.ink,
    backgroundColor: luxe.surface,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  resultImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: luxeRadius.lg },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: luxeRadius.pill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    backgroundColor: glass.fill,
  },
  modeChipActive: { backgroundColor: luxe.primary, borderColor: luxe.primary },
  modeText: { fontFamily: font.bodyMedium, fontSize: 13, color: luxe.ink },
  modeCredit: { fontFamily: font.body, fontSize: 10.5, color: luxe.outline, marginTop: 1 },
  /** Ekran dışı: yakalanacak kolaj burada tam boyutta çizilir. */
  offscreen: { position: 'absolute', left: -COLLAGE_PX * 2, top: 0 },
  collage: { width: COLLAGE_PX, height: COLLAGE_PX, backgroundColor: '#FFFFFF' },
});
