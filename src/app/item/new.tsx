import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmModal } from '@/components/ConfirmModal';
import { Backdrop } from '@/components/Backdrop';

import { LinearGradient } from 'expo-linear-gradient';

import { BTN_PAD, FinBlob } from '@/components/FinBlob';
import { GarmentArt } from '@/components/GarmentArt';
import { Button, Chip, Label } from '@/components/UI';
import {
  classifyWithClaude,
  rulesFromName,
  tagsFromLabels,
  type AutoTags,
} from '@/services/autotag';
import { processGarmentPhoto } from '@/services/bgremove';
import { detectPhotoColor } from '@/services/colorDetect';
import {
  acquireClassifier,
  classifyGarment,
  releaseClassifier,
} from '@/services/garmentClassifier';
import { resizeForAnalysis, resizeForProcessing } from '@/services/imageResize';
import { classifyPhotoLabels } from '@/services/photoClassify';
import { photoFromParams, pickPhoto, type PickedPhoto } from '@/services/photoPicker';
import { useStore } from '@/store/useStore';
import { radius, spacing } from '@/theme';
import { font, glass, iridescent, luxe, luxeRadius, luxeType } from '@/theme/luxe';
import {
  CATEGORIES,
  ITEM_COLORS,
  SEASONS,
  SOURCES,
  subcategoriesOf,
  subcategoryById,
  type Category,
  type Season,
  type Source,
} from '@/types';

/** Sezon hapları için ince çizgi ikonlar — emoji yerine. */
const SEASON_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  ilkbahar: 'flower-outline',
  yaz: 'sunny-outline',
  sonbahar: 'leaf-outline',
  kis: 'snow-outline',
};

