import world from '@/data/world.json';

/**
 * Harita matematiği — tek yerden.
 *
 * İki izdüşüm var, ikisi de aynı veriden (Natural Earth 110m, kamu malı;
 * `scripts/build-world.js` üretiyor):
 * - EŞDİKDÖRTGEN (equirectangular): harita ekranı. Enlem/boylam doğrudan
 *   x/y'ye gidiyor, ters çevirmesi de bir bölme — dokunulan noktanın hangi
 *   koordinat olduğunu bulmak bedava.
 * - ORTOGRAFİK: küre. Uzaydan bakış; kürenin arkasında kalan ülkeler
 *   eleniyor.
 */

export interface CountryShape {
  id: string | number;
  name: string;
  /** Gövde merkezi [lon, lat] — fotoğraf buraya oturuyor. */
  c: [number, number];
  /** Dış halkalar: [[lon, lat], …] */
  p: [number, number][][];
}

export const COUNTRIES = (world as { countries: CountryShape[] }).countries;

/**
 * Ülke sınır kutuları — görünen pencereye düşmeyen ülkeyi hiç çizmemek için.
 * 169 ülkenin hepsini her yeniden çizimde SVG'ye vermek, yakınlaşınca
 * haritanın geç oturmasına yol açıyordu (cihazda görüldü: "kaydırıp
 * büyütünce geç yükleniyor"). Şehir ölçeğinde ekranda 2-5 ülke kalıyor.
 */
export const COUNTRY_BOX = new Map<CountryShape, [number, number, number, number]>();
for (const c of COUNTRIES) {
  let minX = 180,
    maxX = -180,
    minY = 90,
    maxY = -90;
  for (const ring of c.p) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  COUNTRY_BOX.set(c, [minX, minY, maxX, maxY]);
}

/** Yol dizeleri PAHALI: ülke başına bir kez üretilip saklanıyor. */
const PATH_CACHE = new Map<CountryShape, string>();
export function cachedCountryPath(c: CountryShape): string {
  let d = PATH_CACHE.get(c);
  if (d == null) {
    d = countryPath(c);
    PATH_CACHE.set(c, d);
  }
  return d;
}

/* ————————————————————— Eşdikdörtgen ————————————————————— */

/**
 * Dünya katmanının piksel ölçüsü. Yükseklik daima genişliğin yarısı.
 *
 * ⚠️ KÜÇÜK tutuluyor. 4096×2048 denendi: Android bu görünümü rasterize
 * ederken ~33MB istiyor ve bu cihazda (boş RAM ~144MB) harita açılır
 * açılmaz süreç ölüyor — uygulama kapanıyor, çökme kaydı bile bırakmadan
 * (bkz. AGENTS.md, fotoğraf akışındaki aynı belirti). 1600 genişlikte
 * yaklaşık 5MB; yakınlaşma zaten ölçekle geliyor, vektör olduğu için
 * keskinlik kaybolmuyor.
 */
export const WORLD_W = 1600;
export const WORLD_H = WORLD_W / 2;

export const lonToX = (lon: number) => ((lon + 180) / 360) * WORLD_W;
export const latToY = (lat: number) => ((90 - lat) / 180) * WORLD_H;
export const xToLon = (x: number) => (x / WORLD_W) * 360 - 180;
export const yToLat = (y: number) => 90 - (y / WORLD_H) * 180;

/**
 * Ülke halkalarını tek bir SVG yol dizesine çevirir (eşdikdörtgen).
 *
 * ⚠️ TARİH ÇİZGİSİ. Rusya, Fiji gibi ülkelerin halkaları 180°'den geçiyor:
 * ardışık iki köşe +179 ve −179 olunca eşdikdörtgen izdüşümde aralarına
 * haritayı boydan boya kesen bir çizgi çiziliyor (cihazda görüldü —
 * "Kanada'dan da geçen uzun çizikler"). Böyle bir sıçramada halka
 * KESİLİYOR: yeni parça yeni bir `M` ile başlıyor.
 */
export function countryPath(country: CountryShape): string {
  let d = '';
  for (const ring of country.p) {
    let prevLon: number | null = null;
    let open = false;
    for (const [lon, lat] of ring) {
      const jumped = prevLon != null && Math.abs(lon - prevLon) > 180;
      if (jumped) {
        if (open) d += 'Z';
        open = false;
      }
      d += `${open ? 'L' : 'M'}${lonToX(lon).toFixed(1)} ${latToY(lat).toFixed(1)}`;
      open = true;
      prevLon = lon;
    }
    if (open) d += 'Z';
  }
  return d;
}

/* ————————————————————— Ortografik (küre) ————————————————————— */

const RAD = Math.PI / 180;

/**
 * Küre yolu. `lon0` kürenin ortasına gelen boylam (görselde Afrika/Avrupa,
 * yani ~15°). Arkada kalan halkalar atılıyor: yoksa ön yüzün üstüne ters
 * çizilip lekeye dönüyorlar.
 */
export function globePath(country: CountryShape, r: number, lon0 = 15, lat0 = 12): string {
  const sinLat0 = Math.sin(lat0 * RAD);
  const cosLat0 = Math.cos(lat0 * RAD);
  let d = '';
  for (const ring of country.p) {
    let started = false;
    for (const [lon, lat] of ring) {
      const dl = (lon - lon0) * RAD;
      const la = lat * RAD;
      // Görünürlük: kürenin ön yüzü mü?
      const cosC = sinLat0 * Math.sin(la) + cosLat0 * Math.cos(la) * Math.cos(dl);
      if (cosC <= 0) {
        // Halka ufkun ardına geçti; parçayı kesip yeniden başlıyoruz.
        started = false;
        continue;
      }
      const x = r * Math.cos(la) * Math.sin(dl);
      const y = r * (cosLat0 * Math.sin(la) - sinLat0 * Math.cos(la) * Math.cos(dl));
      d += `${started ? 'L' : 'M'}${x.toFixed(1)} ${(-y).toFixed(1)}`;
      started = true;
    }
    if (started) d += 'Z';
  }
  return d;
}

/* ————————————————————— Ülke bulma ————————————————————— */

/**
 * Koordinata EN YAKIN ülke. Gerçek nokta-poligon testi 177 ülke × binlerce
 * köşe demek; harita için gereksiz. Merkezlere olan uzaklık, şehir
 * koordinatlarında pratikte doğru ülkeyi veriyor.
 */
export function nearestCountry(lon: number, lat: number): CountryShape | undefined {
  let best: CountryShape | undefined;
  let bestD = Infinity;
  for (const c of COUNTRIES) {
    const dx = (c.c[0] - lon) * Math.cos(((c.c[1] + lat) / 2) * RAD);
    const dy = c.c[1] - lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
