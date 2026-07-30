import type { Category, CommunityPost, CommunityUser, GarmentSpec } from '@/types';

/**
 * Demo topluluk — 6 betta arketipine karşılık gelen personalar ("kızlar").
 * Kullanıcı AI ile ürettiği model fotoğraflarını paylaştığında
 * `avatarUri` alanı eklenerek gerçek yüzlerle değiştirilebilir.
 */

export const PERSONAS: CommunityUser[] = [
  {
    id: 'luna',
    name: 'Luna',
    username: 'lunahalfmoon',
    bio: 'Zamansız parçalar, sessiz lüks. 🌙 Halfmoon ekolü.',
    archetypeId: 'halfmoon',
    color: '#7B5EA7',
    followers: 12400,
  },
  {
    id: 'ateş',
    name: 'Ateş',
    username: 'atescrowntail',
    bio: 'Deri, zincir, gece. 🔥 Kurallar başkasının.',
    archetypeId: 'crowntail',
    color: '#E5383B',
    followers: 9800,
  },
  {
    id: 'mira',
    name: 'Mira',
    username: 'miraveiltail',
    bio: 'Uçuşan etekler ve pastel sabahlar 🌸',
    archetypeId: 'veiltail',
    color: '#FF4D6D',
    followers: 15200,
  },
  {
    id: 'kai',
    name: 'Kai',
    username: 'kaiplakat',
    bio: 'Sneaker koleksiyoncusu ⚡ Hız ve konfor.',
    archetypeId: 'plakat',
    color: '#00B4D8',
    followers: 7600,
  },
  {
    id: 'pupa',
    name: 'Pupa',
    username: 'pupakoi',
    bio: 'Vintage pazarların kraliçesi 🎨 Desen desen üstüne.',
    archetypeId: 'koi',
    color: '#F4B942',
    followers: 11100,
  },
  {
    id: 'bulut',
    name: 'Bulut',
    username: 'bulutdumbo',
    bio: 'Triko, keten, latte ☁️ Yavaş moda.',
    archetypeId: 'dumbo',
    color: '#2EC4B6',
    followers: 8900,
  },
];

/** Kullanıcı adı personalardan biriyle çakışıyor mu? (Yerel benzersizlik kontrolü.) */
export function isUsernameTaken(username: string): boolean {
  const u = username.trim().toLowerCase();
  return PERSONAS.some((p) => p.username.toLowerCase() === u);
}

/** Personaların herkese açık gardırop vitrini. */
export interface PersonaShowcase {
  items: { name: string; category: Category; colorId: string }[];
  lookbooks: { name: string; emoji: string; outfits: GarmentSpec[][] }[];
}

