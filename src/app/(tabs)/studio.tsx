import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemThumb } from '@/components/ItemThumb';
import { OutfitCollage } from '@/components/OutfitCollage';
import { ProfileButton } from '@/components/ProfileButton';
import { ShareModal } from '@/components/ShareModal';
import { Button, Chip, EmptyState, SectionTitle } from '@/components/UI';
import { persistRemoteImage } from '@/services/photoStore';
import { claimJob, releaseJob, TryOnPendingError, waitForJob } from '@/services/tryon';
import { useStore } from '@/store/useStore';
import { BETTA_ARCHETYPES, colors, radius, spacing, type } from '@/theme';
import type { Category, TryOnRecord, WardrobeItem } from '@/types';
import { OUTER_SUBCATEGORY } from '@/types';

type Mode = 'dressme' | 'outfits' | 'ai';

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
  const [indices, setIndices] = useState<Record<string, number>>({});
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  /** Büyütülerek görüntülenen sanal giydirme */
  const [openTryon, setOpenTryon] = useState<TryOnRecord | null>(null);
  const [shareTryon, setShareTryon] = useState<TryOnRecord | null>(null);
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
  const tryonCell = (Math.min(width, 700) - spacing.lg * 2 - spacing.sm * 2) / 3;

  const doShareTryOn = (caption: string) => {
    const t = shareTryon;
    if (!t) return;
    sharePost({
      kind: 'selfie',
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

  const confirmDeleteTryOn = (id: string) => {
    const doDelete = () => deleteTryOn(id);
    if (Platform.OS === 'web') {
      if (window.confirm('Bu sanal giydirme silinsin mi?')) doDelete();
    } else {
      Alert.alert('Sil', 'Bu sanal giydirme silinsin mi?', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

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

  const current = (key: string): WardrobeItem | undefined => {
    const pool = pools[key];
    if (!pool?.length) return undefined;
    return pool[((indices[key] ?? 0) % pool.length + pool.length) % pool.length];
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
      Alert.alert('Eksik kombin', 'En az iki parça seçili olmalı.');
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

  // Kompakt: çekirdek yuvalar + alt bar tek ekrana sığsın
  const thumbSize = Math.min(84, width - spacing.lg * 2 - 150);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={styles.header}>
        <Text style={[type.display, { flex: 1 }]}>Stüdyo</Text>
        <Button small variant="dark" title="🎨 Canvas" onPress={() => router.push('/canvas')} />
        <View style={{ marginLeft: spacing.sm }}>
          <ProfileButton />
        </View>
      </View>

      {/* Sekme değiştirici */}
      <View style={styles.segment}>
        <Pressable
          onPress={() => setMode('dressme')}
          style={[styles.segmentBtn, mode === 'dressme' && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, mode === 'dressme' && { color: '#fff' }]}>Giydir beni</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('outfits')}
          style={[styles.segmentBtn, mode === 'outfits' && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, mode === 'outfits' && { color: '#fff' }]}>
            Kombinlerim{"\n"}
            ({outfits.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('ai')}
          style={[styles.segmentBtn, mode === 'ai' && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, mode === 'ai' && { color: '#fff' }]}>✨ AI</Text>
        </Pressable>
      </View>

      {mode === 'ai' ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 30, gap: spacing.md }}>
          {/* AI Stilist */}
          <Pressable style={styles.aiCard} onPress={() => router.push('/stylist')}>
            <View style={styles.aiCardHead}>
              <Text style={{ fontSize: 34 }}>🐠</Text>
              <View style={{ flex: 1 }}>
                <Text style={type.subtitle}>AI Stilist</Text>
                <Text style={type.tiny}>
                  {api.anthropicKey ? 'Claude bağlı ✨' : 'Yerel mod — ücretsiz'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
            </View>
            <Text style={[type.caption, { marginTop: spacing.sm }]}>
              "Bugün ne giysem?", "Toplantıya ne uyar?" — gardırobunu bilen stilistinle sohbet et,
              havaya ve renk uyumuna göre kombin önerileri al.
            </Text>
          </Pressable>

          {/* FASHN Sanal Deneme */}
          {pro ? (
            <Pressable style={[styles.aiCard, { borderColor: colors.gold, borderWidth: 1.5 }]} onPress={() => router.push('/tryon')}>
              <View style={styles.aiCardHead}>
                <Text style={{ fontSize: 34 }}>🪞</Text>
                <View style={{ flex: 1 }}>
                  <Text style={type.subtitle}>
                    Sanal Deneme <Text style={{ color: colors.gold }}>PRO 🏆</Text>
                  </Text>
                  <Text style={type.tiny}>
                    {api.fashnKey ? 'FASHN AI bağlı' : 'FASHN API anahtarı gerekli (Ayarlar)'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
              </View>
              <Text style={[type.caption, { marginTop: spacing.sm }]}>
                Kıyafetlerini model fotoğrafının üzerinde gerçekçi şekilde gör.
              </Text>
            </Pressable>
          ) : (
            <View style={[styles.aiCard, { borderColor: colors.gold, borderWidth: 1.5 }]}>
              <View style={styles.aiCardHead}>
                <Text style={{ fontSize: 34 }}>🪞</Text>
                <View style={{ flex: 1 }}>
                  <Text style={type.subtitle}>
                    Sanal Deneme <Text style={{ color: colors.gold }}>PRO 🔒</Text>
                  </Text>
                  <Text style={type.tiny}>FASHN AI ile — Pro üyelere özel</Text>
                </View>
              </View>
              <Text style={[type.caption, { marginTop: spacing.sm }]}>
                Gardırobundaki bir üstü, elbiseyi ya da pantolonu seç; FASHN AI onu model
                fotoğrafının üzerine gerçekçi şekilde giydirsin. Almadan önce "üstümde nasıl
                durur?" sorusunun cevabı.
              </Text>
              <View style={styles.promoRow}>
                <View style={styles.promoStep}>
                  <Text style={{ fontSize: 22 }}>🧍‍♀️</Text>
                  <Text style={type.tiny}>Model fotoğrafı seç</Text>
                </View>
                <Text style={{ color: colors.inkFaint }}>→</Text>
                <View style={styles.promoStep}>
                  <Text style={{ fontSize: 22 }}>👗</Text>
                  <Text style={type.tiny}>Kıyafeti seç</Text>
                </View>
                <Text style={{ color: colors.inkFaint }}>→</Text>
                <View style={styles.promoStep}>
                  <Text style={{ fontSize: 22 }}>✨</Text>
                  <Text style={type.tiny}>Üzerinde gör</Text>
                </View>
              </View>
              <Button
                title="🏆 BETTA Pro'ya geç"
                onPress={() => router.push('/pro')}
                style={{ marginTop: spacing.md, backgroundColor: colors.gold }}
              />
            </View>
          )}

          {/* Sanal giydirme çıktıları — görseller kalıcı kopya olarak saklanır */}
          <SectionTitle
            title={`🖼️ Sanal giydirmelerim${tryons.length ? ` · ${tryons.length}` : ''}`}
            style={{ marginTop: spacing.md }}
          />
          {pendingTryOn ? (
            <Text style={[type.caption, { marginBottom: spacing.sm }]}>
              ⏳ Bir giydirme hazırlanıyor… Hazır olunca burada belirecek.
            </Text>
          ) : null}
          {tryons.length === 0 && !pendingTryOn ? (
            <Text style={type.caption}>
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
                    style={{ width: '100%', height: tryonCell * 1.5, borderRadius: radius.md }}
                    contentFit="cover"
                  />
                  <Text style={type.tiny} numberOfLines={1}>
                    {t.outfitName ?? 'Kombin'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {tryons.length ? (
            <Text style={type.tiny}>Büyütmek için dokun, silmek için basılı tut.</Text>
          ) : null}
        </ScrollView>
      ) : mode === 'dressme' ? (
        active.length === 0 ? (
          <EmptyState
            title="Önce gardırobunu doldur"
            message="Giydir beni'nin çalışması için birkaç parça eklemelisin."
            action={<Button small title="+ Parça ekle" onPress={() => router.push('/item/new')} />}
          />
        ) : (
          <View style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.md }}
              showsVerticalScrollIndicator={false}
            >
              {SLOTS.map((slot) => {
                const pool = pools[slot.key] ?? [];
                const hidden = skipped[slot.key];
                const item = shown(slot.key);

                // Havuz boş: çekirdek yuvada uyarı, gizlenebilir yuvada hiç gösterme
                if (!pool.length) {
                  if (slot.hideable) return null;
                  return (
                    <View key={slot.key} style={[styles.slotRow, styles.slotRowClosed]}>
                      <Text style={styles.slotLabel}>{slot.label}</Text>
                      <Text style={type.tiny}>Bu kategoride parça yok</Text>
                    </View>
                  );
                }

                // Kapalı/gizli yuva: kompakt "aç" satırı
                if (hidden) {
                  return (
                    <Pressable
                      key={slot.key}
                      style={[styles.slotRow, styles.slotRowClosed]}
                      onPress={() => setSkipped((s) => ({ ...s, [slot.key]: false }))}
                    >
                      <Text style={[styles.slotLabel, { flex: 1 }]}>{slot.label} gizli</Text>
                      <View style={styles.addBtn}>
                        <Ionicons name="add" size={16} color={colors.aquaDark} />
                        <Text style={styles.addBtnText}>Göster</Text>
                      </View>
                    </Pressable>
                  );
                }

                return (
                  <View key={slot.key} style={styles.slotRow}>
                    <View style={{ width: 74 }}>
                      <Text style={styles.slotLabel} numberOfLines={1}>
                        {slot.label}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                        <Pressable
                          onPress={() => setLocked((l) => ({ ...l, [slot.key]: !l[slot.key] }))}
                          style={styles.slotIcon}
                        >
                          <Ionicons
                            name={locked[slot.key] ? 'lock-closed' : 'lock-open-outline'}
                            size={14}
                            color={locked[slot.key] ? colors.coral : colors.inkFaint}
                          />
                        </Pressable>
                        {slot.hideable ? (
                          <Pressable
                            onPress={() => setSkipped((s) => ({ ...s, [slot.key]: true }))}
                            style={styles.slotIcon}
                          >
                            <Ionicons name="eye-off-outline" size={14} color={colors.inkFaint} />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>

                    <Pressable onPress={() => cycle(slot.key, -1)} style={styles.arrow} disabled={pool.length < 2}>
                      <Ionicons name="chevron-back" size={20} color={pool.length < 2 ? colors.border : colors.inkSoft} />
                    </Pressable>

                    <View style={{ flex: 1, alignItems: 'center' }}>
                      {item ? (
                        <ItemThumb
                          item={item}
                          size={thumbSize}
                          showName
                          onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
                        />
                      ) : null}
                    </View>

                    <Pressable onPress={() => cycle(slot.key, 1)} style={styles.arrow} disabled={pool.length < 2}>
                      <Ionicons name="chevron-forward" size={20} color={pool.length < 2 ? colors.border : colors.inkSoft} />
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>

            {/* Sabit alt bar — sayfa kaydırılmadan görünür */}
            <View style={styles.dressFooter}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="💾 Kaydet" variant="dark" onPress={saveOutfit} style={{ flex: 1 }} />
                <Button title="🎲 Karıştır" onPress={shuffleAll} style={{ flex: 1 }} />
              </View>
              <Text style={[type.tiny, { textAlign: 'center', marginTop: spacing.sm }]}>
                🔒 sabitler · 👁 gizler (alt, dış giyim, aksesuar)
              </Text>
            </View>
          </View>
        )
      ) : outfits.length === 0 ? (
        <EmptyState
          emoji="🎨"
          title="Henüz kombin yok"
          message='"Giydir beni" ile karıştır ya da Canvas ile serbest kolaj yap.'
        />
      ) : (
        <FlatList
          data={outfits}
          keyExtractor={(o) => o.id}
          numColumns={2}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          columnWrapperStyle={{ gap: spacing.lg }}
          renderItem={({ item: o }) => {
            const its = o.itemIds
              .map((x) => items.find((i) => i.id === x))
              .filter(Boolean) as WardrobeItem[];
            const arch = BETTA_ARCHETYPES.find((a) => a.id === o.archetypeId);
            return (
              <Pressable
                style={{ flex: 1, maxWidth: '48%' }}
                onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: o.id } })}
              >
                <OutfitCollage items={its} size={(width - spacing.lg * 3) / 2} layout={o.layout} frame={o.canvasFrame} cropToContent={o.cropToContent} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
                  <Text style={[type.caption, { flex: 1 }]} numberOfLines={1}>
                    {o.favorite ? '❤️ ' : ''}
                    {o.name}
                  </Text>
                  {arch ? (
                    <Chip label={`${arch.emoji} ${arch.styleName}`} color={arch.color} active style={{ paddingVertical: 3, paddingHorizontal: 8 }} />
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
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
            { paddingTop: spacing.lg + insets.top, paddingBottom: spacing.lg + insets.bottom },
          ]}
        >
          <View style={styles.viewerHead}>
            <Text style={[type.subtitle, { color: '#fff', flex: 1 }]} numberOfLines={1}>
              {openTryon?.outfitName ?? 'Sanal giydirme'}
            </Text>
            <Pressable onPress={() => setOpenTryon(null)} style={styles.viewerClose}>
              <Ionicons name="close" size={22} color="#fff" />
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
            <Button
              small
              title="🌊 Toplulukta paylaş"
              onPress={() => setShareTryon(openTryon)}
            />
            <Button
              small
              variant="secondary"
              title="🗑️ Sil"
              onPress={() => {
                const id = openTryon?.id;
                setOpenTryon(null);
                if (id) setTimeout(() => confirmDeleteTryOn(id), 120);
              }}
            />
          </View>
        </View>
      </Modal>

      <ShareModal
        visible={!!shareTryon}
        defaultCaption={
          shareTryon?.outfitName ? `"${shareTryon.outfitName}" üzerimde 🪞🐟` : 'Sanal denemem 🪞🐟'
        }
        preview={
          shareTryon ? (
            <Image
              source={{ uri: shareTryon.imageUri }}
              style={{ width: 150, height: 200, borderRadius: radius.lg }}
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
  tryonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  viewerWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', paddingHorizontal: spacing.lg },
  viewerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  viewerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  viewerImg: { flex: 1, width: '100%', borderRadius: radius.lg },
  viewerPrompt: { color: '#D8D8D8', fontSize: 12, marginTop: spacing.sm, fontStyle: 'italic' },
  viewerActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tryonCard: { gap: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  segment: {
    flexDirection: 'row',
    margin: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.deep },
  segmentText: { fontSize: 13.5, fontWeight: '700', color: colors.inkSoft },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  slotRowClosed: {
    borderStyle: 'dashed',
    paddingVertical: spacing.md,
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.aquaSoft,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  addBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.aquaDark },
  slotLabel: { fontSize: 12.5, fontWeight: '700', color: colors.inkSoft },
  slotIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { padding: 4 },
  dressFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  aiCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  aiCardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  promoStep: { alignItems: 'center', gap: 2, flex: 1 },
  emptySlot: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
