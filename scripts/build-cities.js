/*
  Harita etiketleri için ŞEHİR listesi üretir.

  Kaynak: all-the-cities (GeoNames, CC-BY). Paket 135 bin şehir taşıyor —
  uygulamaya girecek şey bu değil: yakınlık kademelerine göre üç katman
  seçiliyor ve dosya ~40 KB'de kalıyor.

  Kademeler (harita ekranı bunları yakınlığa göre açıyor):
    0 — dünya görünümü: yalnızca çok büyük şehirler
    1 — kıta/ülke ölçeği
    2 — yakın bakış
  Türkiye ayrıca daha alçak eşikle giriyor: kullanıcı burada ve kendi
  çevresine baktığında haritada kendi şehirlerini görmeli.

  Çalıştırma: node scripts/build-cities.js  →  src/data/cities.json
*/
const fs = require('fs');
const path = require('path');
const cities = require('all-the-cities');

const HOME = 'TR';
const TIERS = [
  { tier: 0, world: 5_000_000, home: 3_000_000 },
  { tier: 1, world: 1_500_000, home: 700_000 },
  { tier: 2, world: 600_000, home: 150_000 },
];

const seen = new Set();
const out = [];

for (const { tier, world, home } of TIERS) {
  for (const c of cities) {
    const limit = c.country === HOME ? home : world;
    if (c.population < limit) continue;
    const key = `${c.name}|${c.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      n: c.name,
      c: c.country,
      // 3 ondalık ≈ 100 m; etiket için fazlasıyla yeter
      x: Math.round(c.loc.coordinates[0] * 1000) / 1000,
      y: Math.round(c.loc.coordinates[1] * 1000) / 1000,
      p: Math.round(c.population / 1000), // bin kişi
      t: tier,
    });
  }
}

out.sort((a, b) => b.p - a.p);

const dest = path.join(__dirname, '..', 'src', 'data', 'cities.json');
fs.writeFileSync(dest, JSON.stringify({ cities: out }));
const kb = (fs.statSync(dest).size / 1024).toFixed(0);
const per = [0, 1, 2].map((t) => out.filter((c) => c.t === t).length);
console.log(`${out.length} şehir (kademe: ${per.join(' / ')}) → src/data/cities.json (${kb} KB)`);
