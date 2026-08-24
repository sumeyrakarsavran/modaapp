import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmModal } from '@/components/ConfirmModal';
import { Backdrop } from '@/components/Backdrop';
import { BTN_PAD, FinBlob } from '@/components/FinBlob';
import { ItemThumb } from '@/components/ItemThumb';
import { ShareModal } from '@/components/ShareModal';
import { TryOnShowcase } from '@/components/TryOnShowcase';
import { persistRemoteImage } from '@/services/photoStore';
import { claimJob, releaseJob, TryOnPendingError, waitForJob } from '@/services/tryon';
import { TRYON_MODELS } from '@/data/tryonModels';
import { useStore } from '@/store/useStore';
import { BETTA_ARCHETYPES } from '@/theme';
import { font, glass, iridescent, luxe, luxeRadius, luxeShadow, luxeType } from '@/theme/luxe';
import type { Category, TryOnRecord, WardrobeItem } from '@/types';
import { OUTER_SUBCATEGORY } from '@/types';

type Mode = 'dressme' | 'tryon';

interface Slot {
  key: string;
  label: string;
  categories: Category[];
  /** Yalnızca bu alt türler (dış giyim katmanı böyle ayrışıyor) */
  onlySubcategories?: string[];
  /** Bu alt türleri dışla (ceket "Üst" sütununda ikinci kez çıkmasın) */
  excludeSubcategories?: string[];
  /** göz simgesiyle gizlenebilir (varsayılan görünür) */
  hideable?: boolean;
  /** varsayılan kapalı — kullanıcı açar (ör. dış giyim) */
  defaultOff?: boolean;
}

/**
 * Dress me sütunları: çekirdek (üst/alt/ayakkabı) + opsiyonel katmanlar.
 * Dış giyim artık ayrı bir kategori değil (kategoriler modelin grup listesiyle
 * hizalandı); "Üst giyim" içindeki `jacket` alt türü kendi katmanını oluşturuyor.
 */
const SLOTS: Slot[] = [
  {
    key: 'ust',
    label: 'Üst / Elbise',
    categories: ['ust', 'elbise'],
    excludeSubcategories: [OUTER_SUBCATEGORY],
  },
  { key: 'alt', label: 'Alt', categories: ['alt'], hideable: true },
  { key: 'ayakkabi', label: 'Ayakkabı', categories: ['ayakkabi'] },
  {
    key: 'dis',
    label: 'Dış Giyim',
    categories: ['ust'],
    onlySubcategories: [OUTER_SUBCATEGORY],
    hideable: true,
    defaultOff: true,
  },
  { key: 'aksesuar', label: 'Aksesuar', categories: ['aksesuar'], hideable: true },
];

/** Yuvalar arası boşluk ve kapalı/boş yuvanın sabit yüksekliği. */
const SLOT_GAP = 8;
const COMPACT_H = 42;

/** Editoryal düğme — hap biçimli, ince çizgi ikonlu (Gardırop'takiyle aynı). */
function LuxeButton({
  title,
  onPress,
  icon,
  variant = 'solid',
  style,
}: {
  title?: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  variant?: 'solid' | 'outline';
  style?: any;
}) {
  const solid = variant === 'solid';
  const fg = solid ? luxe.onPrimary : luxe.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.lxBtn,
        !title && { paddingHorizontal: 11 + BTN_PAD },
        pressed && { opacity: 0.82 },
        style,
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
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      {title ? <Text style={[styles.lxBtnText, { color: fg }]}>{title}</Text> : null}
    </Pressable>
  );
}

