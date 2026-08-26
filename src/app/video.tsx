import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Button } from '@/components/UI';
import { saveImageToDevice } from '@/services/download';
import { persistRemoteImage } from '@/services/photoStore';
import { claimJob, releaseJob, TryOnPendingError, waitForJob } from '@/services/tryon';
import {
  startImageToVideo,
  VIDEO_CREDITS,
  type VideoDuration,
  type VideoResolution,
} from '@/services/video';
import { useStore } from '@/store/useStore';
import { font, glass, luxe, luxeRadius, luxeShadow, luxeType } from '@/theme/luxe';

/**
 * GİYDİRMEYİ VİDEOYA ÇEVİR.
 *
 * Akış: bir sanal giydirme karesi seç → süre/çözünürlük → üret. Çıktı MP4
 * adresi GEÇİCİ, o yüzden belge dizinine indirilip `videos` listesinde
 * saklanıyor (giydirmelerde de aynı kural).
 *
 * ⚠️ Oynatma için native bir oynatıcı (expo-video) gerekiyor; kurulu değil.
 * O yüzden burada sonuç, kaynak karenin üstünde oynat rozetiyle gösteriliyor
 * ve indirilebiliyor — video cihazdaki oynatıcıda açılıyor.
 */
export default function VideoScreen() {
  const { tryons, api, addVideo, pendingVideo, setPendingVideo } = useStore();
  const insets = useSafeAreaInsets();

  const [tryOnId, setTryOnId] = useState<string | undefined>(tryons[0]?.id);
  const [duration, setDuration] = useState<VideoDuration>(5);
  const [resolution, setResolution] = useState<VideoResolution>('720p');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [doneUri, setDoneUri] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message?: string } | null>(null);

  const source = tryons.find((t) => t.id === tryOnId);
  const credits = VIDEO_CREDITS[duration][resolution];

  /** Sonucu al, kalıcı kopyayı sakla, listeye ekle. */
  const finish = async (jobId: string, poster?: string, d = duration, r: string = resolution) => {
    const outputUrl = await waitForJob(api.fashnKey!, jobId, setStatus);
    setStatus('Kaydediliyor…');
    const saved = await persistRemoteImage(outputUrl, 'video').catch(() => outputUrl);
    addVideo({
      videoUri: saved,
      tryOnId,
      posterUri: poster,
      jobId,
      duration: d,
      resolution: r,
    });
    setPendingVideo(null);
    setDoneUri(saved);
  };

  /*
    Yarım kalmış iş: video da kredi harcıyor, uygulama kapansa bile sonucu
    kaybetmeyelim. Ekran açılınca bekleyen iş varsa oradan devam ediliyor.
  */
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !pendingVideo || !api.fashnKey) return;
    resumed.current = true;
    if (!claimJob(pendingVideo.jobId)) return;
    setBusy(true);
    setStatus('Kaldığı yerden devam ediliyor…');
    finish(pendingVideo.jobId, pendingVideo.posterUri, pendingVideo.duration as VideoDuration, pendingVideo.resolution)
      .catch((e: any) =>
        setError(
          e instanceof TryOnPendingError
            ? 'Üretim uzun sürüyor ama iptal olmadı — hazır olunca videolarında görünecek.'
            : (e?.message ?? 'Bilinmeyen hata'),
        ),
      )
      .finally(() => {
        releaseJob(pendingVideo.jobId);
        setBusy(false);
        setStatus('');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVideo, api.fashnKey]);

  const run = async () => {
    if (!api.fashnKey || !source || busy) return;
    let jobId: string | undefined;
    setBusy(true);
    setError(null);
    setDoneUri(undefined);
    try {
      setStatus('Video işi başlatılıyor…');
      // Giydirme kareleri belge dizininde duruyor; FASHN veri URI'si kabul ediyor.
      const FileSystem = await import('expo-file-system/legacy');
      const b64 = await FileSystem.readAsStringAsync(source.imageUri, { encoding: 'base64' as any });
      const image = `data:image/png;base64,${b64}`;

      jobId = await startImageToVideo(api.fashnKey, image, { duration, resolution });
      setPendingVideo({
        jobId,
        tryOnId: source.id,
        posterUri: source.imageUri,
        duration,
        resolution,
        startedAt: new Date().toISOString(),
      });
      claimJob(jobId);
      await finish(jobId, source.imageUri);
    } catch (e: any) {
      setError(
        e instanceof TryOnPendingError
          ? 'Üretim uzun sürüyor ama iptal olmadı — hazır olunca videolarında görünecek.'
          : (e?.message ?? 'Bilinmeyen hata'),
      );
    } finally {
      if (jobId) releaseJob(jobId);
      setBusy(false);
      setStatus('');
    }
  };

  const download = async () => {
    if (!doneUri || saving) return;
    setSaving(true);
    const res = await saveImageToDevice(doneUri, `betta-video-${Date.now()}.mp4`, 'video/mp4');
    setSaving(false);
    if (res === 'saved') setNotice({ title: 'İndirildi', message: 'Seçtiğin klasöre kaydedildi.' });
    else if (res === 'error')
      setNotice({ title: 'İndirilemedi', message: 'Klasör izni alınamadı, tekrar dene.' });
  };

  const Chips = <T extends string | number>({
    label,
    options,
    value,
    onPick,
    credit,
  }: {
    label: string;
    options: T[];
    value: T;
    onPick: (v: T) => void;
    credit: (v: T) => number;
  }) => (
    <View style={{ marginTop: 16 }}>
      <Text style={luxeType.label}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((o) => {
          const on = value === o;
          return (
            <Pressable
              key={String(o)}
              onPress={() => onPick(o)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && { color: luxe.onPrimary }]}>
                {typeof o === 'number' ? `${o} sn` : String(o)}
              </Text>
              <Text style={[styles.chipCredit, on && { color: luxe.onDarkSoft }]}>
                {credit(o)} kredi
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />
      <ConfirmModal
        notice
        visible={!!notice}
        title={notice?.title ?? ''}
        message={notice?.message}
        onConfirm={() => setNotice(null)}
        onCancel={() => setNotice(null)}
      />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={luxeType.headline}>Videoya çevir</Text>
          <Text style={luxeType.label}>Giydirmen hareket etsin</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.close} hitSlop={8}>
          <Ionicons name="close" size={20} color={luxe.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {tryons.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="film-outline" size={28} color={luxe.outlineSoft} />
            <Text style={[luxeType.body, { textAlign: 'center', marginTop: 10 }]}>
              Önce bir sanal giydirme üret; video onun üzerinden yapılıyor.
            </Text>
          </View>
        ) : (
          <>
            <Text style={luxeType.label}>1 · Kare seç</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.frameRow}
              style={{ flexGrow: 0 }}
            >
              {tryons.map((t) => {
                const on = tryOnId === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      setTryOnId(t.id);
                      setDoneUri(undefined);
                    }}
                    style={[styles.frame, on && styles.frameOn]}
                  >
                    <Image source={{ uri: t.imageUri }} style={styles.frameImg} contentFit="cover" />
                  </Pressable>
                );
              })}
            </ScrollView>

            <Chips
              label="2 · Süre"
              options={[5, 10] as VideoDuration[]}
              value={duration}
              onPick={setDuration}
              credit={(d) => VIDEO_CREDITS[d][resolution]}
            />
            <Chips
              label="3 · Çözünürlük"
              options={['480p', '720p', '1080p'] as VideoResolution[]}
              value={resolution}
              onPick={setResolution}
              credit={(r) => VIDEO_CREDITS[duration][r]}
            />

            {/* Önizleme: kaynak kare, üstünde oynat rozeti */}
            <View style={styles.stage}>
              {source ? (
                <Image source={{ uri: source.imageUri }} style={styles.poster} contentFit="contain" />
              ) : null}
              {busy ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{status || 'Üretiliyor'}</Text>
                </View>
              ) : doneUri ? (
                <View style={styles.badge}>
                  <Ionicons name="checkmark" size={13} color={luxe.onDark} />
                  <Text style={styles.badgeText}>Video hazır</Text>
                </View>
              ) : null}
            </View>

            {error ? (
              <Text style={[luxeType.tiny, { color: luxe.danger, marginTop: 10 }]}>{error}</Text>
            ) : null}

            {doneUri ? (
              <>
                <Text style={[luxeType.tiny, { marginTop: 12 }]}>
                  Video &quot;Sanal videolarım&quot;da saklanıyor. Uygulama içinde oynatma için
                  oynatıcı eklenmesi gerekiyor; şimdilik indirip telefonun galerisinden izleyebilirsin.
                </Text>
                <Button
                  title={saving ? 'İndiriliyor…' : 'Videoyu indir'}
                  onPress={download}
                  disabled={saving}
                  style={{ marginTop: 14 }}
                />
                <Button
                  variant="ghost"
                  title="Bir tane daha"
                  onPress={() => setDoneUri(undefined)}
                  style={{ marginTop: 8 }}
                />
              </>
            ) : (
              <Button
                title={
                  !api.fashnKey
                    ? 'API anahtarı gerekli'
                    : busy
                      ? status || 'Üretiliyor…'
                      : `Videoyu oluştur · ${credits} kredi`
                }
                onPress={!api.fashnKey ? () => router.push('/settings') : run}
                disabled={!!api.fashnKey && (busy || !source)}
                loading={busy}
                style={{ marginTop: 18 }}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  container: { paddingHorizontal: 20 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  frameRow: { gap: 8, paddingVertical: 10 },
  frame: {
    width: 74,
    height: 104,
    borderRadius: luxeRadius.md,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: luxe.outlineSoft,
  },
  frameOn: { borderColor: luxe.primary, borderWidth: 2 },
  frameImg: { width: '100%', height: '100%' },
  stage: {
    marginTop: 18,
    borderRadius: luxeRadius.lg,
    backgroundColor: '#FFFDFD',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 3 / 4,
    ...luxeShadow.card,
  },
  poster: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: luxeRadius.pill,
    backgroundColor: 'rgba(31,31,36,0.75)',
  },
  badgeText: {
    fontFamily: font.label,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: luxe.onDark,
  },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: luxeRadius.pill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    backgroundColor: glass.fill,
  },
  chipOn: { backgroundColor: luxe.primary, borderColor: luxe.primary },
  chipText: { fontFamily: font.bodyMedium, fontSize: 13, color: luxe.ink },
  chipCredit: { fontFamily: font.body, fontSize: 10.5, color: luxe.outline, marginTop: 1 },
});
