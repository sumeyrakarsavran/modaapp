import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ActionSheet';
import { Backdrop } from '@/components/Backdrop';
import { BettaAvatar } from '@/components/BettaAvatar';
import { FluidSpecCollage } from '@/components/Community';
import { BTN_PAD, FinBlob } from '@/components/FinBlob';
import { LookbookViewer, type LookbookSet } from '@/components/LookbookViewer';
import { resizeForProcessing } from '@/services/imageResize';
import { photoFromParams, pickPhoto, type PickedPhoto } from '@/services/photoPicker';
import { persistGarmentPhoto } from '@/services/photoStore';
import { useStore } from '@/store/useStore';
import { getArchetype } from '@/theme';
import { font, glass, iridescent, luxe, luxeRadius, luxeType } from '@/theme/luxe';

/**
 * Lookbook gönderisindeki KOMBİN sayısı — rozette bu yazıyor.
 * Önce parçalar sayılıyordu; lookbook bir kombin koleksiyonu olduğu için
 * o sayı hiçbir şeye karşılık gelmiyordu.
 */
function outfitCount(p: { outfitSets?: unknown[] }): number {
  return p.outfitSets?.length ?? 1;
}

/**
 * Lookbook kartının başlığı. Kaynak lookbook duruyorsa adı; silinmiş ya da
 * yeniden adlandırılmışsa açıklamadaki TIRNAK İÇİ ad. Ham açıklama başlık
 * olarak konunca kart "…lookbook'um: 7 ko…" diye kırpılıyordu.
 */
function lookbookTitle(caption: string, name?: string): string {
  if (name) return name;
  const m = caption.match(/"([^"]+)"/);
  return m ? m[1] : caption;
}

/** Izgara aralığı ve kenar boşluğu — karolar birbirine yapışmasın. */
const GRID_GAP = 5;
const GRID_PAD = 12;

/**
 * Profilde o an gösterilen bölüm — başkalarının profilindekiyle AYNI mantık.
 * Halkalar gardıroba/stüdyoya götürüyordu; ama profil PAYLAŞILANLARIN yeri,
 * kendi gardırobunu zaten sekmeden görüyorsun. Artık halkalar paylaşılan
 * gönderileri türüne göre süzüyor.
 */
type Section = 'gonderi' | 'kombin' | 'selfie' | 'lookbook' | 'tryon';

