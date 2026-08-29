import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ActionSheet } from '@/components/ActionSheet';
import { FluidSpecCollage } from '@/components/Community';
import { OutfitCollage } from '@/components/OutfitCollage';
import cityData from '@/data/cities.json';
import { PERSONA_HOME } from '@/data/community';
import {
  COUNTRIES,
  WORLD_H,
  WORLD_W,
  countryPath,
  latToY,
  lonToX,
  nearestCountry,
  xToLon,
  yToLat,
} from '@/services/geo';
import { removeBackgroundLocal } from '@/services/localBgRemove';
import { resizeForProcessing } from '@/services/imageResize';
import { pickPhoto } from '@/services/photoPicker';
import { persistGarmentPhoto } from '@/services/photoStore';
import { useStore } from '@/store/useStore';
import { font, luxe, luxeType } from '@/theme/luxe';
import { todayISO } from '@/types';
import type { CommunityPost, Outfit, WardrobeItem } from '@/types';

/**
 * GLOBAL STİL HARİTASI — hangi ülkede ne giyiliyor.
 *
 * Her ülkeden EN ÇOK BEĞENİLEN tek gönderi haritada duruyor ve beğeni
 * sayısıyla büyüyor. Hepsini basmak haritayı kolaja çeviriyordu; "ülkenin
 * o anki görünüşü" tek bir kare olunca harita okunuyor.
 *
 * Neden kendi haritamız: `react-native-maps` native modül + API anahtarı
 * demek. Burada sınırlar zaten elimizde (Natural Earth, kamu malı) ve
 * stilize çizim uygulamanın diline daha yakın duruyor.
 */

/** Beğeniyi piksele çeviren ölçek — kök alınıyor ki 3000 beğeni ekranı yutmasın. */
const markerSize = (likes: number) => 60 + Math.sqrt(Math.max(0, likes)) * 4.5;

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 22;
/** Açılışta kullanıcının çevresi — şehir ölçeğine yakın. */
const START_ZOOM = 6;

interface City {
  /** ad */ n: string;
  /** ülke kodu */ c: string;
  /** boylam */ x: number;
  /** enlem */ y: number;
  /** nüfus (bin) */ p: number;
  /** kademe: 0 dünya, 1 kıta, 2 yakın */ t: number;
}

const CITIES = (cityData as { cities: City[] }).cities;

/** Hangi yakınlıkta hangi kademeye kadar şehir açılıyor. */
const cityTierFor = (z: number) => (z < 1.4 ? 0 : z < 4 ? 1 : 2);
/** Aynı anda ekranda duracak en fazla etiket — üstü hem kalabalık hem ağır. */
const CITY_LIMIT = 55;

/**
 * DEMO yerleşimi: kullanıcının kendi son kombinleri dünyaya dağıtılıyor.
 * Harita boşken ne yaptığı anlaşılmıyor; uydurma model fotoğrafı koymak
 * yerine kullanıcının GERÇEK kombinleri gösteriliyor. Gerçek bir gönderi
 * aynı ülkeye düşerse demo kare yerini ona bırakıyor.
 */
const DEMO_CITIES = [
  { city: 'Paris', lat: 48.8566, lon: 2.3522 },
  { city: 'Milano', lat: 45.4642, lon: 9.19 },
  { city: 'Londra', lat: 51.5074, lon: -0.1278 },
  { city: 'New York', lat: 40.7128, lon: -74.006 },
  { city: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { city: 'Seul', lat: 37.5665, lon: 126.978 },
  { city: 'Berlin', lat: 52.52, lon: 13.405 },
  { city: 'Dubai', lat: 25.2048, lon: 55.2708 },
];

/** Kimlikten türeyen sabit "beğeni" — demo kareler farklı boylarda dursun. */
const seedLikes = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 40 + (h % 320);
};

