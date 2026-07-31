import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/UI';
import { cropToAspect } from '@/services/imageResize';
import { resolveCameraPhoto, type PickedPhoto } from '@/services/photoPicker';
import { colors, radius, spacing, type } from '@/theme';

/**
 * UYGULAMA İÇİ KAMERA.
 *
 * Neden var: harici kamera uygulaması (ACTION_IMAGE_CAPTURE) açılınca BETTA
 * arka plana düşüyor ve Samsung'un bellek yöneticisi süreci öldürüyor
 * (logcat: `am_proc_died` + `am_kill ... kill background`). Dönüşte fotoğraf
 * kayboluyor, uygulama sıfırdan başlıyor — "donup geri çıkıyor" budur.
 * `getPendingResultAsync()` bunu kurtaramaz; Expo o sonucu yalnızca BELLEKTE
 * tutar, süreç ölünce kaybolur.
 *
 * Burada kamera uygulamanın İÇİNDE açılır: ön planda kaldığımız için sistem
 * bizi öldürmez. Kırpma da ayrı bir activity açmasın diye kendimiz yapılır —
 * çekim ekranındaki çerçeve rehberi ile aynı oran, ortadan kırpma.
 */
export default function CameraScreen() {
  const params = useLocalSearchParams<{ aw?: string; ah?: string }>();
  const aw = Number(params.aw) > 0 ? Number(params.aw) : 1;
  const ah = Number(params.ah) > 0 ? Number(params.ah) : 1;

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [shot, setShot] = useState<PickedPhoto | null>(null);
  const [busy, setBusy] = useState(false);

  const camRef = useRef<CameraView>(null);
  // Sonucu bir kez teslim et; ekran kapanırken bekleyen sözü boşta bırakma
  const deliveredRef = useRef(false);

  const deliver = useCallback((photo: PickedPhoto | null) => {
    if (deliveredRef.current) return;
    deliveredRef.current = true;
    resolveCameraPhoto(photo);
  }, []);

  // Ekran her nasıl kapanırsa kapansın (geri tuşu dahil) sözü çöz — yoksa
  // çağıran ekran sonsuza dek "işleniyor" durumunda kalır.
  useEffect(() => () => deliver(null), [deliver]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const close = () => {
    deliver(null);
    router.back();
  };

  const shoot = async () => {
    if (!camRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        setShot({ uri: photo.uri, width: photo.width, height: photo.height });
      }
    } catch {
      // Sessizce yut — kullanıcı tekrar deneyebilir
    } finally {
      setBusy(false);
    }
  };

  const usePhoto = async () => {
    if (!shot || busy) return;
    setBusy(true);
    try {
      const cropped = await cropToAspect(shot.uri, shot.width ?? 0, shot.height ?? 0, [aw, ah]);
      deliver(cropped);
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const frame = { aspectRatio: aw / ah };

  if (!permission) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.aqua} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={{ fontSize: 44 }}>📷</Text>
          <Text style={[type.subtitle, styles.light, { marginTop: spacing.md }]}>
            Kamera izni gerekli
          </Text>
          <Text style={[type.caption, styles.dim, { textAlign: 'center', marginTop: spacing.sm }]}>
            Kıyafetlerini fotoğraflamak için kamera erişimine izin ver.
          </Text>
          <Button
            title={permission.canAskAgain ? 'İzin ver' : 'Kapat'}
            onPress={permission.canAskAgain ? () => requestPermission() : close}
            style={{ marginTop: spacing.lg }}
          />
          {permission.canAskAgain ? (
            <Button variant="ghost" small title="Vazgeç" onPress={close} style={{ marginTop: spacing.sm }} />
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={close} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={[type.subtitle, styles.light]}>📸 Fotoğraf çek</Text>
        {shot ? (
          <View style={{ width: 40 }} />
        ) : (
          <Pressable
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <Ionicons name="camera-reverse-outline" size={22} color="#FFFFFF" />
          </Pressable>
        )}
      </View>

      <View style={styles.stage}>
        <View style={[styles.frame, frame]}>
          {shot ? (
            <Image source={{ uri: shot.uri }} style={styles.fill} contentFit="cover" />
          ) : (
            <CameraView ref={camRef} style={styles.fill} facing={facing} mode="picture" />
          )}
          {/* Çerçeve rehberi: fotoğraf tam da bu orana kırpılır */}
          <View pointerEvents="none" style={styles.guide} />
        </View>
        <Text style={[type.caption, styles.dim, styles.hint]}>
          {shot
            ? 'Beğendin mi? Fotoğraf bu çerçeveye göre kırpılacak.'
            : 'Kıyafeti çerçevenin içine al — düz ve iyi ışıklı bir zemin en iyi sonucu verir.'}
        </Text>
      </View>

      <View style={styles.controls}>
        {shot ? (
          <View style={styles.row}>
            <Button
              variant="ghost"
              title="↺ Yeniden çek"
              onPress={() => setShot(null)}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <Button
              title="Kullan"
              onPress={usePhoto}
              loading={busy}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <Pressable
            onPress={shoot}
            disabled={busy}
            style={[styles.shutter, busy && { opacity: 0.5 }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.deep} />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.deep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  light: { color: '#FFFFFF' },
  dim: { color: '#B7D3DC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  stage: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  frame: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  guide: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: radius.lg,
  },
  hint: { textAlign: 'center', marginTop: spacing.lg },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    minHeight: 104,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: spacing.md },
  shutter: {
    alignSelf: 'center',
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
});
