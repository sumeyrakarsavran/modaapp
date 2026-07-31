import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { resizeForAnalysis, resizeForProcessing } from '@/services/imageResize';
import { classifyPhotoLabels } from '@/services/photoClassify';
import { photoFromParams, pickPhoto, type PickedPhoto } from '@/services/photoPicker';
import { useStore } from '@/store/useStore';
import { colors, radius, spacing, type } from '@/theme';
import {
  CATEGORIES,
  ITEM_COLORS,
  SEASONS,
  SOURCES,
  type Category,
  type Season,
  type Source,
} from '@/types';

export default function NewItem() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { id } = params;
  const { items, addItem, updateItem, api } = useStore();
  const editing = useMemo(() => items.find((i) => i.id === id), [items, id]);

  const [name, setName] = useState(editing?.name ?? '');
  const [category, setCategory] = useState<Category>(editing?.category ?? 'ust');
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

  /** Tespit sonuçlarını yalnızca dokunulmamış alanlara uygular. */
  const applyAutoTags = (auto: AutoTags): string[] => {
    const applied: string[] = [];
    if (auto.name && !touched.current.name && !name.trim()) {
      setName(auto.name);
      applied.push('isim');
    }
    if (auto.category && !touched.current.category) {
      setCategory(auto.category);
      const label = CATEGORIES.find((c) => c.id === auto.category)?.label;
      applied.push(label ? `kategori: ${label}` : 'kategori');
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
    setBgNote('🫧 Arka plan siliniyor…');
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
        (removed ? '✨ Arka plan silindi ve fotoğraf kaydedildi.' : 'Fotoğraf kaydedildi.') +
          ' 🔍 Özellikler tespit ediliyor…',
      );
      const small = await resizeForAnalysis(uri, 512);
      let applied: string[] = [];
      if (api.anthropicKey) {
        const auto = await classifyWithClaude(api.anthropicKey, small).catch(() => null);
        if (auto) applied = applyAutoTags(auto);
      }
      if (!applied.length) {
        const labels = await classifyPhotoLabels(small).catch(() => null);
        // Renk HIZ için küçük kopyadan okunur: PNG'yi saf JS'te (upng-js, zlib
        // dahil) çözüyoruz — 1200px'te 1.44M piksel, Hermes'te onlarca saniye
        // sürüyordu. 512px'te ~20 kat daha ucuz.
        // Emniyet: arka plan silindiyse şeffaf piksel BEKLENİR; küçük kopyada
        // hiç yoksa küçültme alfayı düşürmüş demektir, o zaman tam boy denenir.
        const colorId = await detectPhotoColor(small, removed ? uri : undefined).catch(() => null);
        const auto: AutoTags = labels ? tagsFromLabels(labels) : {};
        if (colorId) auto.colorId = colorId;
        applied = applyAutoTags(auto);
      }
      setBgNote(
        (removed ? '✨ Arka plan silindi ve fotoğraf kaydedildi.' : 'Fotoğraf kaydedildi.') +
          (applied.length
            ? ` Otomatik işaretlendi: ${applied.join(', ')} — istersen değiştir.`
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
    const photo = await pickPhoto({ fromCamera, aspect: [1, 1], quality: 0.7, purpose: 'garment' });
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
      Alert.alert('İsim gerekli', 'Parçaya bir isim ver (örn. "Siyah Deri Ceket").');
      return;
    }
    const data = {
      name: name.trim(),
      category,
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={type.title}>{editing ? 'Parçayı düzenle' : 'Yeni parça'}</Text>
        <Pressable onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.inkSoft} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Fotoğraf */}
        <View style={styles.photoRow}>
          <View style={styles.photoBox}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
            ) : (
              <GarmentArt category={category} colorId={colorId} size={90} />
            )}
          </View>
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Button small variant="secondary" title="📷 Fotoğraf çek" onPress={() => pickImage(true)} loading={processing} />
            <Button small variant="secondary" title="🖼️ Galeriden seç" onPress={() => pickImage(false)} loading={processing} />
            {imageUri ? (
              <Button
                small
                variant="ghost"
                title="Fotoğrafı kaldır"
                onPress={() => {
                  setImageUri(undefined);
                  setBgNote(null);
                }}
              />
            ) : (
              <Text style={type.tiny}>
                Fotoğraf çekince arka plan otomatik ve ücretsiz silinir; parça temiz bir görselle
                kaydedilir. Fotoğraf yoksa renkli silüet gösterilir.
              </Text>
            )}
            {bgNote ? (
              <Text style={[type.tiny, { color: colors.aquaDark, fontWeight: '700' }]}>
                {bgNote}
              </Text>
            ) : null}
          </View>
        </View>

        <Label>İsim</Label>
        <TextInput
          value={name}
          onChangeText={onNameChange}
          placeholder='Örn. "Turkuaz Saten Bluz"'
          placeholderTextColor={colors.inkFaint}
          style={styles.input}
        />
        <Text style={type.tiny}>
          İsimden kategori, renk, sezon ve tarz otomatik işaretlenir — istediğini değiştirebilirsin.
        </Text>

        <Label>Kategori</Label>
        <View style={styles.wrapRow}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              emoji={c.emoji}
              active={category === c.id}
              onPress={() => {
                touched.current.category = true;
                setCategory(c.id);
              }}
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
                  size={16}
                  color={['beyaz', 'sari', 'bej'].includes(c.id) ? '#333' : '#fff'}
                />
              ) : null}
            </Pressable>
          ))}
        </View>
        <Text style={type.tiny}>{ITEM_COLORS.find((c) => c.id === colorId)?.label}</Text>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Label>Marka</Label>
            <TextInput
              value={brand}
              onChangeText={setBrand}
              placeholder="Opsiyonel"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Label>Fiyat (₺)</Label>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="Opsiyonel"
              placeholderTextColor={colors.inkFaint}
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
              color={s.color}
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
              emoji={s.emoji}
              active={seasons.includes(s.id)}
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
          placeholderTextColor={colors.inkFaint}
          style={styles.input}
        />

        <Label>Not</Label>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Opsiyonel"
          placeholderTextColor={colors.inkFaint}
          style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
          multiline
        />

        <Button
          title={editing ? 'Kaydet' : '🐟 Gardıroba ekle'}
          onPress={save}
          style={{ marginTop: spacing.xl }}
        />
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
    paddingVertical: spacing.md,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  container: { padding: spacing.lg, paddingBottom: 60 },
  photoRow: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  photoBox: {
    width: 130,
    height: 130,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  swatchActive: { borderWidth: 2.5, borderColor: colors.aquaDark },
});
