import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { Avatar, FluidSpecCollage } from '@/components/Community';
import { GarmentArt } from '@/components/GarmentArt';
import { LookbookViewer, type LookbookSet } from '@/components/LookbookViewer';
import { PERSONA_SHOWCASE, PERSONAS } from '@/data/community';
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

/** Kendi profilimizdeki ızgarayla AYNI ölçüler — iki ekran aynı görünsün. */
const GRID_GAP = 5;
const GRID_PAD = 12;

/**
 * Profilde o an gösterilen bölüm. Varsayılan GÖNDERİLER: profile girince
 * insanın beklediği şey bu; kalanlar halkaya dokununca açılıyor.
 *
 * "Parçalar" KALDIRILDI: uygulamada tek tek parça paylaşma diye bir şey yok,
 * o bölüm gerçek bir paylaşımı değil kurgu bir vitrini gösteriyordu. Yerine
 * sanal deneme geldi — o gerçekten paylaşılabilen bir tür.
 */
type Section = 'gonderi' | 'kombin' | 'selfie' | 'lookbook' | 'tryon';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { posts, followedIds, toggleFollow } = useStore();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>('gonderi');
  /**
   * Açık lookbook — kombinleri oklarla tek tek geziliyor. Önce durağan bir
   * önizleme vardı; koleksiyonun diğer kombinlerine bakmak için kapatıp
   * yeniden dokunmak gerekiyordu.
   */
  const [lbView, setLbView] = useState<{ title: string; sets: LookbookSet[]; index: number } | null>(
    null,
  );
  const user = PERSONAS.find((p) => p.id === id);

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
        <Backdrop />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={luxe.primary} />
          </Pressable>
        </View>
        <Text style={[luxeType.caption, { textAlign: 'center', marginTop: 40 }]}>
          Kullanıcı bulunamadı.
        </Text>
      </SafeAreaView>
    );
  }

  const arch = getArchetype(user.archetypeId);
  const followed = followedIds.includes(user.id);
  const showcase = PERSONA_SHOWCASE[user.id];
  const userPosts = posts
    .filter((p) => p.userId === user.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const cell = Math.floor((width - GRID_PAD * 2 - GRID_GAP * 2) / 3);
  /**
   * Lookbook kartının içindeki kombin karosu — kart dolgusu da düşülüyor.
   * Sondaki -1: yuvarlama bir piksel taşırıp ikinci karoyu alt satıra
   * atıyordu (telefonda görüldü).
   */
  const lbCell = Math.floor((width - GRID_PAD * 2 - 28 - 10) / 2) - 1;

  const Stat = ({ n, label }: { n: number; label: string }) => (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{n.toLocaleString('tr-TR')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  /**
   * Öne çıkanlar — kendi profilimizdeki halkaların aynısı, ama burada
   * SEÇİLEBİLİR: dokununca o bölüm açılıyor, tekrar dokununca gönderilere
   * dönüyor.
   */
  const Highlight = ({
    icon,
    n,
    label,
    id: sec,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    n: number;
    label: string;
    id: Section;
  }) => {
    const on = section === sec;
    return (
      <Pressable
        style={styles.hl}
        onPress={() => setSection(on ? 'gonderi' : sec)}
      >
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

  /** Bir gönderi karosu — gönderi/kombin/selfie ızgaraları aynı karoyu kullanıyor. */
  const PostCell = ({ p }: { p: (typeof userPosts)[number] }) => (
    <Pressable
      style={[styles.cell, { width: cell, height: cell }]}
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id, user: user.id } })}
    >
      {p.coverGarment ? (
        /* Lookbook karosu TEK PARÇA: paylaşırken seçilen kapak. */
        <View style={styles.coverWrap}>
          {p.coverGarment.imageUri ? (
            <Image
              source={{ uri: p.coverGarment.imageUri }}
              style={{ width: '84%', height: '84%' }}
              contentFit="contain"
            />
          ) : (
            <GarmentArt
              category={p.coverGarment.category}
              subcategory={p.coverGarment.subcategory}
              colorId={p.coverGarment.colorId}
              size={cell * 0.7}
            />
          )}
        </View>
      ) : p.imageUri ? (
        <Image
          source={{ uri: p.imageUri }}
          style={{ width: cell, height: cell }}
          contentFit="contain"
        />
      ) : (
        <View style={{ width: cell }}>
          <FluidSpecCollage
            garments={p.garments}
            frame={p.canvasFrame}
            cropToContent={p.cropToContent}
            bare
          />
        </View>
      )}
      {/* Lookbook olduğu köşedeki kombin sayısından belli oluyor */}
      {p.kind === 'lookbook' ? (
        <View style={styles.lbBadge}>
          <Ionicons name="albums-outline" size={10} color={luxe.onDark} />
          <Text style={styles.lbBadgeText}>{outfitCount(p)}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={luxe.primary} />
        </Pressable>
        <Text style={styles.headerName} numberOfLines={1}>
          @{user.username}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + sayaçlar — kendi profilimizle aynı satır düzeni */}
        <View style={styles.topRow}>
          <Avatar user={user} size={84} />
          <View style={styles.stats}>
            {/*
              Instagram'daki üçlü: Gönderi · Takipçi · Takip. Üçüncü sayaç
              "Parça"ydı ama profil başlığında gardırop sayısı anlamsız
              duruyordu — o bilgi zaten aşağıdaki halkada.
            */}
            <Stat n={userPosts.length} label="Gönderi" />
            <Stat n={user.followers + (followed ? 1 : 0)} label="Takipçi" />
            <Stat n={user.following ?? 0} label="Takip" />
          </View>
        </View>

        <View style={styles.bioBlock}>
          <Text style={styles.name}>{user.name}</Text>
          {arch ? (
            <>
              <Text style={styles.archLine}>
                {arch.fish} · {arch.styleName} stil
              </Text>
              <Text style={styles.archNote} numberOfLines={2}>
                {arch.tagline}
              </Text>
            </>
          ) : null}
          {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
        </View>

        {/* Takip düğmesi — kendi profilimizdeki eylem satırının karşılığı */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.action, !followed && styles.actionSolid]}
            onPress={() => toggleFollow(user.id)}
          >
            <Text style={[styles.actionText, !followed && { color: luxe.onPrimary }]}>
              {followed ? 'Takiptesin' : 'Takip et'}
            </Text>
          </Pressable>
        </View>

        {/* Herkese açık gardırobu — öne çıkanlar halkaları */}
        {showcase ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hlRow}
          >
            <Highlight
              icon="albums-outline"
              n={userPosts.filter((p) => p.kind === 'kombin').length}
              label="Kombin"
              id="kombin"
            />
            <Highlight
              icon="happy-outline"
              n={userPosts.filter((p) => p.kind === 'selfie').length}
              label="Selfie"
              id="selfie"
            />
            <Highlight
              icon="book-outline"
              n={showcase.lookbooks.length}
              label="Lookbook"
              id="lookbook"
            />
            <Highlight
              icon="body-outline"
              n={userPosts.filter((p) => p.kind === 'tryon').length}
              label="Deneme"
              id="tryon"
            />
          </ScrollView>
        ) : null}

        <View style={styles.gridTop} />

        {/* ————— Gönderiler (varsayılan) ————— */}
        {section === 'gonderi' ? (
          userPosts.length === 0 ? (
            <Empty text="Henüz gönderi paylaşmamış." />
          ) : (
            <View style={styles.grid}>
              {userPosts.map((p) => (
                <PostCell key={p.id} p={p} />
              ))}
            </View>
          )
        ) : null}

        {/* ————— Kombin / Selfie gönderileri ————— */}
        {section === 'kombin' || section === 'selfie' || section === 'tryon' ? (
          (() => {
            const list = userPosts.filter((p) => p.kind === section);
            const adi =
              section === 'kombin' ? 'kombin' : section === 'selfie' ? 'selfie' : 'sanal deneme';
            return list.length === 0 ? (
              <Empty text={`Henüz ${adi} paylaşmamış.`} />
            ) : (
              <View style={styles.grid}>
                {list.map((p) => (
                  <PostCell key={p.id} p={p} />
                ))}
              </View>
            );
          })()
        ) : null}

        {/* ————— Lookbook'lar ————— */}
        {section === 'lookbook' ? (
          showcase?.lookbooks.length ? (
            /*
              Her lookbook TEK KART. Önce başlık + serbest kolajlar diziliyordu;
              "1 lookbook" yazarken ekranda iki kolaj görününce sayı yanlış
              sanılıyordu (telefonda görüldü). Kart, içindeki kombinleri
              kapsadığı için sayı da göz de aynı şeyi söylüyor.
            */
            <View style={{ gap: 14, paddingHorizontal: GRID_PAD }}>
              {showcase.lookbooks.map((lb) => (
                <Pressable
                  key={lb.name}
                  style={styles.lbCard}
                  onPress={() =>
                    setLbView({
                      title: lb.name,
                      sets: lb.outfits.map((x) => ({ garments: x })),
                      index: 0,
                    })
                  }
                >
                  <View style={styles.lbHead}>
                    <Text style={styles.lbName}>{lb.name}</Text>
                    <Text style={styles.lbMeta}>{lb.outfits.length} KOMBİN</Text>
                  </View>
                  <View style={styles.lbGrid}>
                    {lb.outfits.map((o, i) => (
                      <Pressable
                        key={i}
                        style={{ width: lbCell }}
                        onPress={() =>
                          setLbView({
                            title: lb.name,
                            sets: lb.outfits.map((x) => ({ garments: x })),
                            index: i,
                          })
                        }
                      >
                        {/*
                          `FluidSpecCollage` kapsayıcının genişliğini dolduruyor
                          ve ASLA taşmıyor — `SpecCollage` sabit ölçüde çizip
                          kutudan taşıyordu, kırpınca da kıyafetler sığmıyordu.
                        */}
                        <FluidSpecCollage garments={o} />
                      </Pressable>
                    ))}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <Empty text="Herkese açık lookbook'u yok." />
          )
        ) : null}
      </ScrollView>

      <LookbookViewer
        title={lbView?.title ?? ''}
        sets={lbView?.sets ?? []}
        index={lbView?.index ?? null}
        onIndex={(i) => setLbView((v) => (v ? { ...v, index: i } : v))}
        onClose={() => setLbView(null)}
      />
    </SafeAreaView>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="images-outline" size={26} color={luxe.outlineSoft} />
      <Text style={[luxeType.caption, { marginTop: 10 }]}>{text}</Text>
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

  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 18 },
  stats: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: font.display, fontSize: 19, lineHeight: 24, color: luxe.primary },
  statLabel: { fontFamily: font.body, fontSize: 11.5, color: luxe.outline },

  bioBlock: { paddingHorizontal: 18, marginTop: 14, gap: 2 },
  name: { fontFamily: font.headline, fontSize: 18, color: luxe.primary },
  archLine: {
    fontFamily: font.label,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: luxe.outline,
    marginTop: 3,
  },
  archNote: {
    fontFamily: font.body,
    fontStyle: 'italic',
    fontSize: 12.5,
    color: luxe.outline,
    marginTop: 2,
  },
  bio: { fontFamily: font.body, fontSize: 13.5, lineHeight: 20, color: luxe.inkSoft, marginTop: 6 },

  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 14 },
  action: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.sm,
    paddingVertical: 9,
  },
  actionSolid: { backgroundColor: luxe.primary, borderColor: luxe.primary },
  actionText: { fontFamily: font.bodyMedium, fontSize: 12.5, color: luxe.primary },

  hlRow: { gap: 18, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  hl: { alignItems: 'center', width: 68, gap: 5 },
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

  gridTop: { height: 14, borderTopWidth: 1, borderTopColor: luxe.outlineSoft, marginTop: 14 },
  /** Karo içindeki lookbook ızgarası — akıştaki kartın küçük hâli. */
  /*
    Karonun ÇERÇEVESİ YOK. Beyaz karo fildişi zeminde zaten kendi kendine
    ayrışıyor; üstüne bir de ince çizgi konunca ızgara kutucuk kutucuk
    görünüyordu ("gönderilerin etrafında çizgiler").
  */
  /** Tek parçalı kapak, karonun ortasında durur. */
  coverWrap: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: GRID_PAD,
    paddingTop: GRID_PAD,
  },
  cell: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: luxe.surface,
    borderRadius: luxeRadius.md,
  },

  /**
   * Lookbook rozeti — karonun sağ üst köşesinde parça sayısı.
   * Izgarada lookbook gönderisi diğerlerinden ayırt edilemiyordu; kapak
   * fotoğrafı konunca büsbütün sıradan bir kare gibi duruyor.
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
  lbCard: {
    backgroundColor: luxe.surface,
    borderRadius: luxeRadius.lg,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    padding: 14,
  },
  lbHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 10 },
  lbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  lbName: { flex: 1, fontFamily: font.headline, fontSize: 17, color: luxe.primary },
  lbMeta: {
    fontFamily: font.label,
    fontSize: 9,
    letterSpacing: 1.3,
    color: luxe.outline,
  },

  empty: { alignItems: 'center', paddingVertical: 42 },
});
