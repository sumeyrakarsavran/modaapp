import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ItemThumb } from '@/components/ItemThumb';
import { Button, Card, SectionTitle } from '@/components/UI';
import { photoFromParams, pickPhoto } from '@/services/photoPicker';
import { runTryOn } from '@/services/tryon';
import { useStore } from '@/store/useStore';
import { colors, radius, spacing, type } from '@/theme';

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
  return `data:image/jpeg;base64,${b64}`;
}

export default function TryOn() {
  const params = useLocalSearchParams<{ itemId?: string }>();
  const { itemId } = params;
  const { items, api, pro } = useStore();

  const garments = useMemo(
    () => items.filter((i) => !i.archived && i.imageUri && ['ust', 'alt', 'elbise', 'dis'].includes(i.category)),
    [items],
  );
  const [selectedGarment, setSelectedGarment] = useState<string | undefined>(
    itemId && garments.some((g) => g.id === itemId) ? itemId : undefined,
  );
  const [modelUri, setModelUri] = useState<string | undefined>();
  const [resultUrl, setResultUrl] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  /** Model fotoğrafı — kırpma açık (dikey kadraj), boydan duruş en iyi sonucu verir. */
  const pickModel = async (fromCamera = false) => {
    const photo = await pickPhoto({ fromCamera, aspect: [3, 4], quality: 0.9, purpose: 'model' });
    if (!photo) return;
    setModelUri(photo.uri);
    setResultUrl(undefined);
  };

  // Android'de süreç öldüyse kök layout model fotoğrafını parametreyle buraya yollar
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (recoveredRef.current) return;
    const photo = photoFromParams(params);
    if (!photo) return;
    recoveredRef.current = true;
    setModelUri(photo.uri);
    setResultUrl(undefined);
  }, [params]);

  const garment = garments.find((g) => g.id === selectedGarment);

  const run = async () => {
    if (!api.fashnKey || !garment?.imageUri || !modelUri) return;
    setBusy(true);
    setError(null);
    setResultUrl(undefined);
    try {
      const [model, cloth] = await Promise.all([toDataUri(modelUri), toDataUri(garment.imageUri)]);
      const category =
        garment.category === 'elbise' ? 'one-pieces' : garment.category === 'alt' ? 'bottoms' : 'tops';
      const r = await runTryOn(api.fashnKey, model, cloth, category, setStatus);
      setResultUrl(r.outputUrl);
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

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 50 }}>
        {!pro ? (
          <Card style={{ borderWidth: 1.5, borderColor: colors.goldSoft }}>
            <Text style={{ fontSize: 40, textAlign: 'center' }}>🪞🔒</Text>
            <Text style={[type.subtitle, { textAlign: 'center', marginTop: spacing.sm }]}>
              Sanal Deneme, BETTA Pro'ya özel
            </Text>
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.sm }]}>
              FASHN AI ile kıyafetlerini model fotoğrafının üzerinde gerçekçi şekilde gör.
              Model seç → kıyafeti seç → saniyeler içinde üzerinde dene.
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
              kıyafetlerini bir model fotoğrafının üzerinde deneyebileceksin.
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
            <SectionTitle title="1 · Model fotoğrafı" />
            <Card>
              {modelUri ? (
                <View style={{ alignItems: 'center' }}>
                  <Image source={{ uri: modelUri }} style={styles.modelImg} contentFit="cover" />
                  <Button small variant="ghost" title="Değiştir" onPress={pickModel} style={{ marginTop: spacing.sm }} />
                </View>
              ) : (
                <View style={{ alignItems: 'center', gap: spacing.sm }}>
                  <Text style={{ fontSize: 40 }}>🧍‍♀️</Text>
                  <Text style={[type.caption, { textAlign: 'center' }]}>
                    Kendi fotoğrafını ya da bir model fotoğrafı seç. Boydan, düz duruş en iyi sonucu verir.
                  </Text>
                  <Button small title="Fotoğraf seç" onPress={pickModel} />
                </View>
              )}
            </Card>

            <SectionTitle title="2 · Denenecek parça" style={{ marginTop: spacing.xl }} />
            {garments.length === 0 ? (
              <Card>
                <Text style={type.caption}>
                  Fotoğraflı bir üst, alt, elbise veya dış giyim parçası gerekiyor. Gardırobına
                  fotoğraflı parça ekleyince burada görünecek.
                </Text>
              </Card>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {garments.map((g) => (
                    <ItemThumb
                      key={g.id}
                      item={g}
                      size={86}
                      showName
                      selected={selectedGarment === g.id}
                      onPress={() => {
                        setSelectedGarment(g.id);
                        setResultUrl(undefined);
                      }}
                    />
                  ))}
                </View>
              </ScrollView>
            )}

            <Button
              title={busy ? `Deneniyor… ${status ? `(${status})` : ''}` : '✨ Üzerinde dene'}
              onPress={run}
              disabled={!modelUri || !garment || busy}
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
                </Card>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
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
  modelImg: { width: 200, height: 280, borderRadius: radius.lg },
  resultImg: { width: 280, height: 380, borderRadius: radius.lg },
});
