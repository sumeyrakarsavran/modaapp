import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Button } from '@/components/UI';
import { isUsernameTaken } from '@/data/community';
import { isCloudEnabled } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { font, glass, luxe, luxeRadius, luxeType } from '@/theme/luxe';

export default function Settings() {
  const { api, setApi, profile, setProfile, account, pro, resetAll } = useStore();
  const [askReset, setAskReset] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState(api.anthropicKey ?? '');
  const [fashnKey, setFashnKey] = useState(api.fashnKey ?? '');
  const [removeBgKey, setRemoveBgKey] = useState(api.removeBgKey ?? '');
  const [supabaseUrl, setSupabaseUrl] = useState(api.supabaseUrl ?? '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(api.supabaseAnonKey ?? '');
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saved, setSaved] = useState(false);

  const cloud = isCloudEnabled(api);

  const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
  const usernameValid = /^[a-z0-9_]{3,20}$/.test(cleanUsername);
  const usernameTaken = cleanUsername !== profile.username && isUsernameTaken(cleanUsername);
  const usernameError = !cleanUsername
    ? null
    : !usernameValid
      ? '3-20 karakter; sadece küçük harf, rakam ve alt çizgi.'
      : usernameTaken
        ? 'Bu kullanıcı adı alınmış — başka bir tane dene.'
        : null;

  const save = () => {
    if (cleanUsername && usernameError) return;
    setApi({
      anthropicKey: anthropicKey.trim() || undefined,
      fashnKey: fashnKey.trim() || undefined,
      removeBgKey: removeBgKey.trim() || undefined,
      supabaseUrl: supabaseUrl.trim() || undefined,
      supabaseAnonKey: supabaseAnonKey.trim() || undefined,
    });
    const patch: Record<string, unknown> = { bio: bio.trim() || undefined };
    if (name.trim()) patch.name = name.trim();
    if (cleanUsername && !usernameError) patch.username = cleanUsername;
    setProfile(patch);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  /** Bölüm başlığı — küçük, geniş harf aralıklı etiket. */
  const Head = ({ title }: { title: string }) => (
    <Text style={[luxeType.label, styles.head]}>{title}</Text>
  );

  /** Bir ekrana götüren satır: ikon · ad · durum · ok. */
  const Row = ({
    icon,
    label,
    hint,
    onPress,
    color = luxe.ink,
    last,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    hint?: string;
    onPress: () => void;
    color?: string;
    last?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={19} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color }]}>{label}</Text>
        {hint ? <Text style={luxeType.tiny}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={luxe.outline} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      {/* Diğer ekranlarla AYNI zemin */}
      <Backdrop />
      <ConfirmModal
        visible={askReset}
        title="Her şeyi sıfırla"
        message="Tüm gardırop, kombin, selfie ve ayarlar silinecek. Bu işlem geri alınamaz."
        confirmLabel="Sıfırla"
        onConfirm={() => {
          setAskReset(false);
          resetAll();
          router.replace('/onboarding');
        }}
        onCancel={() => setAskReset(false)}
      />

      <View style={styles.header}>
        <Text style={[luxeType.display, { flex: 1 }]}>Ayarlar</Text>
        <Pressable onPress={() => router.back()} style={styles.close} hitSlop={8}>
          <Ionicons name="close" size={20} color={luxe.primary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/*
            KART YOK: bölümler ince çizgiyle ayrılıyor (yeni parça ekranıyla
            aynı karar). Ayarlar zaten uzun; kartlar hem büyütüyor hem
            ağırlaştırıyordu.
          */}
          <View style={styles.section}>
            <Head title="Profil" />
            <Text style={styles.label}>Adın</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} />

            <Text style={styles.label}>Kullanıcı adı</Text>
            <View style={styles.usernameRow}>
              <Text style={styles.at}>@</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="kullaniciadi"
                placeholderTextColor={luxe.outline}
                style={[styles.input, { flex: 1 }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Text style={[luxeType.tiny, { marginTop: 6 }, usernameError && { color: luxe.danger }]}>
              {usernameError ??
                'Arkadaşların seni toplulukta bu adla bulur; her kullanıcı adı benzersizdir.'}
            </Text>

            <Text style={styles.label}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Kendini birkaç cümleyle anlat…"
              placeholderTextColor={luxe.outline}
              style={[styles.input, { minHeight: 76, textAlignVertical: 'top' }]}
              multiline
              maxLength={160}
            />
          </View>

          <View style={styles.section}>
            <Head title="Gizlilik" />
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Herkese açık profil</Text>
                <Text style={[luxeType.tiny, { marginTop: 2 }]}>
                  Açıkken diğerleri profilinden parçalarını, kombinlerini, selfie ve
                  lookbook&apos;larını görebilir. Kapalıyken yalnızca bilerek paylaştıkların.
                </Text>
              </View>
              <Switch
                value={!!profile.isPublic}
                onValueChange={(v) => setProfile({ isPublic: v })}
                trackColor={{ true: luxe.primary, false: luxe.outlineSoft }}
                thumbColor={luxe.onPrimary}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Head title="Araçlar" />
            <Row
              icon="sparkles-outline"
              label="AI Stilist"
              hint={api.anthropicKey ? 'Claude bağlı' : 'Yerel öneri modunda'}
              onPress={() => router.push('/stylist')}
            />
            <Row
              icon="diamond-outline"
              label="BETTA Pro"
              hint={pro ? 'Aktif — sanal deneme açık' : 'Sanal deneme ve fazlası'}
              onPress={() => router.push('/pro')}
            />
            <Row
              icon="body-outline"
              label="Sanal deneme"
              hint={pro ? (api.fashnKey ? 'Hazır' : 'API anahtarı gerekli') : 'Pro üyelere özel'}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/studio',
                  params: { mode: 'tryon', t: String(Date.now()) },
                })
              }
            />
            <Row
              last
              icon="cloud-outline"
              label="Hesap & bulut"
              hint={cloud ? 'Supabase bağlı' : account ? `${account.email} · cihaz hesabı` : 'Hesap yok'}
              onPress={() => router.push('/auth')}
            />
          </View>

          <View style={styles.section}>
            <Head title="API anahtarları" />
            <Text style={luxeType.tiny}>
              Hepsi opsiyonel — anahtar girmezsen uygulama yerel modda çalışır. Anahtarlar yalnızca
              bu cihazda saklanır.
            </Text>

            <Text style={styles.label}>Claude (AI Stilist)</Text>
            <TextInput
              value={anthropicKey}
              onChangeText={setAnthropicKey}
              placeholder="sk-ant-…"
              placeholderTextColor={luxe.outline}
              style={styles.input}
              autoCapitalize="none"
              secureTextEntry
            />

            <Text style={styles.label}>FASHN AI (sanal deneme)</Text>
            <TextInput
              value={fashnKey}
              onChangeText={setFashnKey}
              placeholder="fa-…"
              placeholderTextColor={luxe.outline}
              style={styles.input}
              autoCapitalize="none"
              secureTextEntry
            />

            <Text style={styles.label}>remove.bg (yedek)</Text>
            <Text style={[luxeType.tiny, { marginBottom: 6 }]}>
              Arka plan silme cihazında zaten ücretsiz çalışıyor; bu anahtar yalnızca cihaz
              desteklemiyorsa devreye girer.
            </Text>
            <TextInput
              value={removeBgKey}
              onChangeText={setRemoveBgKey}
              placeholder="opsiyonel"
              placeholderTextColor={luxe.outline}
              style={styles.input}
              autoCapitalize="none"
              secureTextEntry
            />
          </View>

          <View style={styles.section}>
            <Head title="Supabase (bulut & hesap)" />
            <Text style={luxeType.tiny}>
              supabase.com&apos;da ücretsiz proje aç → Settings → API&apos;den URL ve anon key&apos;i
              kopyala, sonra SQL Editor&apos;da supabase/schema.sql dosyasını çalıştır.
            </Text>
            <Text style={styles.label}>Project URL</Text>
            <TextInput
              value={supabaseUrl}
              onChangeText={setSupabaseUrl}
              placeholder="https://xxxx.supabase.co"
              placeholderTextColor={luxe.outline}
              style={styles.input}
              autoCapitalize="none"
            />
            <Text style={styles.label}>Anon key</Text>
            <TextInput
              value={supabaseAnonKey}
              onChangeText={setSupabaseAnonKey}
              placeholder="eyJ…"
              placeholderTextColor={luxe.outline}
              style={styles.input}
              autoCapitalize="none"
              secureTextEntry
            />
          </View>

          <Button title={saved ? 'Kaydedildi' : 'Kaydet'} onPress={save} />

          {/* Geri alınamaz bölge — kırmızı ve en altta */}
          <Pressable
            onPress={() => setAskReset(true)}
            style={({ pressed }) => [styles.reset, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="trash-outline" size={17} color={luxe.danger} />
            <Text style={[styles.rowLabel, { color: luxe.danger }]}>Her şeyi sıfırla</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: glass.fill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
  },
  container: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 2 },
  section: {
    paddingBottom: 18,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: luxe.outlineSoft,
  },
  head: { marginBottom: 10, color: luxe.primary },
  label: {
    fontFamily: font.label,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: luxe.outline,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: font.body,
    fontSize: 15,
    color: luxe.ink,
    backgroundColor: luxe.surface,
  },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  at: { fontFamily: font.headline, fontSize: 18, color: luxe.outline },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: luxe.outlineSoft },
  rowLabel: { fontFamily: font.bodyMedium, fontSize: 15, color: luxe.ink },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 26,
  },
});
