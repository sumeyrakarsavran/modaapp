import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { BTN_PAD, FinBlob } from '@/components/FinBlob';
import { cropToAspect } from '@/services/imageResize';
import { resolveCameraPhoto, type PickedPhoto } from '@/services/photoPicker';
import { font, glass, iridescent, luxe, luxeRadius } from '@/theme/luxe';

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
 *
 * Arayüz bilerek ÇIPLAK: kare, deklanşör, iki eylem. Yazılı ipuçları,
 * başlık ve süsler kaldırıldı — kamera ekranında görüntüden başka her şey
 * gürültü.
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

  if (!permission) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <ActivityIndicator color={luxe.primary} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={34} color={luxe.outlineSoft} />
          <Text style={styles.permTitle}>Kamera izni gerekli</Text>
          <DarkButton
            title={permission.canAskAgain ? 'İzin ver' : 'Kapat'}
            onPress={permission.canAskAgain ? () => requestPermission() : close}
            solid
            style={{ marginTop: 22 }}
          />
          {permission.canAskAgain ? (
            <Pressable onPress={close} hitSlop={10} style={{ marginTop: 14 }}>
              <Text style={styles.link}>Vazgeç</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* Diğer ekranlarla AYNI zemin */}
      <Backdrop />
      {/* Başlık yok: kapat solda, çevir sağda. */}
      <View style={styles.header}>
        <Pressable onPress={close} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="close" size={21} color={luxe.primary} />
        </Pressable>
        {shot ? (
          <View style={{ width: 40 }} />
        ) : (
          <Pressable
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            style={styles.iconBtn}
            hitSlop={10}
          >
            <Ionicons name="camera-reverse-outline" size={21} color={luxe.primary} />
          </Pressable>
        )}
      </View>

      <View style={styles.stage}>
        <View style={[styles.frame, { aspectRatio: aw / ah }]}>
          {shot ? (
            <Image source={{ uri: shot.uri }} style={styles.fill} contentFit="cover" />
          ) : (
            <CameraView ref={camRef} style={styles.fill} facing={facing} mode="picture" />
          )}
          {/*
            Rehber tam çerçeve DEĞİL, dört köşe işareti: fotoğraf tam da bu
            orana kırpılıyor ama çizgi görüntünün önüne geçmiyor.
          */}
          <View pointerEvents="none" style={styles.corners}>
            <View style={[styles.corner, styles.cTL]} />
            <View style={[styles.corner, styles.cTR]} />
            <View style={[styles.corner, styles.cBR]} />
            <View style={[styles.corner, styles.cBL]} />
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        {shot ? (
          <View style={styles.row}>
            <DarkButton
              title="Yeniden"
              icon="refresh-outline"
              onPress={() => setShot(null)}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <DarkButton
              title="Kullan"
              icon="checkmark"
              solid
              busy={busy}
              onPress={usePhoto}
              style={{ flex: 1.4 }}
            />
          </View>
        ) : (
          <Pressable
            onPress={shoot}
            disabled={busy}
            style={({ pressed }) => [styles.shutter, (busy || pressed) && { opacity: 0.6 }]}
          >
            {/* İçi markanın geçişi — düz beyaz daire her uygulamada var. */}
            <LinearGradient
              colors={iridescent.soft}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.shutterInner}
            />
            {busy ? (
              <ActivityIndicator color={luxe.primary} style={StyleSheet.absoluteFill as never} />
            ) : null}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

/** Uygulamanın elle kesilmiş siluetli düğmesi. */
function DarkButton({
  title,
  icon,
  onPress,
  solid,
  busy,
  disabled,
  style,
}: {
  title: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  solid?: boolean;
  busy?: boolean;
  disabled?: boolean;
  style?: any;
}) {
  const fg = solid ? luxe.onPrimary : luxe.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.btn,
        (disabled || busy) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      <FinBlob
        variant="button"
        shadow={solid}
        pad={BTN_PAD}
        color={solid ? luxe.primary : glass.fill}
        stroke={solid ? undefined : luxe.outlineSoft}
      />
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const CORNER = 26;
const styles = StyleSheet.create({
  /*
    Zemin uygulamanın FİLDİŞİ sayfası; koyu olan yalnızca görüntü karesi.
    Tamamen siyah ekran temadan kopuyor ve gereğinden ağır duruyordu.
  */
  screen: { flex: 1, backgroundColor: luxe.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  permTitle: {
    fontFamily: font.headlineItalic,
    fontStyle: 'italic',
    fontSize: 20,
    color: luxe.primary,
    marginTop: 14,
  },
  link: {
    fontFamily: font.label,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: luxe.outline,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
  },
  stage: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  frame: {
    width: '100%',
    borderRadius: luxeRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  corners: { position: 'absolute', left: 14, right: 14, top: 14, bottom: 14 },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  cTL: { left: 0, top: 0, borderLeftWidth: 2, borderTopWidth: 2, borderTopLeftRadius: 6 },
  cTR: { right: 0, top: 0, borderRightWidth: 2, borderTopWidth: 2, borderTopRightRadius: 6 },
  cBR: { right: 0, bottom: 0, borderRightWidth: 2, borderBottomWidth: 2, borderBottomRightRadius: 6 },
  cBL: { left: 0, bottom: 0, borderLeftWidth: 2, borderBottomWidth: 2, borderBottomLeftRadius: 6 },
  controls: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 10,
    minHeight: 108,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: 10 },
  shutter: {
    alignSelf: 'center',
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2.5,
    borderColor: luxe.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29 },
  btn: {
    paddingVertical: 11 + BTN_PAD,
    paddingHorizontal: 12 + BTN_PAD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnText: {
    fontFamily: font.label,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
