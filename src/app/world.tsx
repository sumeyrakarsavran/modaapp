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
import type { CommunityPost } from '@/types';

/**
 * GLOBAL STİL HARİTASI — hangi ülkede ne giyiliyor.
 *
 * Haritada YALNIZCA toplulukta paylaşılanlar var. Paylaşılmamış kombin
 * global haritada görünmüyor; kendi kombinin de ancak paylaştığında
 * çıkıyor ve dokununca gönderi olarak açılıyor.
 *
 * Neden kendi haritamız: `react-native-maps` native modül + API anahtarı
 * demek. Burada sınırlar zaten elimizde (Natural Earth, kamu malı) ve
 * stilize çizim uygulamanın diline daha yakın duruyor.
 */

/**
 * HARİTA DÜZENİ — kaç kare, hangisi, ne kadar büyük.
 *
 * Üç kural birlikte çalışıyor:
 * 1. BÖLGE BİRİNCİSİ. Harita bir ızgaraya bölünüyor; her gözden yalnızca en
 *    çok beğenilen kare çıkıyor. Göz boyu EKRANDA sabit (~130px), yani
 *    dünya görünümünde bir göz koca bir bölge, yakınlaştıkça şehir oluyor —
 *    "yaklaştıkça o bölgenin birincileri" kendiliğinden geliyor.
 * 2. SIRALAMA. Kazananlar beğeniye göre sıralanıp en fazla 40 tanesi
 *    çiziliyor; harita kalabalıklaşmıyor.
 * 3. BOYUT. Birinci en büyük, sonrakiler kademeli olarak küçülüyor
 *    (sıraya göre ~%100 → %58). Taban boy yakınlaştıkça büyüyor ama
 *    ekranı kapatmayacak kadar.
 */
const MAX_MARKERS = 40;
/** İki kare arasındaki en küçük EKRAN mesafesi — üst üste binmesinler. */
const CELL_PX = 96;

/** Taban boy (ekran pikseli): uzakta ölçülü, yaklaşınca büyüyor. */
const baseSize = (z: number) => Math.min(150, Math.max(72, 72 * Math.pow(z, 0.18)));
/** Sıraya göre küçülme: birinci tam boy, sonuncusu ~%58. */
const rankScale = (i: number, n: number) =>
  n <= 1 ? 1 : 1 - 0.42 * Math.pow(i / (n - 1), 0.7);

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

interface Marker {
  key: string;
  post: CommunityPost;
  lon: number;
  lat: number;
  city?: string;
  country: string;
  size: number;
}

