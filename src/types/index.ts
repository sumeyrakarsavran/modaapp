/** BETTA veri modeli */

export type Category = 'ust' | 'alt' | 'dis' | 'elbise' | 'ayakkabi' | 'aksesuar';

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'ust', label: 'Üst', emoji: '👕' },
  { id: 'alt', label: 'Alt', emoji: '👖' },
  { id: 'dis', label: 'Dış Giyim', emoji: '🧥' },
  { id: 'elbise', label: 'Elbise', emoji: '👗' },
  { id: 'ayakkabi', label: 'Ayakkabı', emoji: '👟' },
  { id: 'aksesuar', label: 'Aksesuar', emoji: '👜' },
];

export type Source = 'yeni' | 'ikinciel' | 'kiralik' | 'elyapimi' | 'hediye' | 'belirsiz';

export const SOURCES: { id: Source; label: string; color: string }[] = [
  { id: 'yeni', label: 'Yeni', color: '#00B4D8' },
  { id: 'ikinciel', label: 'İkinci El', color: '#7B5EA7' },
  { id: 'kiralik', label: 'Kiralık', color: '#2EC4B6' },
  { id: 'elyapimi', label: 'El Yapımı', color: '#F4B942' },
  { id: 'hediye', label: 'Hediye', color: '#FF4D6D' },
  { id: 'belirsiz', label: 'Belirsiz', color: '#8AA4AE' },
];

export type Season = 'ilkbahar' | 'yaz' | 'sonbahar' | 'kis';

export const SEASONS: { id: Season; label: string; emoji: string }[] = [
  { id: 'ilkbahar', label: 'İlkbahar', emoji: '🌱' },
  { id: 'yaz', label: 'Yaz', emoji: '☀️' },
  { id: 'sonbahar', label: 'Sonbahar', emoji: '🍂' },
  { id: 'kis', label: 'Kış', emoji: '❄️' },
];

export const ITEM_COLORS: { id: string; label: string; hex: string }[] = [
  { id: 'siyah', label: 'Siyah', hex: '#1A1A1A' },
  { id: 'beyaz', label: 'Beyaz', hex: '#F5F5F0' },
  { id: 'gri', label: 'Gri', hex: '#9A9A9A' },
  { id: 'bej', label: 'Bej', hex: '#D8C7A9' },
  { id: 'kahve', label: 'Kahve', hex: '#7B5238' },
  { id: 'lacivert', label: 'Lacivert', hex: '#1E3A5F' },
  { id: 'mavi', label: 'Mavi', hex: '#3E7CB1' },
  { id: 'turkuaz', label: 'Turkuaz', hex: '#00B4D8' },
  { id: 'yesil', label: 'Yeşil', hex: '#4C9A62' },
  { id: 'sari', label: 'Sarı', hex: '#F4B942' },
  { id: 'turuncu', label: 'Turuncu', hex: '#E8763A' },
  { id: 'kirmizi', label: 'Kırmızı', hex: '#C1292E' },
  { id: 'pembe', label: 'Pembe', hex: '#F28CB1' },
  { id: 'mor', label: 'Mor', hex: '#7B5EA7' },
  { id: 'desenli', label: 'Desenli', hex: '#B8A0C9' },
];

export interface WardrobeItem {
  id: string;
  name: string;
  category: Category;
  /** Fotoğraf URI'si (yerel dosya veya uzak URL). Yoksa renkli silüet gösterilir. */
  imageUri?: string;
  colorId: string; // ITEM_COLORS id
  brand?: string;
  price?: number; // TL
  source: Source;
  seasons: Season[];
  tags: string[];
  favorite: boolean;
  archived: boolean;
  /** Giyilme tarihleri (ISO gün: YYYY-MM-DD) */
  wearDates: string[];
  createdAt: string; // ISO
  notes?: string;
}

export interface Outfit {
  id: string;
  name: string;
  itemIds: string[];
  /** Canvas yerleşimi: itemId → {x, y, scale, z}. Yoksa dizilim otomatik. */
  layout?: Record<string, { x: number; y: number; scale: number; z: number }>;
  /** Canvas içerik alanının kaydedildiği andaki boyutu (WYSIWYG çerçeve). */
  canvasFrame?: { w: number; h: number };
  /** true: içeriğe kırp (parçalar kareye sığar). false/undefined: tuval çerçevesini koru. */
  cropToContent?: boolean;
  archetypeId?: string; // hangi betta stiline yakın
  favorite: boolean;
  createdAt: string;
  wearDates: string[];
}

export interface PlanEntry {
  /** YYYY-MM-DD */
  date: string;
  outfitId?: string;
  itemIds?: string[];
  note?: string;
}

export interface Profile {
  name: string;
  username: string;
  bettaArchetypeId?: string; // stil testi sonucu
  avatarUri?: string;
  /** Instagram tarzı kısa biyografi (birkaç cümle). */
  bio?: string;
  /** Herkese açık profil: açıksa gardırop, kombin, selfie ve lookbook'lar görünür. */
  isPublic?: boolean;
  /** Takipçi sayısı (yerel; bulut sosyal geldiğinde gerçek olur). */
  followers?: number;
  city?: string;
  lat?: number;
  lon?: number;
  onboarded: boolean;
}

/** Cihaz-yerel hesap (Supabase yapılandırılmadığında kullanılır). */
export interface LocalAccount {
  email: string;
  /** SHA-256(email + ':' + şifre) — düz metin şifre asla saklanmaz */
  passwordHash: string;
  hint?: string;
  createdAt: string;
}

export interface ApiSettings {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  anthropicKey?: string; // AI stilist
  fashnKey?: string; // sanal deneme
  removeBgKey?: string; // arka plan silme
}

export interface Selfie {
  id: string;
  imageUri: string;
  date: string; // YYYY-MM-DD
  outfitId?: string; // hangi kombinle çekildi
  note?: string;
  createdAt: string;
}

export interface Lookbook {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  outfitIds: string[];
  createdAt: string;
}

/** Topluluk gönderilerinde kıyafetler spec olarak tutulur. Kendi paylaşımında
 * gerçek fotoğraf (imageUri) ve canvas yerleşimi (layout) de saklanır; böylece
 * gönderi, kombin/canvas'ta oluşturulduğu düzenin aynısıyla gösterilir. */
export interface GarmentSpec {
  category: Category;
  colorId: string;
  imageUri?: string;
  layout?: { x: number; y: number; scale: number; z: number };
}

export interface CommunityComment {
  id: string;
  userId: string; // 'me' veya persona id
  text: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  userId: string; // 'me' veya persona id
  kind: 'kombin' | 'selfie' | 'lookbook';
  caption: string;
  garments: GarmentSpec[]; // kolaj için
  /** Canvas çerçevesi + kırpma tercihi (kombin paylaşımında düzenin aynen korunması için). */
  canvasFrame?: { w: number; h: number };
  cropToContent?: boolean;
  imageUri?: string; // selfie/kendi paylaşımı için gerçek görsel
  archetypeId?: string;
  likes: number; // persona beğenileri (benimki hariç)
  likedByMe: boolean;
  comments: CommunityComment[];
  createdAt: string;
}

export interface CommunityUser {
  id: string;
  name: string;
  username: string;
  bio: string;
  archetypeId: string;
  /** Avatar balığının rengi */
  color: string;
  /** Profil fotoğrafı (yalnızca 'me' için; personalarda yok) */
  avatarUri?: string;
  followers: number;
  isMe?: boolean;
}

export interface WeatherDay {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  precipProb: number;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