export const PERSONA_SHOWCASE: Record<string, PersonaShowcase> = {
  luna: {
    items: [
      { name: 'İpek Beyaz Gömlek', category: 'ust', colorId: 'beyaz' },
      { name: 'Lacivert Kalem Etek', category: 'alt', colorId: 'lacivert' },
      { name: 'Kaşmir Bej Palto', category: 'dis', colorId: 'bej' },
      { name: 'Siyah Topuklu', category: 'ayakkabi', colorId: 'siyah' },
      { name: 'Deri Tote Çanta', category: 'aksesuar', colorId: 'kahve' },
      { name: 'Midi Siyah Elbise', category: 'elbise', colorId: 'siyah' },
    ],
    lookbooks: [
      {
        name: 'Kapsül Gardırop',
        emoji: '🌙',
        outfits: [
          [
            { category: 'ust', colorId: 'beyaz' },
            { category: 'alt', colorId: 'lacivert' },
            { category: 'ayakkabi', colorId: 'siyah' },
          ],
          [
            { category: 'elbise', colorId: 'siyah' },
            { category: 'dis', colorId: 'bej' },
            { category: 'aksesuar', colorId: 'kahve' },
          ],
        ],
      },
    ],
  },
  ateş: {
    items: [
      { name: 'Biker Deri Ceket', category: 'dis', colorId: 'siyah' },
      { name: 'Yırtık Skinny Jean', category: 'alt', colorId: 'siyah' },
      { name: 'Grafik Band Tişört', category: 'ust', colorId: 'gri' },
      { name: 'Platform Kombat Bot', category: 'ayakkabi', colorId: 'siyah' },
      { name: 'Zincir Kolye', category: 'aksesuar', colorId: 'gri' },
    ],
    lookbooks: [
      {
        name: 'Konser Geceleri',
        emoji: '🔥',
        outfits: [
          [
            { category: 'dis', colorId: 'siyah' },
            { category: 'ust', colorId: 'gri' },
            { category: 'alt', colorId: 'siyah' },
            { category: 'ayakkabi', colorId: 'siyah' },
          ],
        ],
      },
    ],
  },
  mira: {
    items: [
      { name: 'Çiçekli Şifon Elbise', category: 'elbise', colorId: 'pembe' },
      { name: 'Dantel Beyaz Bluz', category: 'ust', colorId: 'beyaz' },
      { name: 'Pileli Pembe Etek', category: 'alt', colorId: 'pembe' },
      { name: 'Beyaz Babet', category: 'ayakkabi', colorId: 'beyaz' },
      { name: 'İnci Toka', category: 'aksesuar', colorId: 'beyaz' },
      { name: 'Lila Hırka', category: 'dis', colorId: 'mor' },
    ],
    lookbooks: [
      {
        name: 'Bahar Pikniği',
        emoji: '🌸',
        outfits: [
          [
            { category: 'elbise', colorId: 'pembe' },
            { category: 'dis', colorId: 'beyaz' },
            { category: 'ayakkabi', colorId: 'beyaz' },
          ],
          [
            { category: 'ust', colorId: 'beyaz' },
            { category: 'alt', colorId: 'pembe' },
            { category: 'aksesuar', colorId: 'beyaz' },
          ],
        ],
      },
    ],
  },
  kai: {
    items: [
      { name: 'Turkuaz Crop Sweat', category: 'ust', colorId: 'turkuaz' },
      { name: 'Gri Jogger', category: 'alt', colorId: 'gri' },
      { name: 'Retro Sneaker', category: 'ayakkabi', colorId: 'beyaz' },
      { name: 'Rüzgarlık', category: 'dis', colorId: 'mavi' },
      { name: 'Spor Çanta', category: 'aksesuar', colorId: 'siyah' },
    ],
    lookbooks: [
      {
        name: 'Salon Rutini',
        emoji: '⚡',
        outfits: [
          [
            { category: 'ust', colorId: 'turkuaz' },
            { category: 'alt', colorId: 'gri' },
            { category: 'ayakkabi', colorId: 'beyaz' },
          ],
        ],
      },
    ],
  },
  pupa: {
    items: [
      { name: '70ler Desenli Gömlek', category: 'ust', colorId: 'desenli' },
      { name: 'Kadife Kahve Pantolon', category: 'alt', colorId: 'kahve' },
      { name: 'Sarı Vintage Çanta', category: 'aksesuar', colorId: 'sari' },
      { name: 'Kırmızı Retro Bot', category: 'ayakkabi', colorId: 'kirmizi' },
      { name: 'Patchwork Ceket', category: 'dis', colorId: 'desenli' },
      { name: 'Turuncu Midi Elbise', category: 'elbise', colorId: 'turuncu' },
    ],
    lookbooks: [
      {
        name: '70ler Ama Bugün',
        emoji: '🎨',
        outfits: [
          [
            { category: 'ust', colorId: 'desenli' },
            { category: 'alt', colorId: 'kahve' },
            { category: 'ayakkabi', colorId: 'kirmizi' },
            { category: 'aksesuar', colorId: 'sari' },
          ],
        ],
      },
      {
        name: 'Pazar Pazarı',
        emoji: '🧺',
        outfits: [
          [
            { category: 'elbise', colorId: 'turuncu' },
            { category: 'dis', colorId: 'desenli' },
          ],
        ],
      },
    ],
  },
  bulut: {
    items: [
      { name: 'Oversize Bej Triko', category: 'ust', colorId: 'bej' },
      { name: 'Keten Beyaz Pantolon', category: 'alt', colorId: 'beyaz' },
      { name: 'Süet Loafer', category: 'ayakkabi', colorId: 'bej' },
      { name: 'Yün Uzun Hırka', category: 'dis', colorId: 'gri' },
      { name: 'Hasır Çanta', category: 'aksesuar', colorId: 'bej' },
    ],
    lookbooks: [
      {
        name: 'Yavaş Pazar',
        emoji: '☁️',
        outfits: [
          [
            { category: 'ust', colorId: 'bej' },
            { category: 'alt', colorId: 'beyaz' },
            { category: 'ayakkabi', colorId: 'bej' },
          ],
        ],
      },
    ],
  },
};

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const SEED_POSTS: CommunityPost[] = [
  {
    id: 'p-luna-1',
    userId: 'luna',
    kind: 'kombin',
    caption: 'Pazartesi toplantı üniforması: ipek + kalem etek. Az ama öz. 🌙',
    garments: [
      { category: 'ust', colorId: 'beyaz' },
      { category: 'alt', colorId: 'lacivert' },
      { category: 'ayakkabi', colorId: 'siyah' },
      { category: 'aksesuar', colorId: 'bej' },
    ],
    archetypeId: 'halfmoon',
    likes: 342,
    likedByMe: false,
    comments: [
      { id: 'c1', userId: 'mira', text: 'Bu sadeliği hiç beceremiyorum, bayıldım 😍', createdAt: daysAgoISO(1) },
    ],
    createdAt: daysAgoISO(1),
  },
  {
    id: 'p-ates-1',
    userId: 'ateş',
    kind: 'kombin',
    caption: 'Konser gecesi. Deri üstüne deri, kim tutar beni 🔥',
    garments: [
      { category: 'dis', colorId: 'siyah' },
      { category: 'ust', colorId: 'gri' },
      { category: 'alt', colorId: 'siyah' },
      { category: 'ayakkabi', colorId: 'siyah' },
    ],
    archetypeId: 'crowntail',
    likes: 518,
    likedByMe: false,
    comments: [
      { id: 'c2', userId: 'kai', text: 'Bot hangi marka?? 🙏', createdAt: daysAgoISO(2) },
      { id: 'c3', userId: 'pupa', text: 'Siyahın 50 tonu ama işte olmuş 🖤', createdAt: daysAgoISO(2) },
    ],
    createdAt: daysAgoISO(2),
  },
  {
    id: 'p-mira-1',
    userId: 'mira',
    kind: 'kombin',
    caption: 'Bahar geldi sandım, şifon giydim, üşüdüm, değdi 🌸',
    garments: [
      { category: 'elbise', colorId: 'pembe' },
      { category: 'dis', colorId: 'beyaz' },
      { category: 'ayakkabi', colorId: 'beyaz' },
      { category: 'aksesuar', colorId: 'pembe' },
    ],
    archetypeId: 'veiltail',
    likes: 764,
    likedByMe: false,
    comments: [],
    createdAt: daysAgoISO(3),
  },
  {
    id: 'p-kai-1',
    userId: 'kai',
    kind: 'kombin',
    caption: '10k adım günü. Konfor ve stil aynı cümlede ⚡',
    garments: [
      { category: 'ust', colorId: 'turkuaz' },
      { category: 'alt', colorId: 'gri' },
      { category: 'ayakkabi', colorId: 'beyaz' },
    ],
    archetypeId: 'plakat',
    likes: 231,
    likedByMe: false,
    comments: [
      { id: 'c4', userId: 'bulut', text: 'Bu turkuaz sana çok yakışıyor', createdAt: daysAgoISO(3) },
    ],
    createdAt: daysAgoISO(4),
  },
  {
    id: 'p-pupa-1',
    userId: 'pupa',
    kind: 'lookbook',
    caption: 'Vintage pazar avı sonuçları: "70ler ama bugün" lookbook\'um yayında 🎨',
    garments: [
      { category: 'ust', colorId: 'desenli' },
      { category: 'alt', colorId: 'kahve' },
      { category: 'aksesuar', colorId: 'sari' },
      { category: 'ayakkabi', colorId: 'kirmizi' },
    ],
    archetypeId: 'koi',
    likes: 402,
    likedByMe: false,
    comments: [
      { id: 'c5', userId: 'luna', text: 'Desen cesareti bende olsa 😅', createdAt: daysAgoISO(4) },
    ],
    createdAt: daysAgoISO(5),
  },
  {
    id: 'p-bulut-1',
    userId: 'bulut',
    kind: 'kombin',
    caption: 'Pazar modu: bol triko, keten pantolon, sıfır acele ☁️',
    garments: [
      { category: 'ust', colorId: 'bej' },
      { category: 'alt', colorId: 'beyaz' },
      { category: 'ayakkabi', colorId: 'bej' },
    ],
    archetypeId: 'dumbo',
    likes: 289,
    likedByMe: false,
    comments: [],
    createdAt: daysAgoISO(6),
  },
  {
    id: 'p-mira-2',
    userId: 'mira',
    kind: 'selfie',
    caption: 'Asansör aynası klasiği 🤳 Bugünün kombiniyle.',
    garments: [
      { category: 'elbise', colorId: 'mavi' },
      { category: 'ayakkabi', colorId: 'beyaz' },
    ],
    archetypeId: 'veiltail',
    likes: 611,
    likedByMe: false,
    comments: [
      { id: 'c6', userId: 'ateş', text: 'Işık mükemmel 📸', createdAt: daysAgoISO(0) },
    ],
    createdAt: daysAgoISO(0),
  },
  {
    id: 'p-luna-2',
    userId: 'luna',
    kind: 'lookbook',
    caption: '"Kapsül gardırop: 12 parça 30 kombin" lookbook\'umu güncelledim 🌙',
    garments: [
      { category: 'dis', colorId: 'kahve' },
      { category: 'ust', colorId: 'beyaz' },
      { category: 'alt', colorId: 'lacivert' },
      { category: 'ayakkabi', colorId: 'siyah' },
    ],
    archetypeId: 'halfmoon',
    likes: 1024,
    likedByMe: false,
    comments: [],
    createdAt: daysAgoISO(7),
  },
];
