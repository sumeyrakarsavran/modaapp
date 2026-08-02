import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { SEED_POSTS } from '@/data/community';
import type {
  ApiSettings,
  CommunityPost,
  LocalAccount,
  Lookbook,
  Outfit,
  PlanEntry,
  Profile,
  PendingTryOn,
  Selfie,
  TryOnRecord,
  WardrobeItem,
} from '@/types';
import { OUTER_SUBCATEGORY, todayISO, uid } from '@/types';

interface BettaState {
  items: WardrobeItem[];
  outfits: Outfit[];
  plans: PlanEntry[];
  selfies: Selfie[];
  lookbooks: Lookbook[];
  /** Sanal deneme çıktıları (Stüdyo → AI → Sanal giydirmelerim) */
  tryons: TryOnRecord[];
  /** Sonucu beklenen FASHN işi (uygulama kapansa bile kaybolmasın) */
  pendingTryOn: PendingTryOn | null;
  posts: CommunityPost[];
  followedIds: string[];
  profile: Profile;
  api: ApiSettings;
  /** Yerel hesap (Supabase yoksa). null = hesapsız kullanım. */
  account: LocalAccount | null;
  /** Oturum açık mı? (Yerel hesap için; Supabase kendi oturumunu yönetir.) */
  signedIn: boolean;
  /** BETTA Pro aboneliği (FASHN sanal deneme vb. premium özellikler). */
  pro: boolean;
  hydrated: boolean;

  // hesap
  setAccount: (account: LocalAccount | null) => void;
  setSignedIn: (v: boolean) => void;
  setPro: (v: boolean) => void;

  // items
  addItem: (item: Omit<WardrobeItem, 'id' | 'createdAt' | 'wearDates'>) => WardrobeItem;
  updateItem: (id: string, patch: Partial<WardrobeItem>) => void;
  deleteItem: (id: string) => void;
  toggleFavorite: (id: string) => void;
  toggleArchived: (id: string) => void;
  logWear: (itemIds: string[], date?: string) => void;

  // outfits
  addOutfit: (outfit: Omit<Outfit, 'id' | 'createdAt' | 'wearDates'>) => Outfit;
  updateOutfit: (id: string, patch: Partial<Outfit>) => void;
  deleteOutfit: (id: string) => void;
  wearOutfit: (id: string, date?: string) => void;

  // plans
  setPlan: (entry: PlanEntry) => void;
  clearPlan: (date: string) => void;

  // selfies
  addSelfie: (selfie: Omit<Selfie, 'id' | 'createdAt'>) => void;
  deleteSelfie: (id: string) => void;

  // sanal deneme
  addTryOn: (t: Omit<TryOnRecord, 'id' | 'createdAt'>) => void;
  setPendingTryOn: (p: PendingTryOn | null) => void;
  updateTryOn: (id: string, patch: Partial<TryOnRecord>) => void;
  deleteTryOn: (id: string) => void;

  // lookbooks
  addLookbook: (lb: Omit<Lookbook, 'id' | 'createdAt'>) => Lookbook;
  updateLookbook: (id: string, patch: Partial<Lookbook>) => void;
  deleteLookbook: (id: string) => void;

  // topluluk
  toggleFollow: (userId: string) => void;
  toggleLike: (postId: string) => void;
  addComment: (postId: string, text: string) => void;
  sharePost: (
    post: Omit<CommunityPost, 'id' | 'createdAt' | 'likes' | 'likedByMe' | 'comments' | 'userId'>,
  ) => void;
  deletePost: (postId: string) => void;

  // profile & settings
  setProfile: (patch: Partial<Profile>) => void;
  setApi: (patch: Partial<ApiSettings>) => void;

  seedDemo: () => void;
  resetAll: () => void;
}

const emptyProfile: Profile = {
  name: '',
  username: '',
  onboarded: false,
};

