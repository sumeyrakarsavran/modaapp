import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { GarmentArt } from '@/components/GarmentArt';
import { OutfitCollage } from '@/components/OutfitCollage';
import { ShareModal } from '@/components/ShareModal';
import { resizeForProcessing } from '@/services/imageResize';
import { photoFromParams, pickPhoto, type PickedPhoto } from '@/services/photoPicker';
import { persistGarmentPhoto } from '@/services/photoStore';
import { useStore } from '@/store/useStore';
import { font, glass, iridescent, luxe, luxeRadius, luxeShadow, luxeType } from '@/theme/luxe';
import {
  CATEGORIES,
  ITEM_COLORS,
  subcategoriesOf,
  todayISO,
  type Category,
  type Selfie,
  type WardrobeItem,
} from '@/types';

type Section = 'parcalar' | 'kombinler' | 'selfiler' | 'lookbooklar';

const LOOKBOOK_EMOJIS = ['📖', '🌊', '🌙', '🔥', '🌸', '⚡', '🎨', '☁️', '✨', '🐟'];

/** Askıdaki kartın ölçüsü; raf yüksekliği buna göre hesaplanıyor. */
const CARD_W = 98;
const CARD_IMG_H = Math.round((CARD_W * 4) / 3);
/** Askı kancasının yüksekliği — boru bu hizada geçiyor. */
const HOOK_H = 22;

const colorLabel = (id: string) => ITEM_COLORS.find((c) => c.id === id)?.label ?? '';

/**
 * Fotoğraf + yer tutucu.
 * Kayıtlı dosya silinmişse `Image` HİÇBİR ŞEY çizmiyor ve ekranda bomboş bir
 * delik kalıyordu (cihazda görüldü: 5 selfie'nin 4'ü boş). Arkaya nötr bir
 * kutu ve ikon konuyor; görsel yüklenirse onun üstünü kapatıyor.
 */
function Photo({
  uri,
  style,
  icon = 'image-outline',
}: {
  uri: string;
  style: any;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={[style, styles.photoWrap]}>
      <Ionicons name={icon} size={22} color={luxe.outlineSoft} />
      <Image
        source={{ uri }}
        style={[style, { position: 'absolute', left: 0, top: 0 }]}
        contentFit="cover"
      />
    </View>
  );
}

/** "2026-08-04" → "4 Ağustos". Ham ISO tarih arayüzde ham duruyordu. */
const prettyDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

/**
 * Askıdaki tek parça.
 *
 * Örnekteki `hanger:hover` davranışının dokunmatik karşılığı: basılınca askı
 * hafifçe aşağı süzülüp yana yatıyor, bırakınca yaylanarak yerine dönüyor.
 * RN'in kendi `Animated`'ı kullanılıyor — Reanimated'ın babel eklentisi bu
 * projede kurulu değil, `withSpring` sessizce çalışmazdı.
 */
