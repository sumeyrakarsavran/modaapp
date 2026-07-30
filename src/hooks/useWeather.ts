import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { fetchWeek, geocodeCity } from '@/services/weather';
import { useStore } from '@/store/useStore';
import type { WeatherDay } from '@/types';

export function useWeather() {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const [week, setWeek] = useState<WeatherDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    try {
      setWeek(await fetchWeek(lat, lon));
    } catch (e: any) {
      setError(e?.message ?? 'Hava durumu alınamadı');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile.lat != null && profile.lon != null) {
      load(profile.lat, profile.lon);
    }
  }, [profile.lat, profile.lon, load]);

  const useDeviceLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Konum izni verilmedi — şehir adı girebilirsin.');
        setLoading(false);
        return false;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      const places = await Location.reverseGeocodeAsync(pos.coords).catch(() => []);
      const city = places[0]?.city ?? places[0]?.region ?? 'Konumum';
      setProfile({ lat: pos.coords.latitude, lon: pos.coords.longitude, city });
      return true;
    } catch (e: any) {
      setError(e?.message ?? 'Konum alınamadı');
      return false;
    } finally {
      setLoading(false);
    }
  }, [setProfile]);

  const useCity = useCallback(
    async (name: string) => {
      setLoading(true);
      setError(null);
      const r = await geocodeCity(name);
      setLoading(false);
      if (!r) {
        setError('Şehir bulunamadı.');
        return false;
      }
      setProfile({ lat: r.lat, lon: r.lon, city: r.name });
      return true;
    },
    [setProfile],
  );

  const todayWeather = week.length ? week[0] : undefined;
  return { week, todayWeather, loading, error, useDeviceLocation, useCity };
}
