import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/UI';
import { font, luxe, luxeRadius, luxeShadow, luxeType } from '@/theme/luxe';

/**
 * Onay kutusu — sistemin `Alert.alert`'i YERİNE.
 *
 * Sistem uyarısı Android'in kendi tipografisi ve mavi düğmeleriyle çıkıyor;
 * uygulamanın fildişi/serif diliyle hiç ilgisi yok ve silme gibi kritik bir
 * anda "başka bir uygulamaya geçmiş" hissi veriyor. Bu kutu aynı işi
 * uygulamanın kendi diliyle yapıyor.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Sil',
  cancelLabel = 'Vazgeç',
  destructive = true,
  notice,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Kırmızı dolgu — geri alınamaz eylemler için. */
  destructive?: boolean;
  /**
   * Uyarı kipi: seçim yok, tek "Tamam" düğmesi. "İsim gerekli" gibi bilgi
   * kutuları da sistem uyarısıyla çıkmasın diye.
   */
  notice?: boolean;
  /** Uyarı kipinde çağrılmaz. */
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
      {/* Dışarı dokununca kapanıyor — sistem uyarısında da öyle */}
      <Pressable style={styles.wrap} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {message ? (
            <Text style={[luxeType.body, { marginTop: 8 }]}>{message}</Text>
          ) : null}
          <View style={styles.row}>
            {notice ? (
              <Button title="Tamam" onPress={onCancel} style={{ flex: 1 }} />
            ) : (
              <>
                <Button variant="ghost" title={cancelLabel} onPress={onCancel} style={{ flex: 1 }} />
                <Button
                  variant={destructive ? 'danger' : 'primary'}
                  title={confirmLabel}
                  onPress={onConfirm}
                  style={{ flex: 1 }}
                />
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: luxe.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    /* Zemin OPAK: yarı saydam yüzey + elevation gölgeyi içeri sızdırıyor. */
    backgroundColor: '#FFFDFD',
    borderRadius: luxeRadius.lg,
    padding: 22,
    ...luxeShadow.card,
  },
  title: {
    fontFamily: font.headlineItalic,
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 30,
    color: luxe.primary,
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 18 },
});