export const useStore = create<BettaState>()(
  persist(
    (set, get) => ({
      items: [],
      outfits: [],
      plans: [],
      selfies: [],
      lookbooks: [],
      tryons: [],
      pendingTryOn: null,
      posts: SEED_POSTS,
      followedIds: ['mira', 'luna'],
      profile: emptyProfile,
      api: {},
      account: null,
      signedIn: false,
      pro: false,
      hydrated: false,

      setAccount: (account) => set({ account }),
      setSignedIn: (signedIn) => set({ signedIn }),
      setPro: (pro) => set({ pro }),

      addItem: (item) => {
        const full: WardrobeItem = {
          ...item,
          id: uid(),
          createdAt: new Date().toISOString(),
          wearDates: [],
        };
        set((s) => ({ items: [full, ...s.items] }));
        return full;
      },
      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),
      deleteItem: (id) =>
        set((s) => ({
          items: s.items.filter((i) => i.id !== id),
          outfits: s.outfits.map((o) => ({
            ...o,
            itemIds: o.itemIds.filter((x) => x !== id),
          })),
        })),
      toggleFavorite: (id) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i)),
        })),
      toggleArchived: (id) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, archived: !i.archived } : i)),
        })),
      logWear: (itemIds, date = todayISO()) =>
        set((s) => ({
          items: s.items.map((i) =>
            itemIds.includes(i.id) && !i.wearDates.includes(date)
              ? { ...i, wearDates: [...i.wearDates, date] }
              : i,
          ),
        })),

      addOutfit: (outfit) => {
        const full: Outfit = {
          ...outfit,
          id: uid(),
          createdAt: new Date().toISOString(),
          wearDates: [],
        };
        set((s) => ({ outfits: [full, ...s.outfits] }));
        return full;
      },
      updateOutfit: (id, patch) =>
        set((s) => ({
          outfits: s.outfits.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        })),
      deleteOutfit: (id) =>
        set((s) => ({
          outfits: s.outfits.filter((o) => o.id !== id),
          plans: s.plans.map((p) => (p.outfitId === id ? { ...p, outfitId: undefined } : p)),
        })),
      wearOutfit: (id, date = todayISO()) => {
        const o = get().outfits.find((x) => x.id === id);
        if (!o) return;
        set((s) => ({
          outfits: s.outfits.map((x) =>
            x.id === id && !x.wearDates.includes(date)
              ? { ...x, wearDates: [...x.wearDates, date] }
              : x,
          ),
        }));
        get().logWear(o.itemIds, date);
      },

      setPlan: (entry) =>
        set((s) => ({
          plans: [...s.plans.filter((p) => p.date !== entry.date), entry],
        })),
      clearPlan: (date) =>
        set((s) => ({ plans: s.plans.filter((p) => p.date !== date) })),

      addSelfie: (selfie) =>
        set((s) => ({
          selfies: [{ ...selfie, id: uid(), createdAt: new Date().toISOString() }, ...s.selfies],
        })),
      deleteSelfie: (id) => set((s) => ({ selfies: s.selfies.filter((x) => x.id !== id) })),

      setPendingTryOn: (pendingTryOn) => set({ pendingTryOn }),
      addTryOn: (t) =>
        set((s) => ({
          tryons: [{ ...t, id: uid(), createdAt: new Date().toISOString() }, ...s.tryons],
        })),
      updateTryOn: (id, patch) =>
        set((s) => ({ tryons: s.tryons.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteTryOn: (id) => set((s) => ({ tryons: s.tryons.filter((x) => x.id !== id) })),

      addLookbook: (lb) => {
        const full: Lookbook = { ...lb, id: uid(), createdAt: new Date().toISOString() };
        set((s) => ({ lookbooks: [full, ...s.lookbooks] }));
        return full;
      },
      updateLookbook: (id, patch) =>
        set((s) => ({
          lookbooks: s.lookbooks.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),
      deleteLookbook: (id) =>
        set((s) => ({ lookbooks: s.lookbooks.filter((l) => l.id !== id) })),

      toggleFollow: (userId) =>
        set((s) => ({
          followedIds: s.followedIds.includes(userId)
            ? s.followedIds.filter((x) => x !== userId)
            : [...s.followedIds, userId],
        })),
      toggleLike: (postId) =>
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId ? { ...p, likedByMe: !p.likedByMe } : p,
          ),
        })),
      addComment: (postId, text) =>
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  comments: [
                    ...p.comments,
                    { id: uid(), userId: 'me', text, createdAt: new Date().toISOString() },
                  ],
                }
              : p,
          ),
        })),
      sharePost: (post) =>
        set((s) => ({
          posts: [
            {
              ...post,
              id: uid(),
              userId: 'me',
              likes: 0,
              likedByMe: false,
              comments: [],
              createdAt: new Date().toISOString(),
            },
            ...s.posts,
          ],
        })),
      deletePost: (postId) =>
        set((s) => ({
          posts: s.posts.filter((p) => !(p.id === postId && p.userId === 'me')),
        })),

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setApi: (patch) => set((s) => ({ api: { ...s.api, ...patch } })),

      seedDemo: () => set({ items: buildDemoItems() }),
      resetAll: () =>
        set({
          items: [],
          outfits: [],
          plans: [],
          selfies: [],
          lookbooks: [],
          posts: SEED_POSTS,
          followedIds: ['mira', 'luna'],
          profile: emptyProfile,
          api: {},
          account: null,
          signedIn: false,
          pro: false,
        }),
    }),
    {
      name: 'betta-store-v1',
      /**
       * v2: kategoriler kıyafet sınıflandırma modelinin grup listesine geçti.
       * Ayrı `dis` (Dış Giyim) kategorisi kaldırıldı — model ceket/montu
       * "Üst giyim" grubunda tutuyor. Kayıtlı parçalar `ust` kategorisine
       * taşınır ve dış giyim ayrımı `jacket` ALT TÜRÜ olarak korunur, yoksa
       * eski parçalar geçersiz bir kategoriye işaret edip listelerden düşerdi.
       */
      version: 2,
      migrate: (persisted, from) => {
        const state = persisted as { items?: { category: string; subcategory?: string }[] };
        if (from < 2 && Array.isArray(state?.items)) {
          for (const item of state.items) {
            if (item.category === 'dis') {
              item.category = 'ust';
              item.subcategory = item.subcategory ?? OUTER_SUBCATEGORY;
            }
          }
        }
        return state as never;
      },
      // SSR/Node ortamında window yok — orada belleğe yazan sahte depo kullan
      storage: createJSONStorage(() =>
        typeof window === 'undefined'
          ? {
              getItem: async () => null,
              setItem: async () => {},
              removeItem: async () => {},
            }
          : AsyncStorage,
      ),
      onRehydrateStorage: () => (state) => {
        // hydrated bayrağı persist edilmez; her açılışta set edilir
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

/** Demo gardırop — fotoğrafsız, renkli silüetlerle gösterilir. */
function buildDemoItems(): WardrobeItem[] {
  const days = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  };
  const base = {
    favorite: false,
    archived: false,
    imageUri: undefined,
    notes: undefined,
    brand: undefined,
    price: undefined,
  };
  const mk = (
    name: string,
    category: WardrobeItem['category'],
    colorId: string,
    extra: Partial<WardrobeItem> = {},
  ): WardrobeItem => ({
    ...base,
    id: uid(),
    name,
    category,
    colorId,
    source: 'yeni',
    seasons: [],
    tags: [],
    wearDates: [],
    createdAt: new Date().toISOString(),
    ...extra,
  });

  return [
    mk('Beyaz Basic Tişört', 'ust', 'beyaz', {
      price: 350, tags: ['basic', 'rahat'], seasons: ['ilkbahar', 'yaz'],
      wearDates: [days(2), days(6), days(11), days(19), days(30)], favorite: true,
    }),
    mk('Çizgili Gömlek', 'ust', 'mavi', {
      price: 780, source: 'ikinciel', tags: ['ofis', 'klasik'], seasons: ['ilkbahar', 'sonbahar'],
      wearDates: [days(4), days(15)],
    }),
    mk('Turkuaz Saten Bluz', 'ust', 'turkuaz', {
      price: 620, tags: ['şık', 'gece'], seasons: ['yaz'], wearDates: [days(9)], favorite: true,
    }),
    mk('Siyah Crop Hoodie', 'ust', 'siyah', {
      price: 540, tags: ['spor', 'crop'], seasons: ['sonbahar', 'kis'],
      wearDates: [days(1), days(5), days(8), days(13), days(21), days(27)],
    }),
    mk('Örgü Triko Kazak', 'ust', 'bej', {
      price: 890, source: 'hediye', tags: ['triko', 'konfor'], seasons: ['kis'],
      wearDates: [days(3), days(24)],
    }),
    mk('Yüksek Bel Mom Jean', 'alt', 'mavi', {
      price: 950, tags: ['denim', 'vintage'], seasons: ['ilkbahar', 'sonbahar', 'kis'],
      wearDates: [days(1), days(4), days(8), days(12), days(18), days(25), days(33)], favorite: true,
    }),
    mk('Siyah Deri Etek', 'alt', 'siyah', {
      price: 1100, source: 'ikinciel', tags: ['deri', 'rock', 'gece'], seasons: ['sonbahar', 'kis'],
      wearDates: [days(9)],
    }),
    mk('Keten Bol Pantolon', 'alt', 'bej', {
      price: 720, tags: ['keten', 'bol', 'rahat'], seasons: ['yaz'], wearDates: [days(6), days(16)],
    }),
    mk('Pileli Midi Etek', 'alt', 'lacivert', {
      price: 680, tags: ['klasik', 'ofis', 'midi'], seasons: ['ilkbahar', 'sonbahar'], wearDates: [days(15)],
    }),
    mk('Oversize Denim Ceket', 'ust', 'mavi', {
      subcategory: OUTER_SUBCATEGORY,
      price: 1250, source: 'ikinciel', tags: ['denim', 'oversize'], seasons: ['ilkbahar', 'sonbahar'],
      wearDates: [days(2), days(12), days(22)], favorite: true,
    }),
    mk('Siyah Deri Ceket', 'ust', 'siyah', {
      subcategory: OUTER_SUBCATEGORY,
      price: 2400, tags: ['deri', 'rock'], seasons: ['sonbahar', 'kis'], wearDates: [days(5), days(20)],
    }),
    mk('Kaşe Uzun Palto', 'ust', 'kahve', {
      subcategory: OUTER_SUBCATEGORY,
      price: 3200, tags: ['klasik', 'şık'], seasons: ['kis'], wearDates: [days(3), days(27)],
    }),
    mk('Çiçekli Şifon Elbise', 'elbise', 'pembe', {
      price: 980, tags: ['çiçek', 'romantik', 'uçuşan'], seasons: ['ilkbahar', 'yaz'], wearDates: [days(16)],
    }),
    mk('Siyah Mini Elbise', 'elbise', 'siyah', {
      price: 1150, tags: ['gece', 'şık'], seasons: ['yaz', 'sonbahar'], wearDates: [days(9)], favorite: true,
    }),
    mk('Beyaz Sneaker', 'ayakkabi', 'beyaz', {
      price: 1900, tags: ['spor', 'sneaker'], seasons: ['ilkbahar', 'yaz', 'sonbahar'],
      wearDates: [days(1), days(2), days(6), days(8), days(12), days(16), days(22), days(30)],
    }),
    mk('Siyah Platform Bot', 'ayakkabi', 'siyah', {
      price: 2200, tags: ['bot', 'rock'], seasons: ['sonbahar', 'kis'], wearDates: [days(3), days(5), days(20)],
    }),
    mk('Topuklu Sandalet', 'ayakkabi', 'kirmizi', {
      price: 1400, tags: ['gece', 'şık'], seasons: ['yaz'], wearDates: [days(9)],
    }),
    mk('Mini Omuz Çantası', 'aksesuar', 'kirmizi', {
      price: 850, source: 'hediye', tags: ['çanta', 'gece'], seasons: [], wearDates: [days(9), days(16)],
    }),
    mk('Gümüş Halka Küpe', 'aksesuar', 'gri', {
      price: 240, tags: ['takı'], seasons: [], wearDates: [days(4), days(9), days(15)],
    }),
    mk('İpek Fular', 'aksesuar', 'desenli', {
      price: 380, source: 'ikinciel', tags: ['vintage', 'desen'], seasons: ['ilkbahar'], wearDates: [],
    }),
  ];
}
