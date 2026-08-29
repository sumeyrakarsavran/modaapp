/*
  Dünya haritası verisini uygulamaya HAZIR halde üretir.

  Kaynak: Natural Earth 110m (world-atlas paketi, kamu malı). Çalışma anında
  TopoJSON çözmek yerine derleme öncesi tek sefer burada çözülüyor:
  - runtime bağımlılık yok (topojson-client uygulamaya girmiyor)
  - koordinatlar 1 ondalığa yuvarlanıp dosya küçülüyor (~1200 km ölçeğinde
    fark görünmüyor, harita stilize zaten)
  - her ülkenin görünen ALANI ve merkezi de burada hesaplanıyor; fotoğrafın
    hangi noktaya oturacağını uygulama her açılışta yeniden hesaplamasın.

  Çalıştırma:  node scripts/build-world.js
  Çıktı:       src/data/world.json
*/
const fs = require('fs');
const path = require('path');
const topojson = require('topojson-client');

const topo = require('world-atlas/countries-110m.json');
const fc = topojson.feature(topo, topo.objects.countries);

/** Enlem/boylamı 1 ondalığa yuvarla — dosya boyu üçte birine iniyor. */
const r = (n) => Math.round(n * 10) / 10;

/** Halka çok küçükse (küçük adacıklar) at: ekranda tek piksel bile değil. */
const MIN_RING_SPAN = 1.6; // derece

function ringSpan(ring) {
  let minX = 180,
    maxX = -180,
    minY = 90,
    maxY = -90;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.max(maxX - minX, maxY - minY);
}

/**
 * Köşe seyreltme. Yuvarlamak yetmiyor: kıyı şeritlerinde derece başına
 * onlarca nokta var ve telefonda (boş RAM ~144MB) 177 ülkelik SVG süreci
 * ÖLDÜRÜYOR — cihazda görüldü, harita açılırken uygulama kapandı.
 * Birbirine MIN_STEP'ten yakın ardışık köşeler atılıyor; stilize haritada
 * fark görünmüyor, nokta sayısı üçte birine iniyor.
 */
const MIN_STEP = 0.45; // derece

function dedupe(ring) {
  const out = [];
  for (const p of ring) {
    const q = [r(p[0]), r(p[1])];
    const last = out[out.length - 1];
    if (!last) {
      out.push(q);
      continue;
    }
    if (Math.abs(last[0] - q[0]) < MIN_STEP && Math.abs(last[1] - q[1]) < MIN_STEP) continue;
    out.push(q);
  }
  return out;
}

const countries = [];
for (const f of fc.features) {
  const name = f.properties?.name;
  if (!name) continue;
  const polys = [];
  const geom = f.geometry;
  if (!geom) continue;
  const raw = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  for (const poly of raw) {
    // Yalnızca DIŞ halka: iç delikler (göller) stilize haritada gerekmiyor
    const ring = poly[0];
    if (!ring || ringSpan(ring) < MIN_RING_SPAN) continue;
    const d = dedupe(ring);
    if (d.length > 3) polys.push(d);
  }
  if (!polys.length) continue;

  // En BÜYÜK halkanın kutu merkezi: fotoğraf ülkenin gövdesine otursun
  // (tüm halkaların ortalaması Fransa'yı okyanusa, ABD'yi Pasifik'e atıyor).
  let best = null;
  let bestArea = 0;
  for (const ring of polys) {
    let minX = 180,
      maxX = -180,
      minY = 90,
      maxY = -90;
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const area = (maxX - minX) * (maxY - minY);
    if (area > bestArea) {
      bestArea = area;
      best = [(minX + maxX) / 2, (minY + maxY) / 2];
    }
  }

  countries.push({
    id: f.id ?? name,
    name,
    c: [r(best[0]), r(best[1])],
    p: polys,
  });
}

countries.sort((a, b) => a.name.localeCompare(b.name));

const out = path.join(__dirname, '..', 'src', 'data', 'world.json');
fs.writeFileSync(out, JSON.stringify({ countries }));
const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`${countries.length} ülke → src/data/world.json (${kb} KB)`);
