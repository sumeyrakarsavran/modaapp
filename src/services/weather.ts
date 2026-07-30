import type { WeatherDay } from '@/types';

/** Open-Meteo — ücretsiz, API anahtarı gerektirmez. */
export async function fetchWeek(lat: number, lon: number): Promise<WeatherDay[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
    `&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hava durumu alınamadı (${res.status})`);
  const data = await res.json();
  const d = data.daily;
  return d.time.map((date: string, i: number) => ({
    date,
    tempMax: Math.round(d.temperature_2m_max[i]),
    tempMin: Math.round(d.temperature_2m_min[i]),
    weatherCode: d.weather_code[i],
    precipProb: d.precipitation_probability_max?.[i] ?? 0,
  }));
}

/** Şehir adından koordinat bul (Open-Meteo geocoding, anahtarsız). */
export async function geocodeCity(
  name: string,
): Promise<{ name: string; lat: number; lon: number } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    name,
  )}&count=1&language=tr`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const r = data.results?.[0];
  if (!r) return null;
  return { name: r.name, lat: r.latitude, lon: r.longitude };
}

export function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '❄️';
  return '⛈️';
}

export function weatherLabel(code: number): string {
  if (code === 0) return 'Açık';
  if (code <= 2) return 'Az bulutlu';
  if (code === 3) return 'Bulutlu';
  if (code <= 48) return 'Sisli';
  if (code <= 67) return 'Yağmurlu';
  if (code <= 77) return 'Karlı';
  if (code <= 82) return 'Sağanak';
  if (code <= 86) return 'Kar yağışlı';
  return 'Fırtınalı';
}
