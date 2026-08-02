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

import { OutfitCollage } from '@/components/OutfitCollage';
import { Button, Card, SectionTitle } from '@/components/UI';
import { TRYON_MODELS } from '@/data/tryonModels';
import { resizeForProcessing } from '@/services/imageResize';
import { photoFromParams, pickPhoto, type PickedPhoto } from '@/services/photoPicker';
import { persistGarmentPhoto, persistRemoteImage } from '@/services/photoStore';
import {
  buildPrompt,
  runTryOnMax,
  TRYON_CREDITS,
  type TryOnMode,
  type TryOnResolution,
} from '@/services/tryon';
import { useStore } from '@/store/useStore';
import { colors, radius, spacing, type } from '@/theme';
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
  const { items, outfits, api, pro, addTryOn } = useStore();

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
      const { outputUrl } = await runTryOnMax(
        api.fashnKey,
        modelImage,
        productImage,
        buildPrompt(prompt),
        { resolution, mode },
        setStatus,
      );

      setStatus('Kaydediliyor…');
      const saved = await persistRemoteImage(outputUrl).catch(() => outputUrl);
      setResultUrl(saved);
      addTryOn({
        imageUri: saved,
        modelId: ownModelUri ? undefined : modelId,
        outfitId: outfit?.id,
        outfitName: outfit?.name,
        prompt: prompt.trim() || undefined,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Bilinmeyen hata');
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.inkSoft} />
        </Pressable>
        <Text style={type.subtitle}>🪞 Sanal Deneme</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 50 }}>
          {!pro ? (
            <Card style={{ borderWidth: 1.5, borderColor: colors.goldSoft }}>
              <Text style={{ fontSize: 40, textAlign: 'center' }}>🪞🔒</Text>
              <Text style={[type.subtitle, { textAlign: 'center', marginTop: spacing.sm }]}>
                Sanal Deneme, BETTA Pro'ya özel
              </Text>
              <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.sm }]}>
                Hazır mankenlerden birini seç, kombinini giydir, lüks editoryal kare al.
              </Text>
              <Button
                title="🏆 BETTA Pro'ya geç"
                onPress={() => router.push('/pro')}
                style={{ marginTop: spacing.lg, backgroundColor: '#F4B942' }}
              />
            </Card>
          ) : !api.fashnKey ? (
            <Card>
              <Text style={type.subtitle}>FASHN API anahtarı gerekli</Text>
              <Text style={[type.caption, { marginTop: spacing.sm }]}>
                Sanal deneme FASHN AI ile çalışır. Ayarlar'dan API anahtarını ekleyince burada
                kombinlerini manken üzerinde deneyebileceksin.
              </Text>
              <Button
                small
                title="Ayarlar'a git"
                onPress={() => router.push('/settings')}
                style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
              />
            </Card>
          ) : (
            <>
              <SectionTitle title="1 · Manken" />
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
                      style={[styles.modelCard, active && styles.modelCardActive]}
                    >
                      <Image source={m.source} style={styles.modelImg} contentFit="cover" />
                      <Text style={[type.tiny, active && { color: colors.aquaDark, fontWeight: '700' }]}>
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
                {ownModelUri ? (
                  <Pressable
                    onPress={() => setResultUrl(undefined)}
                    style={[styles.modelCard, styles.modelCardActive]}
                  >
                    <Image source={{ uri: ownModelUri }} style={styles.modelImg} contentFit="cover" />
                    <Text style={[type.tiny, { color: colors.aquaDark, fontWeight: '700' }]}>Kendi fotoğrafım</Text>
                  </Pressable>
                ) : null}
              </View>
              {/* Kendi fotoğrafı ikincil seçenek — hazır mankenler daha iyi sonuç veriyor */}
              <View style={styles.ownRow}>
                <Pressable onPress={() => pickOwnModel(true)}>
                  <Text style={styles.ownLink}>📷 Kendi fotoğrafımı çek</Text>
                </Pressable>
                <Pressable onPress={() => pickOwnModel(false)}>
                  <Text style={styles.ownLink}>🖼️ Galeriden seç</Text>
                </Pressable>
              </View>

              <SectionTitle title="2 · Kombin" style={{ marginTop: spacing.xl }} />
              {outfits.length === 0 ? (
                <Card>
                  <Text style={type.caption}>
                    Henüz kombin yok. Stüdyo'dan bir kombin oluşturunca burada seçebilirsin.
                  </Text>
                </Card>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
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
                          style={[styles.outfitCard, active && styles.modelCardActive]}
                        >
                          <OutfitCollage
                            items={its}
                            size={96}
                            layout={o.layout}
                            frame={o.canvasFrame}
                            cropToContent={o.cropToContent}
                          />
                          <Text style={[type.tiny, { maxWidth: 96 }]} numberOfLines={1}>
                            {o.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
              {outfit && skipped > 0 ? (
                <Text style={[type.tiny, { marginTop: spacing.sm }]}>
                  {skipped} parçanın fotoğrafı yok, kolaja girmeyecek.
                </Text>
              ) : null}

              <SectionTitle title="3 · Ek yönerge (isteğe bağlı)" style={{ marginTop: spacing.xl }} />
              <TextInput
                value={prompt}
                onChangeText={setPrompt}
                placeholder="Örn. altın saatli, saçlar topuz, hafif gülümseme…"
                placeholderTextColor={colors.inkFaint}
                style={styles.prompt}
                multiline
              />
              <Text style={[type.tiny, { marginTop: 6 }]}>
                Lüks editoryal yönerge (poz, ışık, stüdyo, kalite) her üretime otomatik ekleniyor.
              </Text>

              <SectionTitle title="4 · Kalite" style={{ marginTop: spacing.xl }} />
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
                      <Text style={[styles.modeText, active && { color: '#fff' }]}>{label}</Text>
                      <Text style={[styles.modeCredit, active && { color: '#fff' }]}>
                        {TRYON_CREDITS[m][resolution]} kredi
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Button
                title={
                  busy
                    ? `Deneniyor…${status ? ` (${status})` : ''}`
                    : `✨ Giydir · ${credits} kredi`
                }
                onPress={run}
                disabled={!wearable.length || busy}
                loading={busy}
                style={{ marginTop: spacing.xl }}
              />
              {error ? (
                <Text style={[type.caption, { color: colors.danger, marginTop: spacing.sm }]}>{error}</Text>
              ) : null}

              {resultUrl ? (
                <>
                  <SectionTitle title="Sonuç 🎉" style={{ marginTop: spacing.xl }} />
                  <Card style={{ alignItems: 'center' }}>
                    <Image source={{ uri: resultUrl }} style={styles.resultImg} contentFit="contain" />
                    <Text style={[type.tiny, { marginTop: spacing.sm }]}>
                      Stüdyo → AI → Sanal giydirmelerim bölümünde saklanıyor.
                    </Text>
                  </Card>
                </>
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

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  modelCard: {
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modelCardActive: { borderColor: colors.aqua, backgroundColor: colors.card },
  modelImg: { width: 104, height: 156, borderRadius: radius.md },
  ownRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  ownLink: { fontSize: 12, color: colors.aquaDark, fontWeight: '600' },
  outfitCard: {
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  prompt: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.card,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  resultImg: { width: 280, height: 380, borderRadius: radius.lg },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  modeChipActive: { backgroundColor: colors.aquaDark, borderColor: colors.aquaDark },
  modeText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  modeCredit: { fontSize: 11, color: colors.inkFaint },
  /** Ekran dışı: yakalanacak kolaj burada tam boyutta çizilir. */
  offscreen: { position: 'absolute', left: -COLLAGE_PX * 2, top: 0 },
  collage: { width: COLLAGE_PX, height: COLLAGE_PX, backgroundColor: '#FFFFFF' },
});