export default function World() {
  const { posts, profile, sharePost, addSelfie } = useStore();
  const { width, height } = useWindowDimensions();

  /* Sınırlar bir kez: 177 yol her karede üretilecek şey değil. */
  const paths = useMemo(() => COUNTRIES.map(countryPath), []);

  /* ————— Kaydırma ve yakınlaştırma —————
     Değerler ref'te tutuluyor, PanResponder BİR KEZ kuruluyor (bkz. AGENTS.md:
     prop'u bağımlılığa koyunca hareketin ortasında yeni algılayıcı doğuyor ve
     dx sıfırlanıyor). Ekran = konum + dünya × yakınlık. */
  const zoom = useRef(new Animated.Value(START_ZOOM)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const state = useRef({ x: 0, y: 0, z: START_ZOOM });

  /*
    Şehir etiketleri için "işlenmiş görünüm". Kaydırma sırasında state
    yazılmıyor (yazsak her karede 700 şehir yeniden süzülür ve harita
    kasardı) — parmak kalkınca bir kez güncelleniyor, aradaki kısa boşluk
    fark edilmiyor.
  */
  const [view, setView] = React.useState({ lon: 28.98, lat: 41.01, z: START_ZOOM });

/**
 * Yeri OLMAYAN eski paylaşımlar için şehir dağılımı.
 *
 * Artık paylaşırken şehir zorunlu; ama bu kural gelmeden önce paylaşılan
 * gönderilerde yer yok ve hepsi tek noktaya yığılıyor. Kullanıcı "farklı
 * şehirler seçmişim gibi yapabilirsin" dedi: bu eski gönderiler sırayla
 * bu şehirlere dağıtılıyor. Yeni paylaşımlar kendi şehriyle geliyor,
 * buraya hiç uğramıyor.
 */
const SPREAD_CITIES: { city: string; lat: number; lon: number }[] = [
  { city: 'Paris', lat: 48.8566, lon: 2.3522 },
  { city: 'Milano', lat: 45.4642, lon: 9.19 },
  { city: 'Londra', lat: 51.5074, lon: -0.1278 },
  { city: 'New York', lat: 40.7128, lon: -74.006 },
  { city: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { city: 'Seul', lat: 37.5665, lon: 126.978 },
  { city: 'Berlin', lat: 52.52, lon: 13.405 },
  { city: 'Dubai', lat: 25.2048, lon: 55.2708 },
];

/**
 * Gönderinin YERİ. Kendi gönderilerin profildeki şehirden (hava durumu
   * için zaten seçili), persona gönderileri kendi memleketlerinden geliyor.
   * Konumu bilinmeyen gönderi haritaya çıkmıyor — uydurma nokta koymuyoruz.
   */
  /** Yersiz eski gönderilerin dağıtımı — sıra sabit kalsın diye tek seferde. */
  const spread = useMemo(() => {
    const map = new Map<string, (typeof SPREAD_CITIES)[number]>();
    let i = 0;
    for (const p of [...posts].reverse()) {
      if (p.place || p.userId !== 'me') continue;
      map.set(p.id, SPREAD_CITIES[i % SPREAD_CITIES.length]);
      i++;
    }
    return map;
  }, [posts]);

  const placeOf = React.useCallback(
    (p: CommunityPost) => {
      if (p.place) return p.place;
      if (p.userId === 'me') return spread.get(p.id);
      return PERSONA_HOME[p.userId];
    },
    [spread],
  );

  /**
   * Görünen kareler. `view` işlendiğinde (parmak kalkınca) hesaplanıyor:
   * kaydırma sırasında 40 kareyi yeniden seçmek haritayı kasardı.
   */
  const markers = useMemo<Marker[]>(() => {
    /* Adaylar: gerçek gönderiler + demo olarak dağıtılmış kendi kombinlerin. */
    type Cand = {
      key: string;
      likes: number;
      lon: number;
      lat: number;
      city?: string;
      post: CommunityPost;
    };
    const cands: Cand[] = [];

    for (const post of posts) {
      if (!post.imageUri && !post.garments?.length && !post.outfitSets?.length) continue;
      const place = placeOf(post);
      if (!place) continue;
      cands.push({
        key: post.id,
        likes: post.likes + (post.likedByMe ? 1 : 0),
        lon: place.lon,
        lat: place.lat,
        city: place.city,
        post,
      });
    }

    /* Görünen pencere + bir ekran pay: kenardan girenler hazır dursun. */
    const halfLon = (((width * 1.5) / view.z) * 360) / WORLD_W / 2;
    const halfLat = (((height * 1.5) / view.z) * 180) / WORLD_H / 2;

    /*
      Seçim: ÖNCE en çok beğenilen. Sırayla ilerlerken, daha önce
      yerleştirilmiş bir karenin dibine düşen aday atlanıyor — böylece her
      bölgenin birincisi kendiliğinden çıkıyor, kalan yerleri de sıradaki
      kombinler dolduruyor. Izgaraya bölmek denendi: bir gözde iki iyi
      kombin varsa ikincisi hiç görünmüyordu.
    */
    const inView = cands.filter(
      (c) => Math.abs(c.lon - view.lon) <= halfLon && Math.abs(c.lat - view.lat) <= halfLat,
    );
    inView.sort((a, b) => b.likes - a.likes);

    /** İki kare arasındaki en küçük mesafe (ekran pikseli → derece). */
    const gapLon = ((CELL_PX / view.z) * 360) / WORLD_W;
    const gapLat = ((CELL_PX / view.z) * 180) / WORLD_H;
    const chosen: Cand[] = [];
    for (const c of inView) {
      if (
        chosen.some(
          (o) => Math.abs(o.lon - c.lon) < gapLon && Math.abs(o.lat - c.lat) < gapLat,
        )
      ) {
        continue;
      }
      chosen.push(c);
      if (chosen.length >= MAX_MARKERS) break;
    }

    const ranked = chosen;
    const base = baseSize(view.z);
    return ranked.map((c, i) => ({
      key: c.key,
      post: c.post,
      lon: c.lon,
      lat: c.lat,
      city: c.city,
      country: '',
      size: base * rankScale(i, ranked.length),
    }));
  }, [posts, placeOf, view, width, height]);

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
    lastTapAt: 0,
    lastTapX: 0,
    lastTapY: 0,
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

  /** Açılış: kullanıcının konumu ekranın ortasında. */
  React.useEffect(() => {
    const lon = profile.lon ?? 28.98;
    const lat = profile.lat ?? 41.01;
    apply(
      width / 2 - lonToX(lon) * START_ZOOM,
      height / 2 - latToY(lat) * START_ZOOM,
      START_ZOOM,
    );
    setView({ lon, lat, z: START_ZOOM });
  }, [profile.lon, profile.lat, width, height, apply]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
        onPanResponderGrant: (e) => {
          const t = e.nativeEvent.touches;
          const g = gesture.current;
          /*
            ÇİFT DOKUNUŞ = yakınlaş. İki parmak her zaman elverişli değil
            (tek elle gezerken) ve haritalarda beklenen davranış bu.
            Dokunulan nokta sabit kalıyor: parmağın altındaki şehir kaçmasın.
          */
          if (t.length === 1) {
            const now = Date.now();
            const { pageX, pageY } = t[0];
            const near =
              Math.abs(pageX - g.lastTapX) < 40 && Math.abs(pageY - g.lastTapY) < 40;
            if (now - g.lastTapAt < 320 && near) {
              const z = Math.min(MAX_ZOOM, state.current.z * 1.9);
              const wx = (pageX - state.current.x) / state.current.z;
              const wy = (pageY - state.current.y) / state.current.z;
              apply(pageX - wx * z, pageY - wy * z, z);
              commitView();
              g.lastTapAt = 0;
              return;
            }
            g.lastTapAt = now;
            g.lastTapX = pageX;
            g.lastTapY = pageY;
          }
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
    [apply, commitView],
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
            style={[
              styles.city,
              {
                left: lonToX(c.x),
                top: latToY(c.y),
                transformOrigin: 'top center',
                transform: [{ scale: 1 / view.z }],
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.cityDot} />
            <Text style={styles.cityName} numberOfLines={1}>
              {c.n}
            </Text>
          </View>
        ))}

        {markers.map((m) => {
          /*
            ⚠️ KALİTE. Kutu, EKRAN pikseli boyunda yerleşiyor ve `1/yakınlık`
            ile küçültülüyor. Doğrudan dünya biriminde (küçük) yerleştirip
            haritayla büyütmek fotoğrafı bulanıklaştırıyordu: küçük kutuya
            çizilen görüntü sonra ölçekle büyütülüyordu (cihazda görüldü —
            "yaklaştıkça kalitesi azalıyor"). Böyle çizim tam çözünürlükte
            yapılıp KÜÇÜLTÜLÜYOR, yani hep keskin.
            `transformOrigin` alt-orta: ölçek değişse de ayaklar koordinatta.
          */
          const w = m.size;
          const h = w * 1.25;
          const k = 1 / view.z;
          return (
            <View
              key={m.key}
              style={[
                styles.marker,
                {
                  left: lonToX(m.lon) - w / 2,
                  top: latToY(m.lat) - h,
                  width: w,
                  transformOrigin: 'bottom center',
                  transform: [{ scale: k }],
                },
              ]}
            >
              <Pressable
                /* Her kare bir GÖNDERİ: dokununca toplulukta göründüğü
                   haliyle açılıyor — senin kombinin de olsa. */
                onPress={() => router.push({ pathname: '/post/[id]', params: { id: m.post.id } })}
                style={{ width: w, height: h }}
              >
                {m.post.imageUri ? (
                  <Image
                    source={{ uri: m.post.imageUri }}
                    style={styles.shot}
                    /* Arka planı silinmiş kare: ASLA kırpma — `contain`. */
                    contentFit="contain"
                  />
                ) : (
                  <FluidSpecCollage
                    garments={
                      m.post.outfitSets?.[0]?.garments?.length
                        ? m.post.outfitSets[0].garments
                        : m.post.garments
                    }
                    frame={m.post.canvasFrame}
                    cropToContent={m.post.cropToContent}
                    bare
                  />
                )}
              </Pressable>
              {/*
                Karenin altına şehir adı YAZILMIYOR: haritanın kendi şehir
                etiketi zaten orada duruyor ve ikisi üst üste binip "NEW
                YORK New York" gibi okunuyordu (cihazda görüldü).
              */}
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
              {markers.length} paylaşım · çift dokun ya da iki parmakla yakınlaş
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/*
        Boş bölge: harita bomboş görünüyorsa sebebi söylenmeli — kullanıcı
        "çalışmıyor mu?" diye düşünmesin.
      */}
      {markers.length === 0 ? (
        <View style={styles.emptyWrap} pointerEvents="none">
          <Text style={styles.emptyText}>Bu bölgede paylaşım yok — uzaklaş ya da gez</Text>
        </View>
      ) : null}

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
  city: { position: 'absolute', alignItems: 'center', width: 170, marginLeft: -85, marginTop: -3 },
  cityDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  cityName: {
    fontFamily: font.bodyMedium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
    marginTop: 3,
  },
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
  emptyWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '46%',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: font.body,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: 'hidden',
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