function Hanger({ item, onPress }: { item: WardrobeItem; onPress: () => void }) {
  const swing = useRef(new Animated.Value(0)).current;
  const to = (v: number) =>
    Animated.spring(swing, {
      toValue: v,
      useNativeDriver: true,
      friction: 5,
      tension: 90,
    }).start();

  return (
    <Animated.View
      style={{
        transform: [
          { translateY: swing.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
          { rotate: swing.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '2.5deg'] }) },
        ],
      }}
    >
      <Pressable onPressIn={() => to(1)} onPressOut={() => to(0)} onPress={onPress}>
        {/* Kanca: alt kenarı olmayan yarım halka, boruya asılıyormuş gibi */}
        <View style={styles.hook} />
        <View style={styles.card}>
          <View style={styles.cardImg}>
            {item.imageUri ? (
              /*
                Gerçek kıyafet fotoğrafları HER ZAMAN `contain`: arka planı
                silinmiş uzun/dar parçaları (elbise, palto) `cover` kırpıyor.
              */
              <Image
                source={{ uri: item.imageUri }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            ) : (
              <GarmentArt
                category={item.category}
                subcategory={item.subcategory}
                colorId={item.colorId}
                size={CARD_W * 0.62}
              />
            )}
            {item.favorite ? (
              <View style={styles.favDot}>
                <Ionicons name="heart" size={10} color={luxe.ink} />
              </View>
            ) : null}
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.cardColor} numberOfLines={1}>
              {colorLabel(item.colorId)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Bölüm başlığı: sol serif ad, sağ küçük harf aralıklı sayaç. */
function SectionHead({ title, count, unit }: { title: string; count: number; unit: string }) {
  return (
    <View style={[styles.rackHead, { marginBottom: 10 }]}>
      <Text style={styles.rackTitle}>{title}</Text>
      <Text style={styles.rackCount}>
        {count} {unit}
      </Text>
    </View>
  );
}

/** Bir kategorinin askılığı: başlık + parça sayısı + boru + yatay raf. */
function Rack({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: WardrobeItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={styles.rackHead}>
        <Text style={styles.rackTitle}>{title}</Text>
        <Text style={styles.rackCount}>{items.length} PARÇA</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rack}
      >
        {/* Metal boru — kancaların arkasından geçiyor */}
        <LinearGradient
          colors={[luxe.outlineSoft, luxe.surfaceHigh, luxe.outlineSoft]}
          style={styles.rail}
          pointerEvents="none"
        />
        {items.map((it) => (
          <Hanger key={it.id} item={it} onPress={() => onOpen(it.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

/** Hap biçimli filtre; seçiliyken iridesan geçiş. */
function PillChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, pressed && { opacity: 0.8 }]}>
      {active ? (
        <LinearGradient
          colors={iridescent.soft}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pillFill}
          pointerEvents="none"
        />
      ) : null}
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** Boş durum — emoji yerine ince çizgi ikon. */
function Empty({
  icon,
  title,
  message,
  action,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={30} color={luxe.outlineSoft} />
      <Text style={[luxeType.headlineItalic, { marginTop: 12 }]}>{title}</Text>
      <Text style={[luxeType.body, { textAlign: 'center', marginTop: 8 }]}>{message}</Text>
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

/** Editoryal düğme — Bugün sayfasındakiyle aynı dil. */
function LuxeButton({
  title,
  onPress,
  icon,
  variant = 'solid',
  disabled,
  style,
}: {
  title?: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  variant?: 'solid' | 'outline' | 'danger';
  disabled?: boolean;
  style?: any;
}) {
  const solid = variant === 'solid';
  const fg = solid ? luxe.onPrimary : variant === 'danger' ? luxe.danger : luxe.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        solid
          ? { backgroundColor: luxe.primary }
          : {
              backgroundColor: glass.fill,
              borderWidth: 1,
              borderColor: variant === 'danger' ? luxe.danger : luxe.outlineSoft,
            },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.82 },
        style,
      ]}
    >
      <View style={styles.btnRow}>
        {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
        {title ? <Text style={[styles.btnText, { color: fg }]}>{title}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function Wardrobe() {
  const {
    items, outfits, selfies, lookbooks,
    addSelfie, deleteSelfie, addLookbook, sharePost,
  } = useStore();
  const { width } = useWindowDimensions();
  // Modallar alt sistem çubuğunun altında kalmasın
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [section, setSection] = useState<Section>('parcalar');

  // Parçalar filtreleri
  const [category, setCategory] = useState<Category | 'hepsi'>('hepsi');
  /** Alt tür filtresi — çoklu seçim, boşsa o kategorinin hepsi gösterilir. */
  const [subcats, setSubcats] = useState<string[]>([]);
  /** Alt tür listesi açık mı — kapalıyken tek satır, ekran kalabalıklaşmıyor. */
  const [subOpen, setSubOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Selfie görüntüleme + paylaşım
  const [openSelfie, setOpenSelfie] = useState<Selfie | null>(null);
  const [shareSelfieOpen, setShareSelfieOpen] = useState<Selfie | null>(null);

  // Lookbook oluşturma
  const [lbModal, setLbModal] = useState(false);
  const [lbName, setLbName] = useState('');
  const [lbEmoji, setLbEmoji] = useState('📖');

  const cols = width > 700 ? 5 : 3;
  const thumb = (Math.min(width, 700) - 20 * 2 - 8 * (cols - 1)) / cols;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    return items.filter((i) => {
      if (i.archived !== showArchived) return false;
      if (category !== 'hepsi' && i.category !== category) return false;
      if (subcats.length && (!i.subcategory || !subcats.includes(i.subcategory))) return false;
      if (onlyFav && !i.favorite) return false;
      if (q) {
        const hay = `${i.name} ${i.brand ?? ''} ${i.tags.join(' ')}`.toLocaleLowerCase('tr');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, category, subcats, query, onlyFav, showArchived]);

  /** Askılıklar kategoriye göre gruplanır — örnekteki "Üst Giyim / Alt Giyim" bölümleri. */
  const racks = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        id: c.id,
        label: c.label,
        items: filtered.filter((i) => i.category === c.id),
      })).filter((r) => r.items.length > 0),
    [filtered],
  );

  /** Selfie ekle — kırpma açık (dikey kadraj), kalıcı kopya saklanır. */
  const saveSelfiePhoto = async (photo: PickedPhoto) => {
    const small = await resizeForProcessing(photo.uri, photo.width, photo.height, 1400);
    const saved = await persistGarmentPhoto(small).catch(() => small);
    addSelfie({ imageUri: saved, date: todayISO() });
  };

  const takeSelfie = async (fromCamera: boolean) => {
    const photo = await pickPhoto({ fromCamera, aspect: [3, 4], quality: 0.6, purpose: 'selfie' });
    if (photo) await saveSelfiePhoto(photo);
  };

  // Android'de süreç öldüyse kök layout selfie'yi parametreyle buraya yollar
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (recoveredRef.current) return;
    const photo = photoFromParams(params);
    if (!photo) return;
    recoveredRef.current = true;
    setSection('selfiler');
    saveSelfiePhoto(photo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const confirmDeleteSelfie = (s: Selfie) => {
    const doDelete = () => {
      deleteSelfie(s.id);
      setOpenSelfie(null);
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Selfie silinsin mi?')) doDelete();
    } else {
      Alert.alert('Selfie sil', 'Bu selfie silinsin mi?', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const doShareSelfie = (caption: string) => {
    const s = shareSelfieOpen;
    if (!s) return;
    sharePost({
      kind: 'selfie',
      caption,
      garments: [],
      imageUri: s.imageUri,
      archetypeId: useStore.getState().profile.bettaArchetypeId,
    });
    setShareSelfieOpen(null);
    setOpenSelfie(null);
    // Modal kapanışı işlensin, sonra git (ekran donmadan önce)
    setTimeout(() => router.push('/(tabs)/community'), 120);
  };

  const createLookbook = () => {
    if (!lbName.trim()) return;
    const lb = addLookbook({ name: lbName.trim(), emoji: lbEmoji, outfitIds: [] });
    setLbModal(false);
    setLbName('');
    // Modal kapanışı işlensin, sonra git (ekran donmadan önce)
    setTimeout(() => router.push({ pathname: '/lookbook/[id]', params: { id: lb.id } }), 80);
  };

  const counts = {
    parcalar: items.filter((i) => !i.archived).length,
    kombinler: outfits.length,
    selfiler: selfies.length,
    lookbooklar: lookbooks.length,
  };

  /*
    Bölümler HAP DEĞİL yatay sekme: sayfada zaten arama, favori, arşiv,
    kategori ve alt tür var; dört hap daha eklenince ekran düğme tarlasına
    dönüyordu. Sekme çizgisi aynı bilgiyi taşıyor, ağırlığı taşımıyor.
  */
  const SectionTab = ({ id, label }: { id: Section; label: string }) => {
    const on = section === id;
    return (
      <Pressable onPress={() => setSection(id)} style={styles.tab}>
        <Text style={[styles.tabText, on && styles.tabTextActive]}>
          {label} <Text style={styles.tabCount}>{counts[id]}</Text>
        </Text>
        {on ? (
          <LinearGradient
            colors={iridescent.full}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.tabUnderline}
          />
        ) : null}
      </Pressable>
    );
  };

  const openItem = (id: string) => router.push({ pathname: '/item/[id]', params: { id } });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      {/* Bugün ile AYNI zemin — ekranlar arası geçişte ton atlamasın. */}
      <Backdrop />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={luxeType.display}>Gardırop</Text>
        </View>
        {section === 'parcalar' ? (
          <LuxeButton icon="add" title="Ekle" onPress={() => router.push('/item/new')} />
        ) : section === 'kombinler' ? (
          <LuxeButton icon="add" title="Kombin" onPress={() => router.push('/(tabs)/studio')} />
        ) : section === 'selfiler' ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <LuxeButton icon="camera-outline" onPress={() => takeSelfie(true)} />
            <LuxeButton icon="images-outline" variant="outline" onPress={() => takeSelfie(false)} />
          </View>
        ) : (
          <LuxeButton icon="add" title="Lookbook" onPress={() => setLbModal(true)} />
        )}
      </View>

      {/* Bölüm sekmeleri — sabit yükseklik: liste büyüyünce ezilmesin */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sectionTabsBar}
        contentContainerStyle={{ gap: 20, paddingHorizontal: 20, alignItems: 'flex-end' }}
      >
        <SectionTab id="parcalar" label="Parçalar" />
        <SectionTab id="kombinler" label="Kombinler" />
        <SectionTab id="selfiler" label="Selfie'ler" />
        <SectionTab id="lookbooklar" label="Lookbook'lar" />
      </ScrollView>

      {/* ————— PARÇALAR ————— */}
      {section === 'parcalar' ? (
        <>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={luxe.outline} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Ara: isim, marka, etiket…"
                placeholderTextColor={luxe.outline}
                style={styles.searchInput}
              />
            </View>
            <Pressable onPress={() => setOnlyFav((v) => !v)} style={styles.iconBtn}>
              <Ionicons
                name={onlyFav ? 'heart' : 'heart-outline'}
                size={19}
                color={onlyFav ? luxe.primary : luxe.outline}
              />
            </Pressable>
            <Pressable onPress={() => setShowArchived((v) => !v)} style={styles.iconBtn}>
              <Ionicons
                name={showArchived ? 'archive' : 'archive-outline'}
                size={18}
                color={showArchived ? luxe.primary : luxe.outline}
              />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipBar}
            contentContainerStyle={styles.chipRow}
          >
            <PillChip
              label="Hepsi"
              active={category === 'hepsi'}
              onPress={() => {
                setCategory('hepsi');
                setSubcats([]);
                setSubOpen(false);
              }}
            />
            {CATEGORIES.map((c) => (
              <PillChip
                key={c.id}
                label={c.label}
                active={category === c.id}
                onPress={() => {
                  setCategory(c.id);
                  // Kategori değişince eski alt tür seçimi anlamsız kalır
                  setSubcats([]);
                  setSubOpen(false);
                }}
              />
            ))}
          </ScrollView>

          {/*
            Alt tür filtresi — ÇOKLU SEÇİM, açılır onay kutulu liste.
            Önce yan yana kayan etiketlerdi: ekranda arama + kategori + alt tür
            üst üste üç şerit oluşturup sayfayı boğuyordu. Kapalıyken tek satır.
          */}
          {category !== 'hepsi' && subcategoriesOf(category).length > 0 ? (
            <View style={styles.subWrap}>
              <Pressable onPress={() => setSubOpen((v) => !v)} style={styles.subHead}>
                <Text style={styles.subHeadText}>
                  Alt tür{subcats.length ? ` · ${subcats.length}` : ''}
                </Text>
                <Ionicons
                  name={subOpen ? 'chevron-up' : 'chevron-down'}
                  size={15}
                  color={luxe.outline}
                />
              </Pressable>
              {subOpen ? (
                <View style={styles.subList}>
                  {subcategoriesOf(category).map((sc) => {
                    const on = subcats.includes(sc.id);
                    return (
                      <Pressable
                        key={sc.id}
                        onPress={() =>
                          setSubcats((prev) =>
                            prev.includes(sc.id)
                              ? prev.filter((x) => x !== sc.id)
                              : [...prev, sc.id],
                          )
                        }
                        style={styles.subRow}
                      >
                        <Ionicons
                          name={on ? 'checkbox' : 'square-outline'}
                          size={17}
                          color={on ? luxe.primary : luxe.outline}
                        />
                        <Text style={[styles.subLabel, on && { color: luxe.ink }]}>{sc.label}</Text>
                      </Pressable>
                    );
                  })}
                  {subcats.length ? (
                    <Pressable onPress={() => setSubcats([])} style={styles.subClear}>
                      <Text style={styles.subClearText}>Seçimi temizle</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {filtered.length === 0 ? (
            <Empty
              icon={showArchived ? 'archive-outline' : 'shirt-outline'}
              title={showArchived ? 'Arşiv boş' : 'Burada henüz bir şey yok'}
              message={showArchived ? 'Arşivlediğin parçalar burada görünür.' : 'İlk parçanı ekle.'}
              action={
                !showArchived ? (
                  <LuxeButton icon="add" title="Parça ekle" onPress={() => router.push('/item/new')} />
                ) : undefined
              }
            />
          ) : (
            <ScrollView contentContainerStyle={{ paddingTop: 6, paddingBottom: 40 }}>
              {racks.map((r) => (
                <Rack key={r.id} title={r.label} items={r.items} onOpen={openItem} />
              ))}
            </ScrollView>
          )}
        </>
      ) : null}

      {/* ————— KOMBİNLER ————— */}
      {section === 'kombinler' ? (
        outfits.length === 0 ? (
          <Empty
            icon="color-palette-outline"
            title="Henüz kombin yok"
            message={'Stüdyo\'daki "Giydir beni" ya da Canvas ile ilk kombinini oluştur.'}
            action={<LuxeButton title="Stüdyoya git" onPress={() => router.push('/(tabs)/studio')} />}
          />
        ) : (
          <FlatList
            key="outfits"
            data={outfits}
            keyExtractor={(o) => o.id}
            numColumns={2}
            ListHeaderComponent={
              <SectionHead title="Kombinler" count={outfits.length} unit="KOMBİN" />
            }
            contentContainerStyle={{ padding: 20, gap: 18 }}
            columnWrapperStyle={{ gap: 18 }}
            renderItem={({ item: o }) => {
              const its = o.itemIds
                .map((x) => items.find((i) => i.id === x))
                .filter(Boolean) as WardrobeItem[];
              return (
                <Pressable
                  style={{ flex: 1, maxWidth: '48%' }}
                  onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: o.id } })}
                >
                  <OutfitCollage items={its} size={(width - 20 * 3) / 2} layout={o.layout} frame={o.canvasFrame} cropToContent={o.cropToContent} />
                  <View style={styles.outfitMeta}>
                    {o.favorite ? <Ionicons name="heart" size={12} color={luxe.primary} /> : null}
                    <Text style={[luxeType.caption, { flexShrink: 1 }]} numberOfLines={1}>
                      {o.name}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )
      ) : null}

      {/* ————— SELFIE'LER ————— */}
      {section === 'selfiler' ? (
        selfies.length === 0 ? (
          <Empty
            icon="camera-outline"
            title="Henüz selfie yok"
            message="Günün kombiniyle ayna selfie'si çek, gardırobun canlı arşivin olsun."
            action={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <LuxeButton icon="camera-outline" title="Çek" onPress={() => takeSelfie(true)} />
                <LuxeButton
                  icon="images-outline"
                  variant="outline"
                  title="Galeriden"
                  onPress={() => takeSelfie(false)}
                />
              </View>
            }
          />
        ) : (
          <FlatList
            key={`selfies-${cols}`}
            data={selfies}
            numColumns={cols}
            keyExtractor={(s) => s.id}
            ListHeaderComponent={
              <SectionHead title="Selfie'ler" count={selfies.length} unit="KARE" />
            }
            contentContainerStyle={{ padding: 20, gap: 8 }}
            columnWrapperStyle={{ gap: 8 }}
            renderItem={({ item: s }) => (
              <Pressable onPress={() => setOpenSelfie(s)}>
                {/* Gerçek insan fotoğrafı — `cover` kalabilir */}
                <Photo
                  uri={s.imageUri}
                  icon="camera-outline"
                  style={{ width: thumb, height: thumb * 1.25, borderRadius: luxeRadius.md }}
                />
                <Text style={[luxeType.caption, { fontSize: 11, marginTop: 4 }]}>
                  {prettyDate(s.date)}
                </Text>
              </Pressable>
            )}
          />
        )
      ) : null}

      {/* ————— LOOKBOOK'LAR ————— */}
      {section === 'lookbooklar' ? (
        lookbooks.length === 0 ? (
          <Empty
            icon="book-outline"
            title="Henüz lookbook yok"
            message='Kombinlerini temalara ayır: "Ofis", "Yaz tatili", "Konser geceleri"…'
            action={
              <LuxeButton icon="add" title="İlk lookbook'unu oluştur" onPress={() => setLbModal(true)} />
            }
          />
        ) : (
          <FlatList
            key="lookbooks"
            data={lookbooks}
            keyExtractor={(l) => l.id}
            ListHeaderComponent={
              <SectionHead title="Lookbook'lar" count={lookbooks.length} unit="DEFTER" />
            }
            contentContainerStyle={{ padding: 20, gap: 12 }}
            renderItem={({ item: lb }) => {
              const firstOutfit = outfits.find((o) => lb.outfitIds.includes(o.id));
              const its = firstOutfit
                ? (firstOutfit.itemIds
                    .map((x) => items.find((i) => i.id === x))
                    .filter(Boolean) as WardrobeItem[])
                : [];
              return (
                <Pressable
                  style={styles.lbCard}
                  onPress={() => router.push({ pathname: '/lookbook/[id]', params: { id: lb.id } })}
                >
                  {its.length ? (
                    <OutfitCollage items={its} size={84} layout={firstOutfit?.layout} frame={firstOutfit?.canvasFrame} cropToContent={firstOutfit?.cropToContent} />
                  ) : (
                    <View style={styles.lbEmpty}>
                      <Text style={{ fontSize: 28 }}>{lb.emoji}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={luxeType.headline} numberOfLines={1}>
                      {lb.emoji} {lb.name}
                    </Text>
                    <Text style={[luxeType.label, { marginTop: 4 }]}>
                      {lb.outfitIds.length} kombin
                    </Text>
                    {lb.description ? (
                      <Text style={[luxeType.caption, { marginTop: 4 }]} numberOfLines={1}>
                        {lb.description}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={luxe.outline} />
                </Pressable>
              );
            }}
          />
        )
      ) : null}

      {/* Selfie görüntüleme modalı */}
      <Modal
        visible={!!openSelfie}
        animationType="fade"
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOpenSelfie(null)}
      >
        <View style={[styles.modalCenter, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.selfieModal}>
            {openSelfie ? (
              <>
                <Photo
                  uri={openSelfie.imageUri}
                  icon="camera-outline"
                  style={{ width: '100%', height: 380, borderRadius: luxeRadius.lg }}
                />
                <Text style={[luxeType.caption, { marginTop: 10 }]}>
                  {prettyDate(openSelfie.date)}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  <LuxeButton
                    icon="share-outline"
                    title="Toplulukta paylaş"
                    onPress={() => setShareSelfieOpen(openSelfie)}
                  />
                  <LuxeButton
                    variant="danger"
                    title="Sil"
                    onPress={() => confirmDeleteSelfie(openSelfie)}
                  />
                  <LuxeButton variant="outline" title="Kapat" onPress={() => setOpenSelfie(null)} />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Lookbook oluşturma modalı */}
      {/*
        `edgeToEdgeEnabled=true` iken sistem pencereyi klavye için yeniden
        boyutlandırmaz; `autoFocus` ile klavye hemen açıldığı için yazı alanı
        ve "Oluştur" düğmesi klavyenin altında kalıyordu.
      */}
      <Modal
        visible={lbModal}
        animationType="slide"
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setLbModal(false)}
      >
        <KeyboardAvoidingView style={styles.modalWrap} behavior="padding">
          <View style={[styles.lbModal, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.modalHead}>
              <Text style={luxeType.headline}>Yeni lookbook</Text>
              <Pressable onPress={() => setLbModal(false)} hitSlop={8} style={styles.pill}>
                <Text style={styles.pillText}>Kapat</Text>
              </Pressable>
            </View>
            <TextInput
              value={lbName}
              onChangeText={setLbName}
              placeholder='Örn. "Yaz tatili", "Ofis haftası"'
              placeholderTextColor={luxe.outline}
              style={styles.input}
              autoFocus
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {LOOKBOOK_EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setLbEmoji(e)}
                  style={[styles.emojiBtn, lbEmoji === e && styles.emojiBtnActive]}
                >
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <LuxeButton
              title="Oluştur"
              onPress={createLookbook}
              disabled={!lbName.trim()}
              style={{ marginTop: 18, alignSelf: 'flex-start' }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ShareModal
        visible={!!shareSelfieOpen}
        defaultCaption={shareSelfieOpen?.note || 'Bugünün aynası'}
        preview={
          shareSelfieOpen ? (
            <Image
              source={{ uri: shareSelfieOpen.imageUri }}
              style={{ width: 150, height: 190, borderRadius: luxeRadius.lg }}
              contentFit="cover"
            />
          ) : undefined
        }
        onClose={() => setShareSelfieOpen(null)}
        onShare={doShareSelfie}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  sectionTabsBar: {
    flexGrow: 0,
    flexShrink: 0,
    height: 42,
    borderBottomWidth: 1,
    borderBottomColor: luxe.outlineSoft,
    marginBottom: 12,
  },
  tab: { paddingBottom: 9 },
  tabText: { fontFamily: font.bodyMedium, fontSize: 14, color: luxe.outline },
  tabTextActive: { color: luxe.ink },
  tabCount: { fontFamily: font.body, fontSize: 11, color: luxe.outline },
  /** Aktif sekmenin altındaki iridesan çizgi — kimliğin ince bir tekrarı. */
  tabUnderline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, borderRadius: 1 },

  // Askılık
  rackHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 2,
  },
  rackTitle: { fontFamily: font.headline, fontSize: 17, color: luxe.primary },
  rackCount: { fontFamily: font.label, fontSize: 10, letterSpacing: 1.6, color: luxe.outline },
  /*
    Kancaların üstten taşabilmesi için raf dolgusu cömert; kartlar örnekteki
    gibi hafifçe üst üste biniyor (negatif boşluk).
  */
  rack: { paddingTop: 19, paddingBottom: 12, paddingHorizontal: 20, gap: 0 },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 23,
    height: 4,
    borderRadius: 3,
  },
  hook: {
    width: 19,
    height: HOOK_H,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: luxe.outline,
    borderTopLeftRadius: 9.5,
    borderTopRightRadius: 9.5,
    alignSelf: 'center',
    marginTop: -HOOK_H + 9,
  },
  card: {
    width: CARD_W,
    marginRight: -8,
    backgroundColor: luxe.surface,
    borderRadius: luxeRadius.md,
    overflow: 'hidden',
    ...luxeShadow.card,
  },
  cardImg: {
    width: '100%',
    height: CARD_IMG_H,
    backgroundColor: luxe.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    /* Koyu daire karta ağır bir leke bırakıyordu; cam rozet daha sessiz. */
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.94)' },
  cardName: {
    fontFamily: font.label,
    fontSize: 8.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: luxe.ink,
  },
  cardColor: { fontFamily: font.body, fontSize: 9.5, color: luxe.outline, marginTop: 2 },

  // Filtreler
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: glass.fillStrong,
    borderRadius: luxeRadius.pill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  searchInput: { flex: 1, fontFamily: font.body, fontSize: 14, color: luxe.ink, padding: 0 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBar: { flexGrow: 0, flexShrink: 0 },

  // Alt tür: açılır onay kutulu liste
  subWrap: { paddingHorizontal: 20, marginBottom: 10 },
  subHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  subHeadText: {
    fontFamily: font.label,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: luxe.outline,
  },
  subList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.md,
    padding: 10,
    gap: 4,
  },
  /** İki sütun: yüzde genişlik, uzun etiketlerde de hizalı kalıyor. */
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 7, width: '48%', paddingVertical: 5 },
  subLabel: { fontFamily: font.body, fontSize: 13, color: luxe.inkSoft, flexShrink: 1 },
  subClear: { width: '100%', paddingTop: 6 },
  subClearText: { fontFamily: font.bodyMedium, fontSize: 12, color: luxe.primary },
  chipRow: { gap: 8, paddingHorizontal: 20, paddingBottom: 10 },

  pill: {
    borderRadius: luxeRadius.pill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    backgroundColor: glass.fill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  pillFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  pillText: { fontFamily: font.bodyMedium, fontSize: 12.5, color: luxe.outline },
  pillTextActive: { color: luxe.ink },

  // Düğme
  btn: {
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnText: {
    fontFamily: font.label,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  photoWrap: { alignItems: 'center', justifyContent: 'center', backgroundColor: luxe.surfaceMid },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  outfitMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },

  lbCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: glass.fillStrong,
    borderRadius: luxeRadius.lg,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    padding: 12,
  },
  lbEmpty: {
    width: 84,
    height: 84,
    borderRadius: luxeRadius.md,
    backgroundColor: luxe.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalWrap: { flex: 1, backgroundColor: luxe.overlay, justifyContent: 'flex-end' },
  modalCenter: {
    flex: 1,
    backgroundColor: luxe.overlay,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  selfieModal: { backgroundColor: luxe.bg, borderRadius: luxeRadius.xl, padding: 20 },
  lbModal: {
    backgroundColor: luxe.bg,
    borderTopLeftRadius: luxeRadius.xl,
    borderTopRightRadius: luxeRadius.xl,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: font.body,
    fontSize: 15,
    color: luxe.ink,
    backgroundColor: glass.fillStrong,
  },
  emojiBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnActive: { borderColor: luxe.primary, backgroundColor: luxe.primaryContainer },
});