export default function Studio() {
  const {
    items, outfits, addOutfit, pro, api, tryons, updateTryOn, deleteTryOn, sharePost,
    addTryOn, pendingTryOn, setPendingTryOn,
  } = useStore();
  const { width } = useWindowDimensions();
  // Görüntüleyici modalı tüm ekranı kaplıyor (statusBarTranslucent +
  // navigationBarTranslucent), yani sistem çubuklarının ALTINA da uzanıyor.
  // Kendi güvenli alan boşluğunu vermezse başlık durum çubuğunun, düğmeler
  // gezinme çubuğunun arkasında kalıyor.
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('dressme');
  /*
    Derin bağlantı. Sekme monte kaldığı için parametre değişimi izleniyor
    (bkz. Gardırop).
  */
  const params = useLocalSearchParams<{ mode?: string; t?: string }>();
  useEffect(() => {
    const want = params.mode;
    // 'ai' eski adı — sanal denemeye düşüyor
    if (want === 'dressme' || want === 'tryon') setMode(want);
    else if (want === 'ai') setMode('tryon');
  }, [params.mode, params.t]);
  const [indices, setIndices] = useState<Record<string, number>>({});
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  /** Büyütülerek görüntülenen sanal giydirme */
  const [openTryon, setOpenTryon] = useState<TryOnRecord | null>(null);
  const [askDeleteTryOn, setAskDeleteTryOn] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; message?: string } | null>(null);
  const [shareTryon, setShareTryon] = useState<TryOnRecord | null>(null);
  /**
   * "Giydir beni" alanının ÖLÇÜLEN yüksekliği.
   * Yuvalar eskiden sabit boyluydu ve bir ScrollView'a konuyordu: telefonda
   * ayakkabı ekranın altında kalıyor, kullanıcı kaydırmadan kombini göremiyordu.
   * Artık yükseklik ölçülüp yuvalara PAYLAŞTIRILIYOR — üst, alt ve ayakkabı
   * her cihazda ilk görünüşte ekranda.
   */
  const [dressH, setDressH] = useState(0);
  // Dış giyim başta kapalı; isteyen açar.
  const [skipped, setSkipped] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of SLOTS) if (s.defaultOff) init[s.key] = true;
    return init;
  });

  /**
   * Uzak URL'de kalmış sanal giydirmeleri onarır.
   * FASHN çıktısı geçici bir CDN adresi; indirme sırasında bir hata olursa
   * kayıt o adresle kalıyor ve görsel bir süre sonra kırılıyor. Galeri
   * görününce sessizce yeniden indirip kalıcı kopyaya çeviriyoruz.
   */
  const repairing = useRef(new Set<string>());
  useEffect(() => {
    for (const t of tryons) {
      if (!t.imageUri.startsWith('http') || repairing.current.has(t.id)) continue;
      repairing.current.add(t.id);
      persistRemoteImage(t.imageUri)
        .then((uri) => updateTryOn(t.id, { imageUri: uri }))
        .catch((e) => {
          if ((globalThis as any).__DEV__) console.warn('[tryon onarım]', t.id, e);
        });
    }
  }, [tryons, updateTryOn]);

  /**
   * Yarım kalmış FASHN işini tamamlar.
   * İş başladığı an kredi harcanıyor; beklerken vazgeçtiysek (zaman aşımı,
   * ekrandan çıkma, uygulamanın kapanması) sonuç sunucuda hazır bekliyor
   * olabilir. Burada kaldığımız yerden devam edip galeriye düşürüyoruz.
   */
  const resuming = useRef(false);
  useEffect(() => {
    const p = pendingTryOn;
    if (!p || !api.fashnKey || resuming.current) return;
    // Deneme ekranı bu işi zaten bekliyorsa karışma — yoksa sonuç iki kez
    // indirilir ve galeriye iki kez eklenir.
    if (!claimJob(p.jobId)) return;
    resuming.current = true;
    waitForJob(api.fashnKey, p.jobId)
      .then(async (url) => {
        const saved = await persistRemoteImage(url).catch(() => url);
        addTryOn({
          imageUri: saved,
          jobId: p.jobId,
          modelId: p.modelId,
          outfitId: p.outfitId,
          outfitName: p.outfitName,
          prompt: p.prompt,
        });
        setPendingTryOn(null);
      })
      .catch((e) => {
        // Hâlâ hazır değilse kaydı BIRAKMA: bir dahaki açılışta yine denenir.
        if (!(e instanceof TryOnPendingError)) setPendingTryOn(null);
        if ((globalThis as any).__DEV__) console.warn('[tryon devam]', e);
      })
      .finally(() => {
        releaseJob(p.jobId);
        resuming.current = false;
      });
  }, [pendingTryOn, api.fashnKey, addTryOn, setPendingTryOn]);

  /** Sanal giydirme ızgarası: 3 sütun */
  const tryonCell = (Math.min(width, 700) - 40 - 20) / 3;
  /*
    Anlatım karelerindeki örnek: mümkünse kullanıcının SON denemesinden
    (o denemede kullanılan manken + kombinin bir parçası + çıktı). Böylece
    "bu bana ne yapacak" sorusu temsilî görselle değil, gerçek sonuçla
    cevaplanıyor. Denemesi yoksa hazır manken + gardıroptan bir parça
    gösteriliyor, sonuç karesi boş kalıyor.
  */
  const howToDemo = useMemo(() => {
    const rec = tryons[0];
    const model = TRYON_MODELS.find((m) => m.id === rec?.modelId) ?? TRYON_MODELS[0];
    // Denemede kullanılan kombin; yoksa en yeni kombin.
    const outfit = (rec?.outfitId ? outfits.find((o) => o.id === rec.outfitId) : undefined) ?? outfits[0];
    const outfitItems = (outfit?.itemIds ?? [])
      .map((id) => items.find((i) => i.id === id))
      .filter(Boolean) as WardrobeItem[];
    return {
      modelSource: model.source,
      outfitItems,
      outfitLayout: outfit?.layout,
      resultUri: rec?.imageUri,
    };
  }, [tryons, outfits, items]);

  const doShareTryOn = (caption: string) => {
    const t = shareTryon;
    if (!t) return;
    sharePost({
      kind: 'tryon',
      caption,
      garments: [],
      imageUri: t.imageUri,
      archetypeId: useStore.getState().profile.bettaArchetypeId,
    });
    setShareTryon(null);
    setOpenTryon(null);
    // Modal kapanışı işlensin, sonra git (ekran donmadan önce)
    setTimeout(() => router.push('/(tabs)/community'), 120);
  };

  /** Onay kutusu uygulamanın kendi kutusu (bkz. `ConfirmModal`). */
  const confirmDeleteTryOn = (id: string) => setAskDeleteTryOn(id);

  const active = items.filter((i) => !i.archived);
  const pools = useMemo(() => {
    const map: Record<string, WardrobeItem[]> = {};
    for (const slot of SLOTS) {
      map[slot.key] = active.filter((i) => {
        if (!slot.categories.includes(i.category)) return false;
        if (slot.onlySubcategories) {
          return !!i.subcategory && slot.onlySubcategories.includes(i.subcategory);
        }
        if (slot.excludeSubcategories && i.subcategory) {
          return !slot.excludeSubcategories.includes(i.subcategory);
        }
        return true;
      });
    }
    return map;
  }, [active]);

  /** Havuzdaki sıra numarası — kart köşesindeki "3/12" bunu gösteriyor. */
  const indexOf = (key: string): number => {
    const n = pools[key]?.length ?? 0;
    if (!n) return 0;
    return (((indices[key] ?? 0) % n) + n) % n;
  };

  const current = (key: string): WardrobeItem | undefined => {
    const pool = pools[key];
    if (!pool?.length) return undefined;
    return pool[indexOf(key)];
  };

  /** Yuvada gösterilecek parça: gizli/atlanmışsa yok. */
  const shown = (key: string): WardrobeItem | undefined =>
    skipped[key] ? undefined : current(key);

  const cycle = (key: string, dir: 1 | -1) => {
    setSkipped((s) => ({ ...s, [key]: false }));
    setIndices((ix) => ({ ...ix, [key]: (ix[key] ?? 0) + dir }));
  };

  const shuffleAll = () => {
    setIndices((ix) => {
      const next = { ...ix };
      for (const slot of SLOTS) {
        if (locked[slot.key] || skipped[slot.key]) continue;
        const n = pools[slot.key]?.length ?? 0;
        if (n > 0) next[slot.key] = Math.floor(Math.random() * n);
      }
      return next;
    });
  };

  const chosen = SLOTS.map((s) => shown(s.key)).filter(Boolean) as WardrobeItem[];

  const saveOutfit = () => {
    if (chosen.length < 2) {
      setNotice({ title: 'Eksik kombin', message: 'En az iki parça seçili olmalı.' });
      return;
    }
    // Etiketlere göre en yakın betta arketipini bul
    const tagBag = chosen.flatMap((i) => [...i.tags, i.name.toLocaleLowerCase('tr')]).join(' ');
    let best: string | undefined;
    let bestScore = 0;
    for (const a of BETTA_ARCHETYPES) {
      const score = a.keywords.filter((k) => tagBag.includes(k)).length;
      if (score > bestScore) {
        bestScore = score;
        best = a.id;
      }
    }
    const o = addOutfit({
      name: `Kombin ${outfits.length + 1}`,
      itemIds: chosen.map((i) => i.id),
      favorite: false,
      archetypeId: best,
    });
    router.push({ pathname: '/outfit/[id]', params: { id: o.id } });
  };

  /*
    Yuvaların ekrana PAYLAŞTIRILMASI.
    Açık yuvalar kalan yüksekliği eşit bölüşür, kapalı/boş yuvalar sabit
    ince şerit. Böylece kaç katman açık olursa olsun liste tam ekrana oturuyor
    ve hiçbir zaman kaydırma gerekmiyor.
  */
  type Row = { slot: Slot; kind: 'open' | 'closed' | 'empty'; pool: WardrobeItem[] };
  const rows: Row[] = SLOTS.map((slot) => {
    const pool = pools[slot.key] ?? [];
    // Havuzu boş gizlenebilir katman hiç görünmesin — yer kaplamasın
    if (!pool.length) return slot.hideable ? null : { slot, kind: 'empty' as const, pool };
    return { slot, kind: skipped[slot.key] ? ('closed' as const) : ('open' as const), pool };
  }).filter(Boolean) as Row[];

  const openCount = rows.filter((r) => r.kind === 'open').length;
  const compactCount = rows.length - openCount;
  const freeH = dressH - SLOT_GAP * Math.max(0, rows.length - 1) - compactCount * COMPACT_H;
  const rowH = openCount > 0 ? Math.max(64, freeH / openCount) : 0;
  const thumbSize = Math.max(46, Math.min(132, rowH - 20));
  /** Dar ekranda parça adı yuvadan taşmasın diye eşik. */
  const showNames = rowH >= 84;

  /**
   * Sekme. `canvas` ve `stylist` birer kip DEĞİL, ayrı ekrana bağlantı —
   * hiç etkin görünmüyorlar, basılınca o ekran açılıyor.
   */
  const LINKS = { canvas: '/canvas', stylist: '/stylist' } as const;
  const tab = (id: Mode | keyof typeof LINKS, label: string, count?: number) => {
    const on = mode === id;
    return (
      <Pressable
        key={id}
        onPress={() => (id in LINKS ? router.push(LINKS[id as keyof typeof LINKS]) : setMode(id as Mode))}
        style={styles.tab}
      >
        <Text style={[styles.tabText, on && styles.tabTextActive]}>
          {label}
          {count != null ? <Text style={styles.tabCount}>{`  ${count}`}</Text> : null}
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      {/* Bugün · Gardırop · Topluluk ile AYNI zemin */}
      <Backdrop />
      <ConfirmModal
        visible={!!askDeleteTryOn}
        title="Sanal giydirmeyi sil"
        message="Bu giydirme kaydı silinsin mi? Bu işlem geri alınamaz."
        onConfirm={() => {
          if (askDeleteTryOn) deleteTryOn(askDeleteTryOn);
          setAskDeleteTryOn(null);
        }}
        onCancel={() => setAskDeleteTryOn(null)}
      />
      <ConfirmModal
        notice
        visible={!!notice}
        title={notice?.title ?? ''}
        message={notice?.message}
        onConfirm={() => setNotice(null)}
        onCancel={() => setNotice(null)}
      />

      <View style={styles.header}>
        <Text style={luxeType.display}>Stüdyo</Text>
      </View>

      {/* Bölüm sekmeleri — Gardırop ve Topluluk'takiyle aynı altı çizili dil */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsBar}
        contentContainerStyle={{ gap: 16, paddingHorizontal: 20, alignItems: 'flex-end' }}
      >
        {tab('dressme', 'Giydir beni')}
        {tab('canvas', 'Canvas')}
        {tab('stylist', 'AI Stilist')}
        {tab('tryon', 'Sanal deneme')}
      </ScrollView>

      {mode === 'tryon' ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 14 }}>
          {/* Vitrin: ne yaptığını GÖSTEREREK anlatıyor, girişi de kendisi */}
          <TryOnShowcase
            modelSource={howToDemo.modelSource}
            outfitItems={howToDemo.outfitItems}
            outfitLayout={howToDemo.outfitLayout}
            resultUri={howToDemo.resultUri}
            status={
              pro
                ? api.fashnKey
                  ? 'FASHN AI bağlı'
                  : 'FASHN API anahtarı gerekli (Ayarlar)'
                : 'Pro üyelere özel'
            }
            ctaLabel={pro ? 'Denemeye başla' : "BETTA Pro'ya geç"}
            /* Önce MANKEN seçimi: "kim giyecek" sorusu stüdyodan önce gelir. */
            onPress={() => router.push(pro ? '/models' : '/pro')}
          />

          {/* Sanal giydirme çıktıları — görseller kalıcı kopya olarak saklanır */}
          <View style={styles.sectionHead}>
            <Text style={luxeType.subtitle}>Sanal giydirmelerim</Text>
            {tryons.length ? <Text style={styles.sectionCount}>{tryons.length}</Text> : null}
          </View>
          {pendingTryOn ? (
            <Text style={[luxeType.caption, { marginTop: -6 }]}>
              Bir giydirme hazırlanıyor… Hazır olunca burada belirecek.
            </Text>
          ) : null}
          {tryons.length === 0 && !pendingTryOn ? (
            <Text style={[luxeType.caption, { marginTop: -6 }]}>
              Henüz sanal giydirme yok. Yukarıdan bir manken ve kombin seçip deneyince sonuçlar
              burada birikir.
            </Text>
          ) : (
            <View style={styles.tryonGrid}>
              {tryons.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setOpenTryon(t)}
                  onLongPress={() => confirmDeleteTryOn(t.id)}
                  style={[styles.tryonCard, { width: tryonCell }]}
                >
                  <Image
                    source={{ uri: t.imageUri }}
                    style={{ width: '100%', height: tryonCell * 1.5, borderRadius: luxeRadius.md }}
                    contentFit="cover"
                  />
                  <Text style={luxeType.tiny} numberOfLines={1}>
                    {t.outfitName ?? 'Kombin'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {tryons.length ? (
            <Text style={luxeType.tiny}>Büyütmek için dokun, silmek için basılı tut.</Text>
          ) : null}
        </ScrollView>
      ) : (
        active.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="shirt-outline" size={30} color={luxe.outlineSoft} />
            <Text style={[luxeType.headlineItalic, { marginTop: 12 }]}>Önce gardırobunu doldur</Text>
            <Text style={[luxeType.body, { textAlign: 'center', marginTop: 8 }]}>
              Giydir beni'nin çalışması için birkaç parça eklemelisin.
            </Text>
            <LuxeButton
              icon="add"
              title="Parça ekle"
              onPress={() => router.push('/item/new')}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/*
              Kaydırma YOK: alan ölçülüp yuvalara bölünüyor. Ölçüm gelmeden
              (ilk kare) çizim yapılmıyor, yoksa yükseklik negatif çıkıyor.
            */}
            <View
              style={styles.slotStack}
              onLayout={(e) => setDressH(e.nativeEvent.layout.height)}
            >
              {dressH > 0
                ? rows.map(({ slot, kind, pool }) => {
                    // Havuzu boş çekirdek yuva: ince uyarı şeridi
                    if (kind === 'empty') {
                      return (
                        <View key={slot.key} style={[styles.slotCompact, { height: COMPACT_H }]}>
                          <Text style={styles.slotLabel}>{slot.label}</Text>
                          <Text style={luxeType.tiny}>Bu kategoride parça yok</Text>
                        </View>
                      );
                    }

                    // Gizlenmiş katman: tek dokunuşla geri açılan ince şerit
                    if (kind === 'closed') {
                      return (
                        <Pressable
                          key={slot.key}
                          style={[styles.slotCompact, { height: COMPACT_H }]}
                          onPress={() => setSkipped((s) => ({ ...s, [slot.key]: false }))}
                        >
                          <Text style={[styles.slotLabel, { flex: 1 }]}>{slot.label}</Text>
                          <View style={styles.showBtn}>
                            <Ionicons name="add" size={13} color={luxe.primary} />
                            <Text style={styles.showBtnText}>Göster</Text>
                          </View>
                        </Pressable>
                      );
                    }

                    const item = shown(slot.key);
                    const isLocked = !!locked[slot.key];
                    return (
                      <View key={slot.key} style={[styles.slot, { height: rowH }]}>
                        {/*
                          Sabitlenmiş katmanın sol kenarında iridesan şerit.
                          Aksan SÜS DEĞİL bilgi taşıyor: "bu parça karıştırmada
                          yerinde kalacak".
                        */}
                        {isLocked ? (
                          <LinearGradient
                            colors={iridescent.full}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.slotRail}
                          />
                        ) : null}

                        <View style={styles.slotInfo}>
                          <Text style={styles.slotLabel} numberOfLines={1}>
                            {slot.label}
                          </Text>
                          {showNames && item ? (
                            <Text style={styles.slotName} numberOfLines={2}>
                              {item.name}
                            </Text>
                          ) : null}
                          <View style={styles.slotIcons}>
                            <Pressable
                              onPress={() =>
                                setLocked((l) => ({ ...l, [slot.key]: !l[slot.key] }))
                              }
                              style={[styles.slotIcon, isLocked && styles.slotIconOn]}
                              hitSlop={6}
                            >
                              <Ionicons
                                name={isLocked ? 'lock-closed' : 'lock-open-outline'}
                                size={13}
                                color={isLocked ? luxe.primary : luxe.outline}
                              />
                            </Pressable>
                            {slot.hideable ? (
                              <Pressable
                                onPress={() => setSkipped((s) => ({ ...s, [slot.key]: true }))}
                                style={styles.slotIcon}
                                hitSlop={6}
                              >
                                <Ionicons name="eye-off-outline" size={13} color={luxe.outline} />
                              </Pressable>
                            ) : null}
                          </View>
                        </View>

                        <Pressable
                          onPress={() => cycle(slot.key, -1)}
                          style={({ pressed }) => [
                            styles.arrow,
                            pool.length < 2 && styles.arrowOff,
                            pressed && { opacity: 0.6 },
                          ]}
                          disabled={pool.length < 2}
                          hitSlop={6}
                        >
                          <Ionicons
                            name="chevron-back"
                            size={17}
                            color={pool.length < 2 ? luxe.outlineSoft : luxe.ink}
                          />
                        </Pressable>

                        <View style={styles.slotStage}>
                          {item ? (
                            <ItemThumb
                              item={item}
                              size={thumbSize}
                              onPress={() =>
                                router.push({ pathname: '/item/[id]', params: { id: item.id } })
                              }
                            />
                          ) : null}
                        </View>

                        <Pressable
                          onPress={() => cycle(slot.key, 1)}
                          style={({ pressed }) => [
                            styles.arrow,
                            pool.length < 2 && styles.arrowOff,
                            pressed && { opacity: 0.6 },
                          ]}
                          disabled={pool.length < 2}
                          hitSlop={6}
                        >
                          <Ionicons
                            name="chevron-forward"
                            size={17}
                            color={pool.length < 2 ? luxe.outlineSoft : luxe.ink}
                          />
                        </Pressable>

                        {/* Havuzdaki sıra — mutlak konumlu, satır yüksekliği yemesin */}
                        {pool.length > 1 ? (
                          <Text style={styles.slotCounter}>
                            {indexOf(slot.key) + 1}/{pool.length}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })
                : null}
            </View>

            {/* Sabit alt bar — sayfa kaydırılmadan görünür */}
            <View style={styles.dressFooter}>
              <LuxeButton
                icon="bookmark-outline"
                title="Kombini kaydet"
                onPress={saveOutfit}
                style={{ flex: 1.4 }}
              />
              <LuxeButton
                icon="shuffle"
                title="Karıştır"
                variant="outline"
                onPress={shuffleAll}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )
      )}

      {/* Sanal giydirmeyi büyüt: küçük ızgara karesinde detay görünmüyor */}
      <Modal
        visible={!!openTryon}
        animationType="fade"
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOpenTryon(null)}
      >
        <View
          style={[
            styles.viewerWrap,
            { paddingTop: 20 + insets.top, paddingBottom: 20 + insets.bottom },
          ]}
        >
          <View style={styles.viewerHead}>
            <Text style={styles.viewerTitle} numberOfLines={1}>
              {openTryon?.outfitName ?? 'Sanal giydirme'}
            </Text>
            <Pressable onPress={() => setOpenTryon(null)} style={styles.viewerClose}>
              <Ionicons name="close" size={22} color={luxe.onDark} />
            </Pressable>
          </View>
          {openTryon ? (
            <Image
              source={{ uri: openTryon.imageUri }}
              style={styles.viewerImg}
              contentFit="contain"
            />
          ) : null}
          {openTryon?.prompt ? (
            <Text style={styles.viewerPrompt} numberOfLines={3}>
              “{openTryon.prompt}”
            </Text>
          ) : null}
          <View style={styles.viewerActions}>
            <Pressable style={styles.viewerBtn} onPress={() => setShareTryon(openTryon)}>
              <FinBlob shadow pad={BTN_PAD} variant="button" color={luxe.onDark} />
              <Ionicons name="share-social-outline" size={14} color={luxe.primary} />
              <Text style={[styles.viewerBtnText, { color: luxe.primary }]}>Toplulukta paylaş</Text>
            </Pressable>
            <Pressable
              style={styles.viewerBtn}
              onPress={() => {
                const id = openTryon?.id;
                setOpenTryon(null);
                if (id) setTimeout(() => confirmDeleteTryOn(id), 120);
              }}
            >
              <FinBlob pad={BTN_PAD} variant="button" color="transparent" stroke="rgba(255,255,255,0.45)" />
              <Ionicons name="trash-outline" size={14} color={luxe.onDark} />
              <Text style={[styles.viewerBtnText, { color: luxe.onDark }]}>Sil</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ShareModal
        visible={!!shareTryon}
        defaultCaption={
          shareTryon?.outfitName ? `"${shareTryon.outfitName}" üzerimde` : 'Sanal denemem'
        }
        preview={
          shareTryon ? (
            <Image
              source={{ uri: shareTryon.imageUri }}
              style={{ width: 150, height: 200, borderRadius: luxeRadius.lg }}
              contentFit="cover"
            />
          ) : null
        }
        onShare={doShareTryOn}
        onClose={() => setShareTryon(null)}
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
  lxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10 + BTN_PAD,
    paddingHorizontal: 15 + BTN_PAD,
  },
  lxBtnText: {
    fontFamily: font.label,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  tabsBar: {
    flexGrow: 0,
    flexShrink: 0,
    height: 42,
    borderBottomWidth: 1,
    borderBottomColor: luxe.outlineSoft,
    marginBottom: 10,
  },
  tab: { paddingBottom: 9 },
  tabText: { fontFamily: font.bodyMedium, fontSize: 14, color: luxe.outline },
  tabTextActive: { color: luxe.ink },
  tabCount: { fontFamily: font.body, fontSize: 11, color: luxe.outline },
  /** Aktif sekmenin altındaki iridesan çizgi — kimliğin ince bir tekrarı. */
  tabUnderline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, borderRadius: 1 },

  // ————— Giydir beni —————
  slotStack: { flex: 1, paddingHorizontal: 20, paddingTop: 2, gap: SLOT_GAP },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: glass.fillStrong,
    borderRadius: luxeRadius.lg,
    borderWidth: 1,
    borderColor: glass.border,
    paddingLeft: 14,
    paddingRight: 8,
    overflow: 'hidden',
  },
  /** Sabitlenmiş katmanın sol kenarındaki iridesan şerit. */
  slotRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  slotCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: luxeRadius.md,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderStyle: 'dashed',
    paddingHorizontal: 14,
  },
  slotInfo: { width: 78 },
  slotLabel: {
    fontFamily: font.label,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: luxe.outline,
  },
  slotName: { fontFamily: font.bodyMedium, fontSize: 12, lineHeight: 16, color: luxe.ink, marginTop: 3 },
  slotIcons: { flexDirection: 'row', gap: 6, marginTop: 7 },
  slotIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: luxe.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotIconOn: { backgroundColor: luxe.primaryContainer },
  slotStage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  /** Oklar yuvarlak düğme: çıplak ok işareti dokunulabilir görünmüyordu. */
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: luxe.surface,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
  },
  /** Havuzda tek parça varsa düğme kaybolur — tıklanamayacağı belli olsun. */
  arrowOff: { backgroundColor: 'transparent', borderColor: 'transparent' },
  /** Havuz sırası — kartın sağ üst köşesinde, satır yüksekliğini yemeyen mutlak katman. */
  slotCounter: {
    position: 'absolute',
    top: 8,
    right: 14,
    fontFamily: font.body,
    fontSize: 9.5,
    color: luxe.outline,
  },
  showBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: luxe.primaryContainer,
    borderRadius: luxeRadius.pill,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  showBtnText: { fontFamily: font.bodyMedium, fontSize: 11.5, color: luxe.primary },
  dressFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: luxe.outlineSoft,
  },

  // ————— Kombinlerim —————

  // ————— AI —————
  /*
    ⚠️ Gölge (elevation) YOK. Dolgu yarı saydam olduğu için Android elevation
    gölgesini kartın İÇİNE beyaz bir dikdörtgen olarak sızdırıyor (emülatörde
    görüldü: metnin arkasında köşelere ulaşmayan açık blok). Derinliği
    kenarlık ve ton farkı taşıyor — Bugün'deki cam kartla aynı çözüm.
  */
  /** Pro kartı: altın yerine iridesan pastel çerçeve — palet tek dilde kalsın. */
  /** Anlatım bloğu: kart değil, ince çizgiyle ayrılmış bölüm. */
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 },
  sectionCount: {
    fontFamily: font.label,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: luxe.outline,
  },
  tryonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tryonCard: { gap: 4 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },

  // ————— Sanal giydirme görüntüleyici —————
  viewerWrap: { flex: 1, backgroundColor: 'rgba(23,20,18,0.94)', paddingHorizontal: 20 },
  viewerHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  viewerTitle: {
    flex: 1,
    fontFamily: font.headlineItalic,
    fontStyle: 'italic',
    fontSize: 19,
    color: luxe.onDark,
  },
  viewerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  viewerImg: { flex: 1, width: '100%', borderRadius: luxeRadius.lg },
  viewerPrompt: {
    fontFamily: font.body,
    color: luxe.onDarkSoft,
    fontSize: 12,
    marginTop: 10,
    fontStyle: 'italic',
  },
  viewerActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  viewerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11 + BTN_PAD,
    paddingHorizontal: 18 + BTN_PAD,
  },
  viewerBtnText: {
    fontFamily: font.label,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
