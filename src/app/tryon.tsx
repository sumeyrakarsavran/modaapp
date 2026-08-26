import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image as RNImage } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { BTN_PAD, FinBlob } from '@/components/FinBlob';
import { GarmentArt } from '@/components/GarmentArt';
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
import { font, glass, luxe, luxeRadius, luxeShadow, luxeType } from '@/theme/luxe';
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

/**
 * DENEME STÜDYOSU.
 *
 * Akış: önce manken seçilir (`/models`), sonra burada kombin seçilip
 * giydirilir. Düzen mankeni merkeze alıyor — asıl merak edilen "üstümde nasıl
 * durur" sorusu; kombinler altta şerit, ayarlar kutuda.
 */
export default function TryOn() {
  const params = useLocalSearchParams<{ outfitId?: string }>();
  const {
    items,
    outfits,
    api,
    pro,
    addTryOn,
    setPendingTryOn,
    models,
    selectedModel,
    setSelectedModel,
  } = useStore();
  const insets = useSafeAreaInsets();

  /** Kendi fotoğrafını kullanmak isteyenler için (küçük seçenek). */
  const [ownModelUri, setOwnModelUri] = useState<string | undefined>();
  const [outfitId, setOutfitId] = useState<string | undefined>(params.outfitId);
  const [prompt, setPrompt] = useState('');
  const [resultUrl, setResultUrl] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  /*
    Çözünürlük ARAYÜZDE seçilebiliyor. Sabit 1k bırakılmıştı: çıktı 1024px
    geliyordu ve FASHN'ın kendi arayüzünde alınan sonuçlara göre belirgin
    şekilde daha az detaylıydı. Kredi de çözünürlükle artıyor.
  */
  const [resolution, setResolution] = useState<TryOnResolution>('2k');
  const [mode, setMode] = useState<TryOnMode>('fast');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [proInfo, setProInfo] = useState(false);
  /** Ekran dışında çizilen kombin kolajı — FASHN'a ürün görseli olarak gider. */
  const collageRef = useRef<View>(null);

  /* ————— Seçili manken ————— */
  const preset =
    selectedModel?.kind === 'preset' ? TRYON_MODELS.find((m) => m.id === selectedModel.id) : undefined;
  const custom =
    selectedModel?.kind === 'custom' ? models.find((m) => m.id === selectedModel.id) : undefined;
  /** Ekranda gösterilecek manken görseli; kendi fotoğrafı her şeyin önünde. */
  const modelUri = ownModelUri ?? custom?.imageUri;
  const modelSource = !modelUri && preset ? preset.source : undefined;
  /** Görseli henüz üretilmemiş mankenle giydirme yapılamaz. */
  const modelReady = !!modelUri || !!modelSource;

  /*
    Manken kutusu görselin KENDİ oranını alıyor. Sabit kutuda `contain`
    fotoğrafın çevresinde beyaz şerit bırakıyordu; kutu ölçülen alana
    oranıyla sığdırılınca beyaz fazlalık kalmıyor.
  */
  const [stageBox, setStageBox] = useState<{ w: number; h: number } | null>(null);
  const [loadedAspect, setLoadedAspect] = useState<number>();
  const aspectOf = (e: { source?: { width: number; height: number } | null }) =>
    e.source && e.source.height > 0 ? e.source.width / e.source.height : undefined;
  /*
    Hazır mankenin oranı paketten SENKRON okunuyor. `onLoad`'ı beklerken
    varsayılan oran kullanılınca ekran açılır açılmaz kutu bir kez yeniden
    boyutlanıyor ve fotoğraf "uzuyormuş" gibi görünüyordu.
  */
  const presetAspect = useMemo(() => {
    if (!modelSource) return undefined;
    const src = RNImage.resolveAssetSource(modelSource);
    return src?.width && src?.height ? src.width / src.height : undefined;
  }, [modelSource]);
  const modelAspect = presetAspect ?? loadedAspect ?? 1023 / 1537;
  const fit =
    stageBox && stageBox.w > 0 && stageBox.h > 0
      ? stageBox.w / stageBox.h > modelAspect
        ? { width: stageBox.h * modelAspect, height: stageBox.h }
        : { width: stageBox.w, height: stageBox.w / modelAspect }
      : undefined;

  /** Kendi model fotoğrafı — kalıcı kopya saklanır. */
  const saveOwnModel = async (photo: PickedPhoto) => {
    const small = await resizeForProcessing(photo.uri, photo.width, photo.height, 1400);
    const saved = await persistGarmentPhoto(small).catch(() => small);
    setOwnModelUri(saved);
    setResultUrl(undefined);
  };

  const pickOwnModel = async (fromCamera = false) => {
    setOptionsOpen(false);
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

  // Manken seçilmeden stüdyoya girilmişse önce seçim ekranı
  useEffect(() => {
    if (!selectedModel && !ownModelUri) router.replace('/models');
  }, [selectedModel, ownModelUri]);

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
  /** Sağ şeritteki parçalar — şimdilik gardıroptan; ileride 2D giydirme için. */
  const railItems = useMemo(
    () => items.filter((i) => !i.archived && i.imageUri).slice(0, 8),
    [items],
  );

  const run = async () => {
    let startedJobId: string | undefined;
    if (!api.fashnKey || !wearable.length || !modelReady) return;
    setBusy(true);
    setError(null);
    setResultUrl(undefined);
    try {
      setStatus('Manken hazırlanıyor…');
      const modelImage = modelUri
        ? await toDataUri(modelUri)
        : modelSource
          ? await modelSourceToDataUri(modelSource, MODEL_PX[resolution])
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
        modelId: preset && !modelUri ? preset.id : undefined,
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
        modelId: preset && !modelUri ? preset.id : undefined,
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

  const pickModel = (kind: 'preset' | 'custom', id: string) => {
    setOwnModelUri(undefined);
    setSelectedModel({ kind, id });
    setResultUrl(undefined);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />

      {/* Pro bilgi kutusu — sağ şeritteki parçalar buna götürüyor */}
      <Modal
        visible={proInfo}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setProInfo(false)}
      >
        <Pressable style={styles.center} onPress={() => setProInfo(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Parçayı tek tek giydirme</Text>
            <Text style={[luxeType.body, { marginTop: 8 }]}>
              Pro ile kendi parçalarını mankene 2D olarak tam oturacak şekilde giydirebileceksin:
              sağdaki şeritten bir parçayı sürükleyip mankenin üstüne bırakınca görsel üretilecek.
            </Text>
            <Text style={[luxeType.tiny, { marginTop: 10 }]}>
              Bu özellik hazırlanıyor. Şimdilik kombin seçip tüm kombini birden giydirebilirsin.
            </Text>
            <Button title="Anladım" onPress={() => setProInfo(false)} style={{ marginTop: 16 }} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Üretim ayarları: yönerge + kalite (ekran sade kalsın diye kutuda) */}
      <Modal
        visible={optionsOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOptionsOpen(false)}
      >
        <KeyboardAvoidingView style={styles.bottomWrap} behavior="padding">
          <Pressable style={styles.fill} onPress={() => setOptionsOpen(false)} />
          <View style={[styles.optionSheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Üretim ayarları</Text>
              <Pressable onPress={() => setOptionsOpen(false)} hitSlop={10} style={styles.iconBtn}>
                <Ionicons name="close" size={18} color={luxe.primary} />
              </Pressable>
            </View>

            <Text style={[luxeType.label, { marginTop: 14 }]}>Ek yönerge</Text>
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

            <Text style={[luxeType.label, { marginTop: 16 }]}>Çözünürlük</Text>
            <View style={styles.modeRow}>
              {(['1k', '2k', '4k'] as TryOnResolution[]).map((r) => {
                const on = resolution === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setResolution(r)}
                    style={[styles.modeChip, on && styles.modeChipOn]}
                  >
                    <Text style={[styles.modeText, on && { color: luxe.onPrimary }]}>
                      {r.toUpperCase()}
                    </Text>
                    <Text style={[styles.modeCredit, on && { color: luxe.onDarkSoft }]}>
                      {TRYON_CREDITS[mode][r]} kredi
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[luxeType.label, { marginTop: 16 }]}>Kalite</Text>
            <View style={styles.modeRow}>
              {(['fast', 'balanced', 'quality'] as TryOnMode[]).map((m) => {
                const on = mode === m;
                const label = m === 'fast' ? 'Hızlı' : m === 'balanced' ? 'Dengeli' : 'Kaliteli';
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMode(m)}
                    style={[styles.modeChip, on && styles.modeChipOn]}
                  >
                    <Text style={[styles.modeText, on && { color: luxe.onPrimary }]}>{label}</Text>
                    <Text style={[styles.modeCredit, on && { color: luxe.onDarkSoft }]}>
                      {TRYON_CREDITS[m][resolution]} kredi
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Kendi fotoğrafı ikincil: hazır mankenler daha tutarlı sonuç veriyor */}
            <View style={styles.ownRow}>
              <PillBtn icon="camera-outline" title="Kendi fotoğrafım" onPress={() => pickOwnModel(true)} />
              <PillBtn icon="images-outline" title="Galeriden" onPress={() => pickOwnModel(false)} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.header}>
        {/*
          Başlık DAHA KÜÇÜK: ekranın kahramanı manken, başlık değil.
          Sağlayıcı adı (hangi servisin çalıştığı) arayüzde yazmıyor.
        */}
        <Text style={[luxeType.headline, styles.title]}>Stüdyo</Text>
        <Pressable onPress={() => router.push('/models')} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="people-outline" size={19} color={luxe.primary} />
        </Pressable>
        <Pressable onPress={() => router.back()} style={[styles.iconBtn, { marginLeft: 8 }]} hitSlop={8}>
          <Ionicons name="close" size={20} color={luxe.primary} />
        </Pressable>
      </View>

      {/* Manken şeridi: küçük ve yalnızca YÜZLER — yer kaplamasın */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.faceRow}
        style={{ flexGrow: 0 }}
      >
        {TRYON_MODELS.map((m) => {
          const on = !ownModelUri && selectedModel?.kind === 'preset' && selectedModel.id === m.id;
          return (
            <Pressable key={m.id} onPress={() => pickModel('preset', m.id)} style={[styles.face, on && styles.faceOn]}>
              <Image source={m.source} style={[styles.faceImg, faceOffset(m.faceTop)]} contentFit="cover" />
            </Pressable>
          );
        })}
        {models.map((m) => {
          const on = !ownModelUri && selectedModel?.kind === 'custom' && selectedModel.id === m.id;
          return (
            <Pressable key={m.id} onPress={() => pickModel('custom', m.id)} style={[styles.face, on && styles.faceOn]}>
              {m.imageUri ? (
                <Image source={{ uri: m.imageUri }} style={[styles.faceImg, faceOffset()]} contentFit="cover" />
              ) : (
                <View style={[styles.faceImg, styles.facePlaceholder]}>
                  <Ionicons name="person-outline" size={17} color={luxe.outline} />
                </View>
              )}
            </Pressable>
          );
        })}
        {ownModelUri ? (
          <View style={[styles.face, styles.faceOn]}>
            <Image source={{ uri: ownModelUri }} style={[styles.faceImg, faceOffset()]} contentFit="cover" />
          </View>
        ) : null}
        <Pressable onPress={() => router.push('/model-new')} style={styles.faceAdd}>
          <Ionicons name="add" size={19} color={luxe.primary} />
        </Pressable>
      </ScrollView>

      {/* ————— Sahne: manken kocaman, sağda parça şeridi ————— */}
      <View style={styles.stage}>
        <View
          style={styles.stageArea}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setStageBox((b) => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
          }}
        >
          <View style={[styles.modelBox, fit]}>
          {resultUrl ? (
            <Image
              source={{ uri: resultUrl }}
              style={styles.modelImg}
              contentFit="cover"
              onLoad={(e) => setLoadedAspect(aspectOf(e))}
            />
          ) : modelUri ? (
            <Image
              source={{ uri: modelUri }}
              style={styles.modelImg}
              contentFit="cover"
              onLoad={(e) => setLoadedAspect(aspectOf(e))}
            />
          ) : modelSource ? (
            <Image
              source={modelSource}
              style={styles.modelImg}
              contentFit="cover"
              onLoad={(e) => setLoadedAspect(aspectOf(e))}
            />
          ) : (
            /* Görseli henüz üretilmemiş kendi mankeni */
            <View style={styles.modelEmpty}>
              <Ionicons name="body-outline" size={44} color={luxe.outlineSoft} />
              <Text style={[luxeType.body, { textAlign: 'center', marginTop: 10 }]}>
                {custom
                  ? `${custom.hair} saç · ${custom.skin} ten · ${custom.size} beden · ${custom.height} cm`
                  : 'Manken seçilmedi'}
              </Text>
              <Text style={[luxeType.tiny, { textAlign: 'center', marginTop: 6 }]}>
                Bu mankenin görseli henüz üretilmedi.
              </Text>
            </View>
          )}

          {busy ? (
            <View style={styles.badge}>
              <View style={styles.dot} />
              <Text style={styles.badgeText}>{status || 'Yapay zeka çalışıyor'}</Text>
            </View>
          ) : null}
          </View>
        </View>

        {/*
          Sağ şerit: ileride parçalar buradan sürüklenip mankene giydirilecek
          (Pro). Şimdilik gardıroptan parçalar görünüyor; dokununca özelliğin
          ne olacağını anlatan kutu açılıyor.
        */}
        <View style={styles.rail}>
          <Pressable onPress={() => setProInfo(true)} style={styles.railHead} hitSlop={6}>
            <Ionicons name="diamond-outline" size={15} color={luxe.primary} />
          </Pressable>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {railItems.map((it) => (
              <Pressable key={it.id} onPress={() => setProInfo(true)} style={styles.railItem}>
                {it.imageUri ? (
                  <Image source={{ uri: it.imageUri }} style={styles.railImg} contentFit="contain" />
                ) : (
                  <GarmentArt category={it.category} colorId={it.colorId} size={26} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* ————— Kombinler + üret ————— */}
      <View style={[styles.bottom, { paddingBottom: 10 + insets.bottom }]}>
        {outfits.length === 0 ? (
          <Text style={[luxeType.tiny, { paddingHorizontal: 20 }]}>
            Henüz kombin yok. Stüdyo&apos;dan bir kombin oluşturunca burada seçebilirsin.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.outfitRow}
            style={{ flexGrow: 0 }}
          >
            {outfits.map((o) => {
              const its = o.itemIds
                .map((id) => items.find((i) => i.id === id))
                .filter(Boolean) as WardrobeItem[];
              const on = outfitId === o.id;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => {
                    setOutfitId(o.id);
                    setResultUrl(undefined);
                  }}
                  style={[styles.outfit, on && styles.outfitOn]}
                >
                  <OutfitCollage
                    items={its}
                    size={68}
                    layout={o.layout}
                    frame={o.canvasFrame}
                    cropToContent={o.cropToContent}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/*
          Not satırı HER ZAMAN duruyor (boşken bile): metin belirince düzen
          kayıp mankenin boyunu değiştiriyordu.
        */}
        <View style={styles.noteLine}>
          {error ? (
            <Text style={[luxeType.tiny, { color: luxe.danger }]} numberOfLines={2}>
              {error}
            </Text>
          ) : outfit && skipped > 0 ? (
            <Text style={luxeType.tiny} numberOfLines={2}>
              {skipped} parçanın fotoğrafı yok, kolaja girmeyecek.
            </Text>
          ) : null}
        </View>

        <View style={styles.ctaRow}>
          <Pressable onPress={() => setOptionsOpen(true)} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="options-outline" size={19} color={luxe.primary} />
          </Pressable>
          <Button
            title={
              !pro
                ? "BETTA Pro'ya geç"
                : !api.fashnKey
                  ? 'API anahtarı gerekli'
                  : busy
                    ? status || 'Deneniyor…'
                    : `Giydir · ${credits} kredi`
            }
            onPress={
              !pro ? () => router.push('/pro') : !api.fashnKey ? () => router.push('/settings') : run
            }
            disabled={pro && !!api.fashnKey && (!wearable.length || !modelReady || busy)}
            loading={busy}
            style={{ flex: 1 }}
          />
        </View>
      </View>

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

/**
 * Yüz kırpması: görselin `faceTop` oranındaki noktası dairenin ORTASINA
 * gelecek şekilde yukarı kaydırılıyor. Tek bir sabit değer iki mankende de
 * doğru çıkmıyordu — kafalar farklı yükseklikte başlıyor.
 */
const faceOffset = (faceTop = 0.12) => ({ top: FACE / 2 - faceTop * FACE_IMG_H });

/** Uygulamanın küçük siluetli düğmesi. */
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

const FACE = 42;
/** Yüz görselinin daire içindeki ölçeği — baş daireyi doldursun. */
const FACE_IMG_H = FACE * 5;
const RAIL = 56;

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
  },
  title: { flex: 1, fontSize: 26, lineHeight: 34 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: glass.fill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
  },
  /* ————— Manken şeridi (yalnızca yüzler) ————— */
  faceRow: { gap: 8, paddingHorizontal: 20, paddingBottom: 10, alignItems: 'center' },
  face: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: luxe.outlineSoft,
    backgroundColor: luxe.surface,
  },
  faceOn: { borderColor: luxe.primary, borderWidth: 2 },
  /*
    YALNIZCA YÜZ. `contentFit="cover"` + `contentPosition` yetmiyor (daire
    içinde tüm boy görünüyordu): görsel dairenin birkaç katı büyüklükte
    çizilip baş hizası daireye ORTALANIYOR. Tam boy manken fotoğraflarında
    baş, karenin üst ~%10'unda ve yatayda ortada.
  */
  faceImg: {
    position: 'absolute',
    width: FACE * 3.3,
    height: FACE_IMG_H,
    left: -(FACE * 3.3) / 2 + FACE / 2,
    /* `top` satır içinde: modele göre değişiyor (bkz. `faceOffset`). */
  },
  facePlaceholder: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: luxe.surfaceLow,
  },
  faceAdd: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* ————— Sahne ————— */
  stage: { flex: 1, flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modelBox: {
    borderRadius: luxeRadius.xl,
    /* Zemin OPAK: yarı saydam yüzey + elevation gölgeyi içeri sızdırıyor. */
    backgroundColor: '#FFFDFD',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...luxeShadow.card,
  },
  modelImg: { width: '100%', height: '100%' },
  modelEmpty: { alignItems: 'center', paddingHorizontal: 24 },
  badge: {
    position: 'absolute',
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: luxeRadius.pill,
    backgroundColor: 'rgba(31,31,36,0.72)',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: luxe.onDark },
  badgeText: {
    fontFamily: font.label,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: luxe.onDark,
  },
  /* ————— Sağ parça şeridi (Pro tanıtımı) ————— */
  rail: {
    width: RAIL,
    borderRadius: luxeRadius.lg,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    paddingVertical: 8,
    paddingHorizontal: 5,
    gap: 8,
  },
  railHead: {
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: luxe.outlineSoft,
  },
  railItem: {
    width: RAIL - 14,
    height: RAIL - 14,
    borderRadius: luxeRadius.sm,
    backgroundColor: luxe.surface,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  railImg: { width: '86%', height: '86%' },
  /* ————— Alt: kombinler + üret ————— */
  bottom: { paddingTop: 12 },
  /** Sabit yükseklik: iki satırlık not alanı, boşken de yerini koruyor. */
  noteLine: { height: 32, justifyContent: 'center', paddingHorizontal: 20, marginTop: 4 },
  outfitRow: { gap: 8, paddingHorizontal: 20 },
  outfit: {
    padding: 4,
    borderRadius: luxeRadius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  outfitOn: { borderColor: luxe.primary, backgroundColor: glass.fillStrong },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  /* ————— Kutular ————— */
  center: { flex: 1, backgroundColor: luxe.overlay, justifyContent: 'center', padding: 24 },
  bottomWrap: { flex: 1, backgroundColor: luxe.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFDFD',
    borderRadius: luxeRadius.lg,
    padding: 22,
    ...luxeShadow.card,
  },
  optionSheet: {
    backgroundColor: '#FFFDFD',
    borderTopLeftRadius: luxeRadius.lg,
    borderTopRightRadius: luxeRadius.lg,
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: {
    fontFamily: font.headlineItalic,
    fontStyle: 'italic',
    fontSize: 20,
    color: luxe.primary,
  },
  prompt: {
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    fontFamily: font.body,
    fontSize: 15,
    color: luxe.ink,
    backgroundColor: luxe.surface,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: luxeRadius.pill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    backgroundColor: glass.fill,
  },
  modeChipOn: { backgroundColor: luxe.primary, borderColor: luxe.primary },
  modeText: { fontFamily: font.bodyMedium, fontSize: 13, color: luxe.ink },
  modeCredit: { fontFamily: font.body, fontSize: 10.5, color: luxe.outline, marginTop: 1 },
  ownRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
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
  /** Ekran dışı: yakalanacak kolaj burada tam boyutta çizilir. */
  offscreen: { position: 'absolute', left: -COLLAGE_PX * 2, top: 0 },
  collage: { width: COLLAGE_PX, height: COLLAGE_PX, backgroundColor: '#FFFFFF' },
});
