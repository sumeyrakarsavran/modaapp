-- BETTA — Supabase şeması
-- Supabase Dashboard → SQL Editor'da bu dosyayı çalıştırın.
-- Auth: Dashboard → Authentication → Providers → Email'i açın.

-- Kullanıcı gardırobu (tek satırda tam durum — basit ve çakışmasız senkron)
create table if not exists public.wardrobes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.wardrobes enable row level security;

create policy "Kullanıcı kendi gardırobunu okur"
  on public.wardrobes for select
  using (auth.uid() = user_id);

create policy "Kullanıcı kendi gardırobunu yazar"
  on public.wardrobes for insert
  with check (auth.uid() = user_id);

create policy "Kullanıcı kendi gardırobunu günceller"
  on public.wardrobes for update
  using (auth.uid() = user_id);

-- ————— Topluluk —————

-- Herkese açık profiller: kullanıcı adı BENZERSİZDİR (arkadaş arama bununla çalışır)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,20}$'),
  name text not null default '',
  archetype_id text,
  bio text not null default '',
  avatar_url text,
  -- Herkese açık profil: açıksa gardırop/kombin/selfie/lookbook başkalarına görünür
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiller herkese görünür"
  on public.profiles for select using (true);

create policy "Kullanıcı kendi profilini oluşturur"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Kullanıcı kendi profilini günceller"
  on public.profiles for update using (auth.uid() = id);

-- Takip ilişkileri
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

alter table public.follows enable row level security;

create policy "Takipler herkese görünür"
  on public.follows for select using (true);

create policy "Kullanıcı takip eder"
  on public.follows for insert with check (auth.uid() = follower_id);

create policy "Kullanıcı takibi bırakır"
  on public.follows for delete using (auth.uid() = follower_id);

-- Topluluk gönderileri (kombin/selfie/lookbook paylaşımları)
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('kombin', 'selfie', 'lookbook')),
  caption text not null default '',
  garments jsonb not null default '[]'::jsonb,
  image_path text,
  archetype_id text,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "Gönderiler herkese görünür"
  on public.posts for select using (true);

create policy "Kullanıcı gönderi paylaşır"
  on public.posts for insert with check (auth.uid() = user_id);

create policy "Kullanıcı gönderisini siler"
  on public.posts for delete using (auth.uid() = user_id);

-- Beğeniler ve yorumlar
create table if not exists public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.likes enable row level security;
create policy "Beğeniler herkese görünür" on public.likes for select using (true);
create policy "Kullanıcı beğenir" on public.likes for insert with check (auth.uid() = user_id);
create policy "Kullanıcı beğeniyi geri alır" on public.likes for delete using (auth.uid() = user_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;
create policy "Yorumlar herkese görünür" on public.comments for select using (true);
create policy "Kullanıcı yorum yazar" on public.comments for insert with check (auth.uid() = user_id);
create policy "Kullanıcı yorumunu siler" on public.comments for delete using (auth.uid() = user_id);

-- Kıyafet fotoğrafları için depolama
insert into storage.buckets (id, name, public)
values ('garments', 'garments', false)
on conflict (id) do nothing;

create policy "Kullanıcı kendi fotoğraflarını yönetir"
  on storage.objects for all
  using (bucket_id = 'garments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'garments' and (storage.foldername(name))[1] = auth.uid()::text);