export default function Profile() {
  // Gardırop sayıları artık kullanılmıyor: halkalar PAYLAŞILAN gönderileri sayıyor.
  // `lookbooks` yalnızca paylaşılan lookbook'un ADINI bulmak için.
  const { profile, posts, lookbooks, followedIds, pro, setProfile } = useStore();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const myPosts = posts.filter((p) => p.userId === 'me');
  const arch = getArchetype(profile.bettaArchetypeId);
  // Halka paletten — arketip kimliği aşağıda yazıyla duruyor (bkz. ProfileButton)
  const ringColor = luxe.primarySoft;

  const [section, setSection] = useState<Section>('gonderi');
  /** Açık lookbook — kombinleri oklarla tek tek geziliyor. */
  const [lbView, setLbView] = useState<{ title: string; sets: LookbookSet[]; index: number } | null>(
    null,
  );
  const [editOpen, setEditOpen] = useState(false);
  const [avatarSheet, setAvatarSheet] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editBio, setEditBio] = useState(profile.bio ?? '');
  /*
    Klavye AÇIKKEN `insets.bottom` EKLENMEZ: KeyboardAvoidingView'ın eklediği
    klavye yüksekliği alt çubuğu zaten kapsıyor, üstüne inset binince arada
    boşluk kalıyor.
  */
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /** Avatarı kaydet — kırpma açık (kare kadraj), küçültülüp kalıcı saklanır. */
  const saveAvatarPhoto = async (photo: PickedPhoto) => {
    const small = await resizeForProcessing(photo.uri, photo.width, photo.height, 800);
    const saved = await persistGarmentPhoto(small).catch(() => small);
    setProfile({ avatarUri: saved });
  };

  const pickAvatar = async (fromCamera: boolean) => {
    const photo = await pickPhoto({ fromCamera, aspect: [1, 1], quality: 0.7, purpose: 'avatar' });
    if (photo) await saveAvatarPhoto(photo);
  };

  // Android'de süreç öldüyse kök layout avatarı parametreyle buraya yollar
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (recoveredRef.current) return;
    const photo = photoFromParams(params);
    if (!photo) return;
    recoveredRef.current = true;
    saveAvatarPhoto(photo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  /* Seçim listesi uygulamanın kendi alt sayfasında (bkz. `ActionSheet`). */
  const changeAvatar = () => setAvatarSheet(true);

  const saveEdit = () => {
    setProfile({ name: editName.trim() || profile.name, bio: editBio.trim() || undefined });
    setEditOpen(false);
  };

  const followers = profile.followers ?? 0;
  /** Üç sütun; kenar boşluğu ve aralıklar düşülerek. */
  const cell = Math.floor((width - GRID_PAD * 2 - GRID_GAP * 2) / 3);
  /**
   * Lookbook kartının içindeki kombin karosu — kart dolgusu da düşülüyor.
   * Sondaki -1: yuvarlama bir piksel taşırıp ikinci karoyu alt satıra atıyor.
   */
  const lbCell = Math.floor((width - GRID_PAD * 2 - 28 - 10) / 2) - 1;

  const Stat = ({ n, label, onPress }: { n: number; label: string; onPress?: () => void }) => (
    <Pressable style={styles.stat} onPress={onPress} disabled={!onPress}>
      <Text style={styles.statValue}>{n.toLocaleString('tr-TR')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );

  /**
   * Gardırop sayaçları — Instagram'daki "öne çıkanlar" halkalarının karşılığı.
   * Eskiden ikinci bir sayaç kutusuydu; halka dizisi hem daha az yer kaplıyor
   * hem de dokunulabilir olduğu belli oluyor.
   */
  const Highlight = ({
    icon,
    label,
    id: sec,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    id: Exclude<Section, 'gonderi'>;
  }) => {
    const on = section === sec;
    const n = myPosts.filter((p) => p.kind === sec).length;
    return (
      <Pressable style={styles.hl} onPress={() => setSection(on ? 'gonderi' : sec)}>
        <LinearGradient
          colors={iridescent.soft}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hlRing}
        >
          <View style={[styles.hlInner, on && styles.hlInnerOn]}>
            <Ionicons name={icon} size={17} color={luxe.primary} />
            <Text style={styles.hlCount}>{n}</Text>
          </View>
        </LinearGradient>
        <Text style={[styles.hlLabel, on && styles.hlLabelOn]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
  };

  /** O an gösterilecek gönderiler — halka seçiliyse türüne göre süzülüyor. */
  const shownPosts = section === 'gonderi' ? myPosts : myPosts.filter((p) => p.kind === section);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />
      <ActionSheet
        visible={avatarSheet}
        title="Profil fotoğrafı"
        onClose={() => setAvatarSheet(false)}
        actions={[
          { label: 'Fotoğraf çek', icon: 'camera-outline', onPress: () => pickAvatar(true) },
          { label: 'Galeriden seç', icon: 'images-outline', onPress: () => pickAvatar(false) },
          ...(profile.avatarUri
            ? [
                {
                  label: 'Fotoğrafı kaldır',
                  icon: 'trash-outline' as const,
                  destructive: true,
                  onPress: () => setProfile({ avatarUri: undefined }),
                },
              ]
            : []),
        ]}
      />

      {/* Başlık: kullanıcı adı solda — Instagram'daki gibi */}
      {/* Sekme olduğu için geri oku yok — başlıkta kullanıcı adı ve ayarlar */}
      <View style={styles.header}>
        <Text style={styles.headerName} numberOfLines={1}>
          @{profile.username || 'betta'}
        </Text>
        <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
          <Ionicons name="settings-outline" size={20} color={luxe.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + sayaçlar aynı satırda: dikey yığmak sayfayı boş gösteriyordu */}
        <View style={styles.topRow}>
          <Pressable onPress={changeAvatar}>
            {/*
              PRO madalyonu BURADA ÇİZİLMİYOR: kamera rozetiyle aynı köşede
              üst üste biniyordu. Pro bilgisi zaten adın yanındaki etikette.
            */}
            <BettaAvatar size={84} color={ringColor} imageUri={profile.avatarUri} />
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={12} color={luxe.onPrimary} />
            </View>
          </Pressable>
          <View style={styles.stats}>
            <Stat n={myPosts.length} label="Gönderi" />
            <Stat n={followers} label="Takipçi" />
            <Stat
              n={followedIds.length}
              label="Takip"
              onPress={() => router.push('/(tabs)/community')}
            />
          </View>
        </View>

        {/* Ad · kimlik · bio — Instagram'ın isim/kategori/bio bloğu */}
        <View style={styles.bioBlock}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.name || 'Betta'}</Text>
            {pro ? <Text style={styles.proTag}>PRO</Text> : null}
            <Pressable onPress={() => router.push('/settings')} hitSlop={6}>
              <Text style={styles.privacy}>
                {profile.isPublic ? 'Herkese açık' : 'Gizli'}
              </Text>
            </Pressable>
          </View>

          {/* Betta kimliği: kategori satırı. Dokununca teste gidiyor. */}
          <Pressable onPress={() => router.push('/quiz')}>
            {arch ? (
              <>
                <Text style={styles.archLine}>
                  {arch.fish} · {arch.styleName} stil
                </Text>
                <Text style={styles.archNote} numberOfLines={2}>
                  {arch.tagline}
                </Text>
              </>
            ) : (
              <Text style={styles.archLine}>Hangi betta&apos;sın? · testi çöz</Text>
            )}
          </Pressable>

          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        </View>

        {/* Eylemler — Instagram'daki "Profili düzenle / Profili paylaş" satırı */}
        <View style={styles.actions}>
          <Pressable
            style={styles.action}
            onPress={() => {
              setEditName(profile.name);
              setEditBio(profile.bio ?? '');
              setEditOpen(true);
            }}
          >
            <FinBlob pad={BTN_PAD} variant="button" color={glass.fill} stroke={luxe.outlineSoft} />
            <Text style={styles.actionText}>{profile.bio ? 'Profili düzenle' : 'Bio ekle'}</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => router.push('/quiz')}>
            <FinBlob pad={BTN_PAD} variant="button" color={glass.fill} stroke={luxe.outlineSoft} />
            <Text style={styles.actionText}>Betta testi</Text>
          </Pressable>
          <Pressable style={styles.actionIcon} onPress={() => router.push('/(tabs)/community')}>
            <Ionicons name="people-outline" size={16} color={luxe.primary} />
          </Pressable>
        </View>

        {/*
          Akvaryum artık sekme değil, profilin içinde. Rapor ekranları başka
          uygulamalarda da profilin altında duruyor (Instagram'da içgörüler,
          Spotify'da Wrapped) — sürekli gezilen bir yer değil, arada bakılan
          bir özet.
        */}
        <Pressable style={styles.reportRow} onPress={() => router.push('/aquarium')}>
          <View style={styles.reportIcon}>
            <Ionicons name="stats-chart-outline" size={16} color={luxe.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reportTitle}>Akvaryum</Text>
            <Text style={styles.reportNote}>Gardırobunun raporu</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={luxe.outline} />
        </Pressable>

        {/* Öne çıkanlar: gardırop sayaçları */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hlRow}
        >
          <Highlight icon="albums-outline" label="Kombin" id="kombin" />
          <Highlight icon="happy-outline" label="Selfie" id="selfie" />
          <Highlight icon="book-outline" label="Lookbook" id="lookbook" />
          <Highlight icon="body-outline" label="Deneme" id="tryon" />
        </ScrollView>

        {/* Gönderiler — ayrım yok, tek ızgara */}
        <View style={styles.gridTop} />
        {shownPosts.length === 0 ? (
          <Empty
            icon="images-outline"
            text={
              section === 'gonderi'
                ? "Henüz gönderi yok. Bir kombin, selfie ya da lookbook'u toplulukta paylaş."
                : 'Bu türde paylaşımın yok.'
            }
            action="Topluluğa git"
            onPress={() => router.push('/(tabs)/community')}
          />
        ) : section === 'lookbook' ? (
          /*
            Lookbook bölümü, başkalarının profilindekiyle AYNI kalıpta: her
            lookbook tek kart, kombinleri içinde. Karta dokununca kombinler
            büyütülüp sağa sola kaydırılıyor.
          */
          <View style={{ gap: 14, paddingHorizontal: GRID_PAD }}>
            {shownPosts.map((p) => {
              const sets = p.outfitSets?.length ? p.outfitSets : [{ garments: p.garments }];
              const title = lookbookTitle(
                p.caption,
                lookbooks.find((lb) => lb.id === p.lookbookId)?.name,
              );
              return (
                <Pressable
                  key={p.id}
                  style={styles.lbCard}
                  onPress={() =>
                    setLbView({
                      title,
                      sets: sets.map((set) => ({
                        garments: set?.garments ?? [],
                        frame: (set as { canvasFrame?: { w: number; h: number } })?.canvasFrame,
                        cropToContent: (set as { cropToContent?: boolean })?.cropToContent,
                      })),
                      index: 0,
                    })
                  }
                >
                  <View style={styles.lbHead}>
                    <Text style={styles.lbName} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text style={styles.lbMeta}>{sets.length} KOMBİN</Text>
                  </View>
                  <View style={styles.lbGrid}>
                    {sets.slice(0, 4).map((set, i) => (
                      <View key={i} style={{ width: lbCell }}>
                        <FluidSpecCollage
                          garments={set?.garments ?? []}
                          frame={(set as { canvasFrame?: { w: number; h: number } })?.canvasFrame}
                          cropToContent={(set as { cropToContent?: boolean })?.cropToContent}
                        />
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.grid}>
            {shownPosts.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.cell, { width: cell, height: cell }]}
                onPress={() =>
                  /*
                    Gönderi ekranı, o an EKRANDA OLAN süzgeçle açılıyor:
                    halkaya basıp kombinlere süzdüysen kaydırınca yine
                    kombinler geliyor, "hepsi"ne dönmüyor.
                  */
                  router.push({
                    pathname: '/post/[id]',
                    params: { id: p.id, user: 'me', ...(section !== 'gonderi' ? { kind: section } : {}) },
                  })
                }
              >
                {p.kind === 'lookbook' && p.outfitSets?.length ? (
                  /*
                    Lookbook karosu, paylaşırken seçilen KAPAK KOMBİNİNİ
                    gösteriyor. Dört kombinlik kolaj küçük karoda okunmuyordu.
                  */
                  (() => {
                    const cover = p.outfitSets[p.coverIndex ?? 0] ?? p.outfitSets[0];
                    return (
                      <View style={{ width: cell }}>
                        <FluidSpecCollage
                          garments={cover?.garments ?? []}
                          frame={cover?.canvasFrame}
                          cropToContent={cover?.cropToContent}
                          bare
                        />
                      </View>
                    );
                  })()
                ) : p.imageUri ? (
                  <Image
                    source={{ uri: p.imageUri }}
                    style={{ width: cell, height: cell }}
                    contentFit="contain"
                  />
                ) : (
                  <View style={{ width: cell }}>
                    {/*
                      `bare`: kolaj KENDİ çerçevesini çizmiyor. Çizerken karonun
                      yuvarlak köşesi o dikdörtgen çerçeveyi kırpıyor ve
                      çizginin bir kısmı görünüyordu; fotoğraflı karolarda
                      (selfie, sanal deneme) böyle bir çerçeve olmadığı için
                      ızgara alacalı duruyordu. Artık hepsi aynı.
                    */}
                    <FluidSpecCollage
                      garments={p.garments}
                      frame={p.canvasFrame}
                      cropToContent={p.cropToContent}
                      bare
                    />
                  </View>
                )}
                {/* Lookbook olduğu köşedeki parça sayısından belli oluyor */}
                {p.kind === 'lookbook' ? (
                  <View style={styles.lbBadge}>
                    <Ionicons name="albums-outline" size={10} color={luxe.onDark} />
                    <Text style={styles.lbBadgeText}>{outfitCount(p)}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.version}>BETTA v1.0</Text>
      </ScrollView>

      <LookbookViewer
        title={lbView?.title ?? ''}
        sets={lbView?.sets ?? []}
        index={lbView?.index ?? null}
        onIndex={(i) => setLbView((v) => (v ? { ...v, index: i } : v))}
        onClose={() => setLbView(null)}
      />

      {/* Profili düzenle modalı (isim + bio) */}
      <Modal
        visible={editOpen}
        animationType="slide"
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setEditOpen(false)}
      >
        <KeyboardAvoidingView style={styles.modalWrap} behavior="padding">
          <View style={[styles.modalCard, { paddingBottom: 22 + (keyboardUp ? 0 : insets.bottom) }]}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Profili düzenle</Text>
              <Pressable onPress={() => setEditOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={luxe.outline} />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Ad</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Adın"
              placeholderTextColor={luxe.outline}
              style={styles.input}
            />
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Kendini birkaç cümleyle anlat…"
              placeholderTextColor={luxe.outline}
              style={[styles.input, { minHeight: 84, textAlignVertical: 'top' }]}
              multiline
              maxLength={160}
            />
            <Text style={styles.counter}>{editBio.length}/160</Text>
            <Text style={[luxeType.tiny, { marginTop: 8 }]}>
              Kullanıcı adını ve gizlilik ayarını Ayarlar&apos;dan değiştirebilirsin.
            </Text>
            <Pressable style={styles.saveBtn} onPress={saveEdit}>
              <FinBlob shadow pad={BTN_PAD} variant="button" color={luxe.primary} />
              <Text style={styles.saveText}>Kaydet</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Empty({
  icon,
  text,
  action,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={26} color={luxe.outlineSoft} />
      <Text style={[luxeType.caption, { textAlign: 'center', marginTop: 10, maxWidth: 280 }]}>
        {text}
      </Text>
      <Pressable style={styles.emptyBtn} onPress={onPress}>
        <FinBlob shadow pad={BTN_PAD} variant="button" color={luxe.primary} />
        <Text style={styles.emptyBtnText}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerName: { flex: 1, fontFamily: font.bodyMedium, fontSize: 16, color: luxe.ink },
  /** Akvaryum girişi — profilden açılan tek "iç sayfa". */
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginHorizontal: 18,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: luxeRadius.md,
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
  },
  reportIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: luxe.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportTitle: { fontFamily: font.bodyMedium, fontSize: 14, color: luxe.ink },
  reportNote: { fontFamily: font.body, fontSize: 11.5, color: luxe.outline },

  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 18 },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: luxe.primary,
    borderWidth: 2,
    borderColor: luxe.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: font.display, fontSize: 19, lineHeight: 24, color: luxe.primary },
  statLabel: { fontFamily: font.body, fontSize: 11.5, color: luxe.outline },

  bioBlock: { paddingHorizontal: 18, marginTop: 14, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: font.headline, fontSize: 18, color: luxe.primary },
  proTag: {
    fontFamily: font.label,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: luxe.primary,
    backgroundColor: luxe.primaryContainer,
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  privacy: { fontFamily: font.body, fontSize: 11.5, color: luxe.outline },
  /** Kimlik satırı — Instagram'daki kategori metninin karşılığı. */
  archLine: {
    fontFamily: font.label,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: luxe.outline,
    marginTop: 3,
  },
  archNote: { fontFamily: font.body, fontStyle: 'italic', fontSize: 12.5, color: luxe.outline, marginTop: 2 },
  bio: { fontFamily: font.body, fontSize: 13.5, lineHeight: 20, color: luxe.inkSoft, marginTop: 6 },

  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 14 },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    /*
      Yükseklik AÇIK veriliyor: `flex: 1` olan bir satır çocuğunda mutlak
      konumlu zemin (siluet) kutunun son boyunu yakalayamıyor ve biçim
      alttan kırpılıyordu (cihazda görüldü).
    */
    height: 30 + 2 * BTN_PAD,
  },
  actionText: { fontFamily: font.bodyMedium, fontSize: 12.5, color: luxe.primary },
  actionIcon: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.sm,
    paddingVertical: 8,
  },

  hlRow: { gap: 18, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  hl: { alignItems: 'center', width: 68, gap: 5 },
  /** Gradyan halka + beyaz iç boşluk — Instagram'ın öne çıkanlar dili. */
  hlRing: { width: 62, height: 62, borderRadius: 31, padding: 2 },
  hlInner: {
    flex: 1,
    borderRadius: 29,
    backgroundColor: luxe.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hlCount: { fontFamily: font.display, fontSize: 13, color: luxe.primary, marginTop: 1 },
  hlLabel: { fontFamily: font.body, fontSize: 11, color: luxe.outline },
  /** Seçili halka: iç yüzey tona çalıyor, etiket koyulaşıyor. */
  hlInnerOn: { backgroundColor: luxe.primaryContainer },
  hlLabelOn: { fontFamily: font.bodyMedium, color: luxe.ink },


  /** Izgaranın üstündeki ince ayraç — eskiden sekme çubuğu buradaydı. */
  gridTop: { height: 1, backgroundColor: luxe.outlineSoft, marginTop: 18 },
  /** Tek parçalı kapak, karonun ortasında durur. */
  coverWrap: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  lbCard: {
    backgroundColor: luxe.surface,
    borderRadius: luxeRadius.lg,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    padding: 14,
  },
  lbHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 10 },
  lbName: { flex: 1, fontFamily: font.headline, fontSize: 17, color: luxe.primary },
  lbMeta: { fontFamily: font.label, fontSize: 9, letterSpacing: 1.3, color: luxe.outline },
  lbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  /**
   * Lookbook rozeti — karonun sağ üst köşesinde kombin sayısı.
   * Kapak fotoğrafı konunca lookbook karosu sıradan bir kareden ayırt
   * edilemiyordu.
   */
  lbBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(23,23,26,0.62)',
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  lbBadgeText: { fontFamily: font.bodyMedium, fontSize: 10.5, color: luxe.onDark },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: GRID_PAD,
    paddingTop: GRID_PAD,
  },
  /*
    Karo DÜZ BEYAZ. Önce köşegen bir geçiş vardı; dokuz karo dokuz ayrı çizgi
    verince ızgara lekeli görünüyordu. Kırpma olmadığı için boşta kalan yeri
    sakin beyaz dolduruyor, aralıklar da karoları birbirinden ayırıyor.
  */
  /*
    Karonun ÇERÇEVESİ YOK. Beyaz karo fildişi zeminde zaten kendi kendine
    ayrışıyor; üstüne bir de ince çizgi konunca ızgara kutucuk kutucuk
    görünüyordu ("gönderilerin etrafında çizgiler").
  */
  cell: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: luxe.surface,
    borderRadius: luxeRadius.md,
  },

  empty: { alignItems: 'center', paddingVertical: 42, paddingHorizontal: 24 },
  emptyBtn: {
    marginTop: 14,
    paddingVertical: 10 + BTN_PAD,
    paddingHorizontal: 18 + BTN_PAD,
  },
  emptyBtnText: {
    fontFamily: font.label,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: luxe.onPrimary,
  },

  version: {
    fontFamily: font.body,
    fontSize: 10.5,
    color: luxe.outline,
    textAlign: 'center',
    marginTop: 26,
  },

  modalWrap: { flex: 1, backgroundColor: luxe.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: luxe.bg,
    borderTopLeftRadius: luxeRadius.lg,
    borderTopRightRadius: luxeRadius.lg,
    padding: 22,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitle: {
    fontFamily: font.headlineItalic,
    fontStyle: 'italic',
    fontSize: 20,
    color: luxe.primary,
  },
  inputLabel: {
    fontFamily: font.label,
    fontSize: 9.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: luxe.outline,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: font.body,
    fontSize: 15,
    color: luxe.ink,
    backgroundColor: luxe.surface,
  },
  counter: { fontFamily: font.body, fontSize: 11, color: luxe.outline, textAlign: 'right', marginTop: 4 },
  saveBtn: {
    marginTop: 16,
    paddingVertical: 13 + BTN_PAD,
    alignItems: 'center',
  },
  saveText: {
    fontFamily: font.label,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: luxe.onPrimary,
  },
});