export default function NewItem() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { id } = params;
  const { items, addItem, updateItem, api } = useStore();
  const editing = useMemo(() => items.find((i) => i.id === id), [items, id]);

  const [name, setName] = useState(editing?.name ?? '');
  /** Uygulamanın kendi uyarı kutusu (sistem `Alert`'i yerine). */
  const [notice, setNotice] = useState<{ title: string; message?: string } | null>(null);
  const [category, setCategory] = useState<Category>(editing?.category ?? 'ust');
  const [subcategory, setSubcategory] = useState<string | undefined>(editing?.subcategory);
  const [colorId, setColorId] = useState(editing?.colorId ?? 'siyah');
  const [brand, setBrand] = useState(editing?.brand ?? '');
  const [price, setPrice] = useState(editing?.price != null ? String(editing.price) : '');
  const [source, setSource] = useState<Source>(editing?.source ?? 'yeni');
  const [seasons, setSeasons] = useState<Season[]>(editing?.seasons ?? []);
  const [tags, setTags] = useState(editing?.tags.join(', ') ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [imageUri, setImageUri] = useState<string | undefined>(editing?.imageUri);
  const [processing, setProcessing] = useState(false);
  const [bgNote, setBgNote] = useState<string | null>(null);

  // Kullanıcının elle seçtiği alanların üzerine otomatik tespit yazmasın
  const touched = useRef({
    category: !!editing,
    color: !!editing,
    seasons: !!editing,
    tags: !!editing,
    name: !!editing,
  });

  /**
   * Kıyafet sınıflandırma modelini bu ekran açıkken hazır tut, kapanınca bırak.
   * ONNX oturumu 30-80MB tutuyor; sürekli açık bırakmak bu cihazda (boş RAM
   * ~144MB) sistemin süreci öldürme riskini artırıyordu. Ekran açılırken
   * kurulduğu için kullanıcı fotoğrafı seçtiğinde model çoktan hazır oluyor.
   */
  useEffect(() => {
    acquireClassifier();
    return releaseClassifier;
  }, []);

  /** Kategori elle değişirse, o kategoriye ait olmayan alt türü düşür. */
  const chooseCategory = (c: Category) => {
    touched.current.category = true;
    setCategory(c);
    setSubcategory((prev) => (subcategoryById(prev)?.category === c ? prev : undefined));
  };

  /** Tespit sonuçlarını yalnızca dokunulmamış alanlara uygular. */
  const applyAutoTags = (auto: AutoTags): string[] => {
    const applied: string[] = [];
    if (auto.name && !touched.current.name && !name.trim()) {
      setName(auto.name);
      applied.push('isim');
    }
    if (auto.category && !touched.current.category) {
      setCategory(auto.category);
      // Alt tür kategoriyle birlikte gelir; ayrı "dokunuldu" bayrağı yok çünkü
      // kategoriye dokunulunca chooseCategory zaten uyumsuz alt türü düşürüyor.
      const sub = subcategoryById(auto.subcategory);
      if (sub && sub.category === auto.category) {
        setSubcategory(sub.id);
        applied.push(`tür: ${sub.label}`);
      } else {
        const label = CATEGORIES.find((c) => c.id === auto.category)?.label;
        applied.push(label ? `kategori: ${label}` : 'kategori');
      }
    }
    if (auto.colorId && !touched.current.color) {
      setColorId(auto.colorId);
      const label = ITEM_COLORS.find((c) => c.id === auto.colorId)?.label;
      applied.push(label ? `renk: ${label}` : 'renk');
    }
    if (auto.seasons?.length && !touched.current.seasons) {
      setSeasons(auto.seasons);
      applied.push('sezon');
    }
    if (auto.tags?.length && !touched.current.tags && !tags.trim()) {
      setTags(auto.tags.join(', '));
      applied.push('tarz');
    }
    return applied;
  };

  /** İsim yazarken kural tabanlı anında tespit (ücretsiz). */
  const onNameChange = (text: string) => {
    setName(text);
    touched.current.name = true;
    applyAutoTags(rulesFromName(text));
  };

  /** Çekilen/seçilen fotoğrafı işler: küçült → arka plan sil → kaydet → otomatik etiketle. */
  const handlePickedPhoto = async (photo: PickedPhoto) => {
    setProcessing(true);
    setBgNote('Arka plan siliniyor…');
    try {
      // 1) ÖNCE küçült — ham 12MP fotoğrafı ağır adımlara sokmak belleği taşırıp
      //    uygulamayı çökertiyordu. Küçük kopya ile çalış.
      const working = await resizeForProcessing(photo.uri, photo.width, photo.height, 1200);

      // 2) Arka plan silme + kalıcı kayıt
      const { uri, removed } = await processGarmentPhoto(working, api.removeBgKey);
      setImageUri(uri);

      // 3) Otomatik tespit — ağır adımları SIRAYLA ve KÜÇÜK kopya üzerinde çalıştır.
      //    (Tam boy PNG'yi JS'te piksel piksel çözmek bellek zirvesi yapıp
      //     uygulamayı öldürüyordu.)
      setBgNote(
        (removed ? 'Arka plan silindi ve fotoğraf kaydedildi.' : 'Fotoğraf kaydedildi.') +
          ' Özellikler tespit ediliyor…',
      );
      const small = await resizeForAnalysis(uri, 512);

      // Cihaz içi kıyafet sınıflandırma (MobileNetV3, 20 sınıf) — ücretsiz,
      // çevrimdışı, birkaç ms. YALNIZCA arka plan gerçekten silindiyse çalıştır:
      // model beyaz zemine ortalanmış tek parça görmek üzere eğitildi, ham
      // fotoğrafta isabet %78'den %30'lara düşüyor (MODEL.md'de ölçülmüş).
      const predicted = removed ? await classifyGarment(uri).catch(() => null) : null;

      // ML Kit yalnızca tarz/sezon etiketleri için: kategori işini artık kıyafet
      // modeli yapıyor ve o çok daha isabetli.
      const labels = await classifyPhotoLabels(small).catch(() => null);
      // Renk HIZ için küçük kopyadan okunur: PNG'yi saf JS'te (upng-js, zlib
      // dahil) çözüyoruz — 1200px'te 1.44M piksel, Hermes'te onlarca saniye
      // sürüyordu. 512px'te ~20 kat daha ucuz.
      // Emniyet: arka plan silindiyse şeffaf piksel BEKLENİR; küçük kopyada
      // hiç yoksa küçültme alfayı düşürmüş demektir, o zaman tam boy denenir.
      const colorId = await detectPhotoColor(small, removed ? uri : undefined).catch(() => null);

      const auto: AutoTags = labels ? tagsFromLabels(labels) : {};
      if (colorId) auto.colorId = colorId;

      // Claude anahtarı varsa isim gibi alanları o doldursun (opsiyonel).
      if (api.anthropicKey) {
        const fromClaude = await classifyWithClaude(api.anthropicKey, small).catch(() => null);
        if (fromClaude) Object.assign(auto, fromClaude);
      }

      // Kategori/alt tür konusunda EN İSABETLİ kaynak kıyafet modeli — bu yüzden
      // en son o yazar ve diğerlerinin tahminini ezer.
      const sub = subcategoryById(predicted?.subcategoryId);
      if (sub) {
        auto.subcategory = sub.id;
        auto.category = sub.category;
      }

      const applied = applyAutoTags(auto);
      const confidence =
        predicted && sub ? ` (%${Math.round(predicted.confidence * 100)} eminlik)` : '';
      setBgNote(
        (removed ? 'Arka plan silindi ve fotoğraf kaydedildi.' : 'Fotoğraf kaydedildi.') +
          (applied.length
            ? ` Otomatik işaretlendi: ${applied.join(', ')}${confidence} — istersen değiştir.`
            : '') +
          (!removed
            ? ' Arka plan silinemediği için tür tespiti atlandı, elle seçebilirsin.'
            : ''),
      );
    } catch {
      // Bir adım hata verirse en azından ham fotoğrafı göster, akışı kilitleme
      setImageUri((prev) => prev ?? photo.uri);
      setBgNote('Fotoğraf eklendi (işleme sırasında bir sorun oldu). Bilgileri elle seçebilirsin.');
    } finally {
      setProcessing(false);
    }
  };

  const pickImage = async (fromCamera: boolean) => {
    // Kırpma açık: kullanıcı kadrajı kendisi seçer (kare).
    /*
      Kadraj 3:4 — gardıroptaki kartın görsel alanı da 3:4. Kare çekimde
      elbise/palto gibi uzun parçalar kartın içinde küçücük kalıyordu.
    */
    const photo = await pickPhoto({ fromCamera, aspect: [3, 4], quality: 0.7, purpose: 'garment' });
    if (photo) await handlePickedPhoto(photo);
  };

  // Android'de kamera/kırpma sırasında sistem uygulamayı öldürdüyse, kök layout
  // fotoğrafı kurtarıp bu ekrana parametreyle yollar — burada devralıyoruz.
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (recoveredRef.current) return;
    const photo = photoFromParams(params);
    if (!photo) return;
    recoveredRef.current = true;
    handlePickedPhoto(photo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const save = () => {
    if (!name.trim()) {
      setNotice({ title: 'İsim gerekli', message: 'Parçaya bir isim ver (örn. "Siyah Deri Ceket").' });
      return;
    }
    const data = {
      name: name.trim(),
      category,
      subcategory,
      colorId,
      brand: brand.trim() || undefined,
      price: price.trim() ? Number(price.replace(',', '.')) || undefined : undefined,
      source,
      seasons,
      tags: tags
        .split(',')
        .map((t) => t.trim().toLocaleLowerCase('tr'))
        .filter(Boolean),
      notes: notes.trim() || undefined,
      imageUri,
    };
    if (editing) {
      updateItem(editing.id, data);
    } else {
      addItem({ ...data, favorite: false, archived: false });
    }
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top', 'bottom']}>
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
        <Text style={luxeType.display}>{editing ? 'Parçayı düzenle' : 'Yeni parça'}</Text>
        <Pressable onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={20} color={luxe.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* ————— Fotoğraf ————— */}
        <View style={styles.section}>
          <View style={styles.photoRow}>
            <View style={styles.photoBox}>
              {/*
                Işıltı: parçanın arkasından geçen çok soluk iridesan hâle.
                Bugün'deki kartların köşegen ışığıyla aynı fikir — yüzey düz
                kalmasın, parça bir ışığın önünde dursun.
              */}
              <LinearGradient
                colors={iridescent.soft}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={styles.photoGlow}
                pointerEvents="none"
              />
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              ) : (
                <GarmentArt category={category} colorId={colorId} size={74} />
              )}
            </View>

            <View style={{ flex: 1, gap: 8 }}>
              <PillBtn icon="camera-outline" title="Fotoğraf çek" onPress={() => pickImage(true)} busy={processing} />
              <PillBtn icon="images-outline" title="Galeriden seç" variant="outline" onPress={() => pickImage(false)} busy={processing} />
              {imageUri ? (
                <PillBtn
                  icon="trash-outline"
                  title="Kaldır"
                  variant="outline"
                  onPress={() => {
                    setImageUri(undefined);
                    setBgNote(null);
                  }}
                />
              ) : null}
            </View>
          </View>

          {imageUri ? null : (
            <Text style={styles.hint}>
              Fotoğraf çekince arka plan otomatik ve ücretsiz siliniyor; parça temiz bir görselle
              kaydediliyor. Fotoğraf yoksa renkli silüet gösteriliyor.
            </Text>
          )}
          {bgNote ? <Text style={styles.note}>{bgNote}</Text> : null}
        </View>

        {/* ————— Kimlik ————— */}
        <View style={styles.section}>
          <Label>İsim</Label>
          <TextInput
            value={name}
            onChangeText={onNameChange}
            placeholder='Örn. "Turkuaz Saten Bluz"'
            placeholderTextColor={luxe.outline}
            style={styles.input}
          />
          <Text style={styles.hint}>
            İsimden kategori, renk, sezon ve tarz otomatik işaretleniyor — istediğini
            değiştirebilirsin.
          </Text>

          <Label>Kategori</Label>
          <View style={styles.wrapRow}>
            {/*
              Emoji YOK: kategori hapında o kategorinin kendi silüeti duruyor.
              Sayfanın geri kalanı ince çizgi dilinde, emoji oraya yabancıydı —
              üstelik silüet gardırop uygulamasında emojiden daha doğrudan.
            */}
            {CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                label={c.label}
                active={category === c.id}
                onPress={() => chooseCategory(c.id)}
                left={<GarmentArt category={c.id} colorId={colorId} size={15} />}
              />
            ))}
          </View>

          {/* Alt tür — seçili kategoriye ait olanlar. Fotoğraftan otomatik gelir,
              "Belirtme" ile boş bırakılabilir. */}
          <Label>Tür</Label>
          <View style={styles.wrapRow}>
            <Chip label="Belirtme" active={!subcategory} onPress={() => setSubcategory(undefined)} />
            {subcategoriesOf(category).map((s) => (
              <Chip
                key={s.id}
                label={s.label}
                active={subcategory === s.id}
                onPress={() => setSubcategory(s.id)}
              />
            ))}
          </View>

          <Label>Renk</Label>
          <View style={styles.wrapRow}>
            {ITEM_COLORS.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  touched.current.color = true;
                  setColorId(c.id);
                }}
                style={[
                  styles.swatch,
                  { backgroundColor: c.hex },
                  colorId === c.id && styles.swatchActive,
                ]}
              >
                {colorId === c.id ? (
                  <Ionicons
                    name="checkmark"
                    size={15}
                    color={['beyaz', 'sari', 'bej'].includes(c.id) ? '#333' : '#fff'}
                  />
                ) : null}
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>{ITEM_COLORS.find((c) => c.id === colorId)?.label}</Text>
        </View>

        {/* ————— Ayrıntılar ————— */}
        {/* Son bölümde alt çizgi yok: hemen altında kaydet düğmesi var */}
        <View style={[styles.section, styles.sectionLast]}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Label>Marka</Label>
              <TextInput
                value={brand}
                onChangeText={setBrand}
                placeholder="Opsiyonel"
                placeholderTextColor={luxe.outline}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Label>Fiyat (₺)</Label>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="Opsiyonel"
                placeholderTextColor={luxe.outline}
                style={styles.input}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Label>Nereden geldi?</Label>
          <View style={styles.wrapRow}>
            {SOURCES.map((s) => (
              <Chip
                key={s.id}
                label={s.label}
                active={source === s.id}
                onPress={() => setSource(s.id)}
              />
            ))}
          </View>

          <Label>Sezonlar</Label>
          <View style={styles.wrapRow}>
            {SEASONS.map((s) => (
              <Chip
                key={s.id}
                label={s.label}
                active={seasons.includes(s.id)}
                left={
                  <Ionicons
                    name={SEASON_ICON[s.id]}
                    size={13}
                    color={seasons.includes(s.id) ? luxe.primaryDeep : luxe.outline}
                  />
                }
                onPress={() => {
                  touched.current.seasons = true;
                  setSeasons((prev) =>
                    prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                  );
                }}
              />
            ))}
          </View>

          <Label>Etiketler</Label>
          <TextInput
            value={tags}
            onChangeText={(t) => {
              touched.current.tags = true;
              setTags(t);
            }}
            placeholder="virgülle ayır: ofis, gece, rahat…"
            placeholderTextColor={luxe.outline}
            style={styles.input}
          />

          <Label>Not</Label>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Opsiyonel"
            placeholderTextColor={luxe.outline}
            style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
            multiline
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, { marginTop: 4 }, pressed && { opacity: 0.85 }]}
          onPress={save}
        >
          <FinBlob shadow pad={BTN_PAD} variant="button" color={luxe.primary} />
          <Text style={styles.saveText}>{editing ? 'Kaydet' : 'Gardıroba ekle'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Hap düğme — diğer ekranlardaki editoryal düğmenin aynısı. */
function PillBtn({
  title,
  icon,
  onPress,
  variant = 'solid',
  busy,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  variant?: 'solid' | 'outline';
  busy?: boolean;
}) {
  const solid = variant === 'solid';
  const fg = solid ? luxe.onPrimary : luxe.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.pill,
        (pressed || busy) && { opacity: 0.8 },
      ]}
    >
      {/* Zemin elle kesilmiş siluet — düz köşe yarıçapı değil (bkz. FinBlob). */}
      <FinBlob
        variant="button"
        shadow={solid}
        pad={BTN_PAD}
        color={solid ? luxe.primary : glass.fill}
        stroke={solid ? undefined : luxe.outlineSoft}
      />
      <Ionicons name={icon} size={14} color={fg} />
      <Text style={[styles.pillText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
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
  container: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 2 },
  /*
    KART YOK. Bölümler ince bir çizgiyle ayrılıyor — kartlar sayfayı hem
    büyütüyor hem ağırlaştırıyordu; form zaten uzun.
  */
  section: { paddingBottom: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: luxe.outlineSoft },
  sectionLast: { borderBottomWidth: 0, paddingBottom: 6 },


  photoRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  photoBox: {
    width: 108,
    height: 108,
    borderRadius: luxeRadius.md,
    backgroundColor: luxe.surface,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Kıyafet kenarlara yapışmasın (bkz. item/[id] photo)
    padding: 10,
  },
  /** Parçanın arkasındaki soluk iridesan hâle. */
  photoGlow: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.55 },

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
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },

  input: {
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.md,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontFamily: font.body,
    fontSize: 14.5,
    color: luxe.ink,
    backgroundColor: luxe.surface,
  },
  hint: { ...luxeType.caption, fontStyle: 'italic', marginTop: 6 },
  note: { fontFamily: font.bodyMedium, fontSize: 12.5, color: luxe.primaryDeep, marginTop: 8 },

  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  swatchActive: { borderWidth: 2.5, borderColor: luxe.primaryDeep },

  saveBtn: {
    paddingVertical: 14 + BTN_PAD,
    alignItems: 'center',
  },
  saveText: {
    fontFamily: font.label,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: luxe.onPrimary,
  },
});
