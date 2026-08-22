import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, luxe, luxeRadius, luxeType } from '@/theme/luxe';

export interface SheetAction {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Kırmızı — geri alınamaz seçenek. */
  destructive?: boolean;
  onPress: () => void;
}

/**
 * Alt sayfa — sistemin çok seçenekli `Alert`'i YERİNE.
 *
 * Seçim listesi olan yerlerde onay kutusu yetmiyor (fotoğraf çek / galeriden
 * seç / kaldır). Sistem uyarısı Android'in kendi tipografisiyle çıkıp
 * uygulamanın dilinden kopuyordu; bu sayfa aynı işi ince çizgi ikonlar ve
 * fildişi yüzeyle yapıyor.
 */
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/* Dışarı dokununca kapanıyor */}
      <Pressable style={styles.wrap} onPress={onClose}>
        <Pressable style={[styles.card, { paddingBottom: 14 + insets.bottom }]} onPress={() => {}}>
          <View style={styles.grip} />
          {/* Başlık solda, kapat sağ üstte — diğer alt sayfalarla aynı dil */}
          <View style={styles.head}>
            {title ? <Text style={luxeType.label}>{title}</Text> : <View />}
            <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
              <Ionicons name="close" size={18} color={luxe.primary} />
            </Pressable>
          </View>
          {actions.map((a, i) => (
            <Pressable
              key={a.label}
              onPress={() => {
                onClose();
                // Sayfa kapanma animasyonu bitmeden kamera/galeri açılmasın
                setTimeout(a.onPress, 140);
              }}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.rowLine,
                pressed && { opacity: 0.6 },
              ]}
            >
              {a.icon ? (
                <Ionicons
                  name={a.icon}
                  size={18}
                  color={a.destructive ? luxe.danger : luxe.primary}
                />
              ) : null}
              <Text style={[styles.label, a.destructive && { color: luxe.danger }]}>{a.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: luxe.overlay, justifyContent: 'flex-end' },
  card: {
    /* Zemin OPAK: yarı saydam yüzey + elevation gölgeyi içeri sızdırıyor. */
    backgroundColor: '#FFFDFD',
    borderTopLeftRadius: luxeRadius.lg,
    borderTopRightRadius: luxeRadius.lg,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grip: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: luxe.outlineSoft,
    marginBottom: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  rowLine: { borderTopWidth: 1, borderTopColor: luxe.outlineSoft },
  label: { fontFamily: font.bodyMedium, fontSize: 15, color: luxe.ink },
});