interface Marker {
  key: string;
  post?: CommunityPost;
  /** Demo kare: kullanıcının kendi kombini. */
  outfit?: { items: WardrobeItem[]; layout?: Outfit['layout'] };
  lon: number;
  lat: number;
  city?: string;
  country: string;
  size: number;
}

export default function World() {
  const { posts, profile, outfits, items, sharePost, addSelfie } = useStore();
  const { width, height } = useWindowDimensions();

  /* Sınırlar bir kez: 177 yol her karede üretilecek şey değil. */
  const paths = useMemo(() => COUNTRIES.map(countryPath), []);

  /**
   * Gönderinin YERİ. Kendi gönderilerin profildeki şehirden (hava durumu
   * için zaten seçili), persona gönderileri kendi memleketlerinden geliyor.
   * Konumu bilinmeyen gönderi haritaya çıkmıyor — uydurma nokta koymuyoruz.
   */
  const placeOf = React.useCallback(
    (p: CommunityPost) => {
      if (p.place) return p.place;
      if (p.userId === 'me') {
        return profile.lat != null && profile.lon != null
          ? { lat: profile.lat, lon: profile.lon, city: profile.city }
          : undefined;
      }
      return PERSONA_HOME[p.userId];
    },
    [profile.lat, profile.lon, profile.city],
  );

  const markers = useMemo<Marker[]>(() => {
    const best = new Map<string, Marker>();
    for (const post of posts) {
      // Görseli olmayan gönderi haritada bir şey anlatmıyor
      if (!post.imageUri && !post.garments?.length && !post.outfitSets?.length) continue;
      const place = placeOf(post);
      if (!place) continue;
      const country =
        place.country ?? nearestCountry(place.lon, place.lat)?.name ?? `${place.lat},${place.lon}`;
      const likes = post.likes + (post.likedByMe ? 1 : 0);
      const cur = best.get(country);
      const curLikes = cur?.post ? cur.post.likes + (cur.post.likedByMe ? 1 : 0) : -1;
      if (likes > curLikes) {
        best.set(country, {
          key: post.id,
          post,
          lon: place.lon,
          lat: place.lat,
          city: place.city,
          country,
          size: markerSize(likes),
        });
      }
    }

    /* Demo: son 8 kombin, gerçek gönderi olmayan şehirlere. */
    outfits.slice(0, DEMO_CITIES.length).forEach((o, i) => {
      const spot = DEMO_CITIES[i];
      const country = nearestCountry(spot.lon, spot.lat)?.name ?? spot.city;
      if (best.has(country)) return;
      const outfitItems = o.itemIds
        .map((id) => items.find((it) => it.id === id))
        .filter(Boolean) as WardrobeItem[];
      if (!outfitItems.length) return;
      best.set(country, {
        key: `demo-${o.id}`,
        outfit: { items: outfitItems, layout: o.layout },
        lon: spot.lon,
        lat: spot.lat,
        city: spot.city,
        country,
        size: markerSize(seedLikes(o.id)),
      });
    });

    return [...best.values()];
  }, [posts, placeOf, outfits, items]);

  /* ————— Kaydırma ve yakınlaştırma —————
     Değerler ref'te tutuluyor, PanResponder BİR KEZ kuruluyor (bkz. AGENTS.md:
     prop'u bağımlılığa koyunca hareketin ortasında yeni algılayıcı doğuyor ve
     dx sıfırlanıyor). Ekran = konum + dünya × yakınlık. */
  const zoom = useRef(new Animated.Value(START_ZOOM)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const state = useRef({ x: 0, y: 0, z: START_ZOOM });

  /** Açılış: kullanıcının konumu ekranın ortasında. */
  const start = useMemo(() => {
    const lon = profile.lon ?? 28.98;
    const lat = profile.lat ?? 41.01;
    return {
      x: width / 2 - lonToX(lon) * START_ZOOM,
      y: height / 2 - latToY(lat) * START_ZOOM,
    };
  }, [profile.lon, profile.lat, width, height]);

  /*
    Şehir etiketleri için "işlenmiş görünüm". Kaydırma sırasında state
    yazılmıyor (yazsak her karede 700 şehir yeniden süzülür ve harita
    kasardı) — parmak kalkınca bir kez güncelleniyor, aradaki kısa boşluk
    fark edilmiyor.
  */
  const [view, setView] = React.useState({ lon: 28.98, lat: 41.01, z: START_ZOOM });
  const commitView = React.useCallback(() => {
    const { x, y, z } = state.current;
    setView((v) => {
      const lon = xToLon((width / 2 - x) / z);
      const lat = yToLat((height / 2 - y) / z);
      if (Math.abs(v.z - z) < 0.05 && Math.abs(v.lon - lon) < 0.2 && Math.abs(v.lat - lat) < 0.2) {
        return v;
      }
      return { lon, lat, z };
    });
  }, [width, height]);

  /** Görünen pencereye düşen, kademesi uygun, en kalabalık şehirler. */
  const cities = useMemo(() => {
    const halfLon = ((width / view.z) * 360) / WORLD_W / 2;
    const halfLat = ((height / view.z) * 180) / WORLD_H / 2;
    const tier = cityTierFor(view.z);
    const near: City[] = [];
    for (const c of CITIES) {
      if (c.t > tier) continue;
      if (Math.abs(c.x - view.lon) > halfLon || Math.abs(c.y - view.lat) > halfLat) continue;
      near.push(c);
      if (near.length > 400) break;
    }
    near.sort((a, b) => b.p - a.p);
    /*
      Etiket seyreltme: kalabalık şehirden başlayıp, seçilmiş bir etikete
      ~80 piksel yakın olanları atıyoruz. Marmara'da altı şehir üst üste
      binip okunmaz bir yığın oluyordu (cihazda görüldü).
    */
    const minDeg = ((80 / view.z) * 360) / WORLD_W;
    const out: City[] = [];
    for (const c of near) {
      if (
        out.some(
          (o) => Math.abs(o.x - c.x) < minDeg && Math.abs(o.y - c.y) < minDeg * 0.55,
        )
      ) {
        continue;
      }
      out.push(c);
      if (out.length >= CITY_LIMIT) break;
    }
    return out;
  }, [view, width, height]);

  const gesture = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startZ: 1,
    startDist: 0,
    anchorX: 0,
    anchorY: 0,
  });

  /*
    ⚠️ RN'de `scale` görünümün MERKEZİ etrafında çalışıyor, sol üst köşesi
    etrafında değil. Matematik "ekran = konum + dünya × yakınlık" varsayıyor;
    aradaki fark merkez × (1 − yakınlık) kadar sabit bir kayma ve düzeltmezsen
    yakınlaştıkça harita ekrandan kayıyor (cihazda görüldü: dünya görünümünde
    Afrika'yı istedik, Amerika geldi). Durum "istenen" uzayda tutuluyor,
    düzeltme yalnızca göze giden değere uygulanıyor.
  */
  const apply = React.useCallback(
    (x: number, y: number, z: number) => {
      state.current = { x, y, z };
      pan.setValue({ x: x - (WORLD_W / 2) * (1 - z), y: y - (WORLD_H / 2) * (1 - z) });
      zoom.setValue(z);
    },
    [pan, zoom],
  );

  React.useEffect(() => {
    apply(start.x, start.y, START_ZOOM);
  }, [start, apply]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
        onPanResponderGrant: (e) => {
          const t = e.nativeEvent.touches;
          const g = gesture.current;
          // Başlangıç BİR KEZ donuyor: grant ikinci kez çalışırsa hareket
          // birikip harita fırlıyor (Canvas'ta ölçüldü).
          if (g.active) return;
          g.active = true;
          g.startX = state.current.x;
          g.startY = state.current.y;
          g.startZ = state.current.z;
          if (t.length >= 2) {
            const [a, b] = t;
            g.startDist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) || 1;
            const mx = (a.pageX + b.pageX) / 2;
            const my = (a.pageY + b.pageY) / 2;
            // Parmakların ortasındaki DÜNYA noktası sabit kalmalı
            g.anchorX = (mx - g.startX) / g.startZ;
            g.anchorY = (my - g.startY) / g.startZ;
          }
        },
        onPanResponderMove: (e, gs) => {
          const t = e.nativeEvent.touches;
          const g = gesture.current;
          if (t.length >= 2) {
            const [a, b] = t;
            const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) || 1;
            if (!g.startDist) {
              // İkinci parmak sonradan indi: çapayı şimdi kur
              g.startDist = dist;
              g.startZ = state.current.z;
              const mx0 = (a.pageX + b.pageX) / 2;
              const my0 = (a.pageY + b.pageY) / 2;
              g.anchorX = (mx0 - state.current.x) / state.current.z;
              g.anchorY = (my0 - state.current.y) / state.current.z;
              g.startX = state.current.x;
              g.startY = state.current.y;
            }
            const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (g.startZ * dist) / g.startDist));
            const mx = (a.pageX + b.pageX) / 2;
            const my = (a.pageY + b.pageY) / 2;
            apply(mx - g.anchorX * z, my - g.anchorY * z, z);
          } else {
            g.startDist = 0; // tek parmağa döndük
            apply(g.startX + gs.dx, g.startY + gs.dy, state.current.z);
          }
        },
        onPanResponderRelease: () => {
          gesture.current.active = false;
          gesture.current.startDist = 0;
          commitView();
        },
        onPanResponderTerminate: () => {
          gesture.current.active = false;
          gesture.current.startDist = 0;
          commitView();
        },
      }),
    // Algılayıcı BİR KEZ kurulur; güncel değerler ref'ten okunuyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /*
    Ölçek numarası YOK: işaretçi ve etiket boyutları işlenmiş yakınlıktan
    hesaplanıyor. Animated bir `scale` denendi — RN'de ölçek görünümün
    MERKEZİ etrafında çalıştığı için fotoğrafın ayakları koordinattan
    kayıyordu ve düzeltmesi her seferinde biraz tutmuyordu (haritada
    ölçüldü). Boyutu doğrudan yazınca çapa TAM: kutunun altı = nokta.

    Bedeli: parmak kalkana kadar işaretçiler haritayla birlikte büyüyor,
    sonra yerine oturuyor. Gerçek haritalarda da böyle.
  */
  const zk = view.z;
  /** Ekranda görünmesi istenen boy → dünya birimine çevriliyor. */
  const onScreen = (size: number) =>
    (size * Math.min(1.15, Math.max(0.4, 0.42 * Math.pow(zk, 0.18)))) / zk;
  const labelPx = Math.min(13, Math.max(9, 11)) / zk;
  const dotPx = 5 / zk;

  /*
    Haritaya selfie ekleme. Arka plan SİLİNİYOR: harita ancak kesilmiş
    karelerle "insan haritada duruyor" gibi görünüyor. Kare aynı zamanda
    toplulukta paylaşılıyor — harita ve akış aynı içeriği gösteriyor.
    Konum, haritanın o anki merkezi: kullanıcı nereye bakıyorsa oraya
    bırakıyor.
  */
  const [sheet, setSheet] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const addSelfieHere = async (fromCamera: boolean) => {
    setSheet(false);
    const photo = await pickPhoto({ fromCamera, aspect: [3, 4], quality: 0.6, purpose: 'selfie' });
    if (!photo) return;
    setBusy(true);
    try {
      const small = await resizeForProcessing(photo.uri, photo.width, photo.height, 1400);
      const saved = await persistGarmentPhoto(small).catch(() => small);
      const cut = await removeBackgroundLocal(small).catch(() => null);
      const cutoutUri = cut ? await persistGarmentPhoto(cut).catch(() => undefined) : undefined;
      addSelfie({ imageUri: saved, cutoutUri, date: todayISO() });
      sharePost({
        kind: 'selfie',
        caption: view.z > 3 ? `${profile.city ?? ''}`.trim() : '',
        garments: [],
        imageUri: cutoutUri ?? saved,
        archetypeId: profile.bettaArchetypeId,
        place: { lat: view.lat, lon: view.lon, city: profile.city },
      });
    } finally {
      setBusy(false);
    }
  };

  const goTo = (lon: number, lat: number, z: number) => {
    apply(width / 2 - lonToX(lon) * z, height / 2 - latToY(lat) * z, z);
    setView({ lon, lat, z });
  };

  return (
    <View style={styles.screen}>
      {/* Harita katmanı: dünya tek bir görünüm, hareket onun üstünde */}
      <Animated.View
        {...responder.panHandlers}
        style={[
          styles.world,
          {
            width: WORLD_W,
            height: WORLD_H,
            transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: zoom }],
          },
        ]}
      >
        {/*
          Kara parçaları tek SVG. Ölçek görünüme uygulandığı için yollar
          yeniden çizilmiyor — kaydırma ve yakınlaştırma bedavaya geliyor.
        */}
        <Svg width={WORLD_W} height={WORLD_H} style={styles.map}>
          {paths.map((d, i) => (
            <Path key={i} d={d} fill="#332B30" stroke="rgba(255,255,255,0.13)" strokeWidth={0.6} />
          ))}
        </Svg>

        {/*
          Şehirler: nokta + ad. Sokak dokusu YOK — kullanıcı "sokak sokak
          gerekmez, şehirler olsun" dedi ve karo haritası hem ağ hem bellek
          demekti. Etiketler haritayla büyümüyor (ters ölçek), yoksa
          yakınlaşınca ekranı yazı kaplıyor.
        */}
        {cities.map((c) => (
          <View
            key={`${c.n}-${c.c}`}
            style={[styles.city, { left: lonToX(c.x), top: latToY(c.y), marginTop: -dotPx / 2 }]}
            pointerEvents="none"
          >
            <View
              style={[
                styles.cityDot,
                { width: dotPx, height: dotPx, borderRadius: dotPx / 2 },
              ]}
            />
            <Text
              style={[styles.cityName, { fontSize: labelPx, marginTop: labelPx * 0.25 }]}
              numberOfLines={1}
            >
              {c.n}
            </Text>
          </View>
        ))}

        {markers.map((m) => {
          const w = onScreen(m.size);
          const h = w * 1.25;
          return (
            <View
              key={m.key}
              /* Kutunun ALTI koordinatta: fotoğraf haritanın üstünde duruyor. */
              style={[styles.marker, { left: lonToX(m.lon) - w / 2, top: latToY(m.lat) - h, width: w }]}
            >
              <Pressable
                onPress={() =>
                  m.post
                    ? router.push({ pathname: '/post/[id]', params: { id: m.post.id } })
                    : undefined
                }
                style={{ width: w, height: h }}
              >
                {m.outfit ? (
                  <OutfitCollage items={m.outfit.items} size={w} layout={m.outfit.layout} bare />
                ) : m.post?.imageUri ? (
                  <Image
                    source={{ uri: m.post.imageUri }}
                    style={styles.shot}
                    /* Arka planı silinmiş kare: ASLA kırpma — `contain`. */
                    contentFit="contain"
                  />
                ) : (
                  <FluidSpecCollage
                    garments={
                      m.post?.outfitSets?.[0]?.garments?.length
                        ? m.post.outfitSets[0].garments
                        : (m.post?.garments ?? [])
                    }
                    frame={m.post?.canvasFrame}
                    cropToContent={m.post?.cropToContent}
                    bare
                  />
                )}
              </Pressable>
              {m.city ? (
                <Text
                  style={[styles.markerCity, { fontSize: labelPx * 0.85 }]}
                  numberOfLines={1}
                >
                  {m.city}
                </Text>
              ) : null}
            </View>
          );
        })}
      </Animated.View>

      {/* Üst bar — harita tam ekran, başlık üstüne biniyor */}
      <SafeAreaView style={styles.top} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={luxe.onDark} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Global stil</Text>
            <Text style={styles.sub}>
              {markers.length} ülkeden en beğenilen kombin · yakınlaştırmak için iki parmak
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Alt sol: haritaya kendi selfie'ni bırak */}
      <View style={styles.addWrap} pointerEvents="box-none">
        <Pressable style={styles.addBtn} onPress={() => setSheet(true)} disabled={busy}>
          <Ionicons name={busy ? 'hourglass-outline' : 'add'} size={18} color={luxe.primary} />
          <Text style={styles.addText}>{busy ? 'Ekleniyor…' : 'Selfie ekle'}</Text>
        </Pressable>
        <Text style={styles.credit}>Sınırlar: Natural Earth · Şehirler: GeoNames</Text>
      </View>

      <ActionSheet
        visible={sheet}
        title="Haritaya selfie ekle"
        onClose={() => setSheet(false)}
        actions={[
          { label: 'Fotoğraf çek', icon: 'camera-outline', onPress: () => addSelfieHere(true) },
          { label: 'Galeriden seç', icon: 'images-outline', onPress: () => addSelfieHere(false) },
        ]}
      />

      {/* Alt sağ: konumuma dön / dünyayı gör */}
      <View style={styles.tools} pointerEvents="box-none">
        <Pressable
          style={styles.tool}
          onPress={() => goTo(profile.lon ?? 28.98, profile.lat ?? 41.01, START_ZOOM)}
        >
          <Ionicons name="navigate" size={17} color={luxe.onDark} />
        </Pressable>
        <Pressable style={styles.tool} onPress={() => goTo(10, 20, MIN_ZOOM)}>
          <Ionicons name="globe-outline" size={17} color={luxe.onDark} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Koyu zemin: arka planı silinmiş kareler ancak koyu suyun üstünde parlıyor. */
  screen: { flex: 1, backgroundColor: '#121014', overflow: 'hidden' },
  world: { position: 'absolute', left: 0, top: 0 },
  map: { position: 'absolute', left: 0, top: 0 },
  marker: { position: 'absolute', alignItems: 'center' },
  /** Şehir: küçük nokta + adı. Nokta koordinatın TAM üstünde. */
  city: { position: 'absolute', alignItems: 'center', width: 160, marginLeft: -80 },
  cityDot: { backgroundColor: 'rgba(255,255,255,0.55)' },
  cityName: { fontFamily: font.bodyMedium, color: 'rgba(255,255,255,0.62)' },
  shot: { width: '100%', height: '100%' },
  /**
   * Fotoğrafın altındaki şehir adı.
   * ⚠️ MUTLAK konumlu: akışta kalsa kutunun yüksekliğini büyütüyor ve
   * "ayaklar koordinatta" çapası kayıyordu (haritada ölçüldü: fotoğraf
   * İstanbul'un ~3° kuzeyinde duruyordu).
   */
  markerCity: {
    position: 'absolute',
    top: '100%',
    left: -60,
    right: -60,
    textAlign: 'center',
    fontFamily: font.label,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  top: { position: 'absolute', left: 0, right: 0, top: 0 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  title: { ...luxeType.headline, color: luxe.onDark, fontSize: 20 },
  sub: { fontFamily: font.body, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  addWrap: { position: 'absolute', left: 16, bottom: 34, gap: 8, alignItems: 'flex-start' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  addText: { fontFamily: font.bodyMedium, fontSize: 13, color: luxe.primary },
  /** Veri kaynağı bilgisi — kamu malı veriler atıf istiyor. */
  credit: { fontFamily: font.body, fontSize: 8.5, color: 'rgba(255,255,255,0.35)' },
  tools: { position: 'absolute', right: 16, bottom: 34, gap: 10 },
  tool: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});
