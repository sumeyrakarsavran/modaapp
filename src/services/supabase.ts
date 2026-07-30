import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { ApiSettings } from '@/types';

/**
 * Supabase istemcisi — Ayarlar'dan URL + anon key girildiğinde aktifleşir.
 * Girilmediğinde uygulama tamamen yerel (demo) modda çalışır.
 *
 * Kurulum: supabase/schema.sql dosyasını Supabase SQL Editor'da çalıştırın.
 */

let client: SupabaseClient | null = null;
let clientKey = '';

export function getSupabase(api: ApiSettings): SupabaseClient | null {
  const { supabaseUrl, supabaseAnonKey } = api;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const key = `${supabaseUrl}|${supabaseAnonKey}`;
  if (!client || clientKey !== key) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    clientKey = key;
  }
  return client;
}

export function isCloudEnabled(api: ApiSettings): boolean {
  return Boolean(api.supabaseUrl && api.supabaseAnonKey);
}

/** Yerel state'i buluta yükle (basit tam senkron). */
export async function pushToCloud(
  api: ApiSettings,
  payload: { items: unknown[]; outfits: unknown[]; plans: unknown[]; profile: unknown },
): Promise<void> {
  const sb = getSupabase(api);
  if (!sb) throw new Error('Supabase yapılandırılmamış.');
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) throw new Error('Önce giriş yapmalısın.');
  const userId = userData.user.id;

  const { error } = await sb.from('wardrobes').upsert({
    user_id: userId,
    data: payload,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Buluta yükleme hatası: ${error.message}`);
}

/** Buluttaki gardırobu indir. */
export async function pullFromCloud(api: ApiSettings): Promise<{
  items: unknown[];
  outfits: unknown[];
  plans: unknown[];
  profile: unknown;
} | null> {
  const sb = getSupabase(api);
  if (!sb) throw new Error('Supabase yapılandırılmamış.');
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) throw new Error('Önce giriş yapmalısın.');

  const { data, error } = await sb
    .from('wardrobes')
    .select('data')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (error) throw new Error(`Buluttan indirme hatası: ${error.message}`);
  return (data?.data as any) ?? null;
}
