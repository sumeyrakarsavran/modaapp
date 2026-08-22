import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, View, type ViewStyle } from 'react-native';

/**
 * Basılı tutup sürükleyerek SIRALAMA.
 *
 * Kütüphane kullanılmıyor: `react-native-draggable-flatlist` reanimated'ın
 * babel eklentisini şart koşuyor, bu projede o eklenti kurulu değil (bkz.
 * AGENTS.md) ve sessizce çalışmıyor. Burada RN'in kendi `Animated`'ı yetiyor.
 *
 * Karolar MUTLAK konumlu: sıra değişince her karo yeni yuvasına yaylanarak
 * gidiyor, sürüklenen karo parmağı takip ediyor.
 */
export function Reorderable<T>({
  data,
  keyOf,
  renderItem,
  columns = 1,
  cellW,
  cellH,
  gap = 0,
  onReorder,
  onDragChange,
  style,
}: {
  data: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, dragging: boolean) => React.ReactNode;
  columns?: number;
  cellW: number;
  cellH: number;
  gap?: number;
  /** Bırakınca yeni sıradaki anahtarlar. */
  onReorder: (keys: string[]) => void;
  /**
   * Sürükleme başlayınca/bitince haber verir. Yatay bir ScrollView içinde
   * kullanılırken kaydırmayı KAPATMAK için gerekiyor — yoksa ScrollView
   * hareketi kapıyor ve karo yerinden oynamıyor.
   */
  onDragChange?: (dragging: boolean) => void;
  style?: ViewStyle;
}) {
  /** Ekrandaki sıra — sürükleme boyunca yerel, bırakınca üste bildiriliyor. */
  const [order, setOrder] = useState<T[]>(data);
  const [dragKey, setDragKey] = useState<string | null>(null);

  /*
    Dışarıdaki liste değişince (ekleme/silme) yerel sırayı tazele. Sürükleme
    sürerken DOKUNMA: kendi ara sıralamamızı ezip karoyu zıplatırdı.
  */
  const dragRef = useRef<string | null>(null);
  useEffect(() => {
    if (dragRef.current) return;
    setOrder(data);
  }, [data]);

  const slot = (i: number) => ({
    x: (i % columns) * (cellW + gap),
    y: Math.floor(i / columns) * (cellH + gap),
  });

  /** Her karonun konumu — sıradaki yerine yaylanarak gidiyor. */
  const posRef = useRef(new Map<string, Animated.ValueXY>());
  const pos = (key: string, i: number) => {
    let v = posRef.current.get(key);
    if (!v) {
      const s = slot(i);
      v = new Animated.ValueXY({ x: s.x, y: s.y });
      posRef.current.set(key, v);
    }
    return v;
  };

  // Sıra değiştikçe sürüklenmeyen karolar yeni yuvasına kaysın
  useEffect(() => {
    order.forEach((item, i) => {
      const key = keyOf(item);
      if (key === dragRef.current) return;
      const s = slot(i);
      Animated.spring(pos(key, i), {
        toValue: s,
        /*
          NATIVE sürücü: konum `transform` ile veriliyor, o da native tarafta
          canlandırılabiliyor. JS ipliğinde çalışırken her kare JS'ten geçiyor
          ve sürükleme takılıyordu.
        */
        useNativeDriver: true,
        friction: 12,
        tension: 90,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, columns, cellW, cellH, gap]);

  /*
    Güncel değerler ref'ten okunuyor: PanResponder'lar BİR KEZ kuruluyor.
    Bağımlılığa prop konsaydı her çizimde yeni algılayıcı yaratılır, hareketin
    ortasında `gestureState` sıfırlanıp karo zıplardı (bkz. AGENTS.md).
  */
  const cur = useRef({ order, onReorder, keyOf, columns, cellW, cellH, gap, count: data.length });
  cur.current = { order, onReorder, keyOf, columns, cellW, cellH, gap, count: data.length };

  const start = useRef({ x: 0, y: 0, index: 0 });
  /** Sabit algılayıcılar içinden çağrılıyor — güncel geri çağrı ref'ten. */
  const onDragChangeRef = useRef(onDragChange);
  onDragChangeRef.current = onDragChange;
  /** Basılı tutma sayacı — bileşen başına bir tane. */
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const responders = useMemo(
    () => new Map<string, ReturnType<typeof PanResponder.create>>(),
    [],
  );
  const responderFor = (key: string) => {
    let r = responders.get(key);
    if (r) return r;
    r = PanResponder.create({
      // Basılı TUTUNCA başlıyor: normal dokunuş karoyu açmaya devam etsin
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => dragRef.current === key,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const i = cur.current.order.findIndex((x) => cur.current.keyOf(x) === key);
        const c = cur.current;
        start.current = {
          x: (i % c.columns) * (c.cellW + c.gap),
          y: Math.floor(i / c.columns) * (c.cellH + c.gap),
          index: i,
        };
      },
      onPanResponderMove: (_e, g) => {
        const c = cur.current;
        const x = start.current.x + g.dx;
        const y = start.current.y + g.dy;
        pos(key, start.current.index).setValue({ x, y });

        /*
          Parmağın MERKEZİNE en yakın yuva hedef sıradır. Satır sayısı da
          sınırlanıyor: tek satırlık (yatay) bir listede dikey kayma satırı
          1'e çıkarıp karoyu en sona fırlatıyordu.
        */
        const rowCount = Math.ceil(c.count / c.columns);
        const col = Math.max(0, Math.min(c.columns - 1, Math.round(x / (c.cellW + c.gap))));
        const row = Math.max(0, Math.min(rowCount - 1, Math.round(y / (c.cellH + c.gap))));
        const target = Math.max(0, Math.min(c.count - 1, row * c.columns + col));
        const from = c.order.findIndex((it) => c.keyOf(it) === key);
        if (target !== from && from >= 0) {
          const next = [...c.order];
          const [moved] = next.splice(from, 1);
          next.splice(target, 0, moved);
          setOrder(next);
        }
      },
      onPanResponderRelease: () => finish(key),
      onPanResponderTerminate: () => finish(key),
    });
    responders.set(key, r);
    return r;
  };

  const finish = (key: string) => {
    const c = cur.current;
    const i = c.order.findIndex((x) => c.keyOf(x) === key);
    const s = {
      x: (i % c.columns) * (c.cellW + c.gap),
      y: Math.floor(i / c.columns) * (c.cellH + c.gap),
    };
    Animated.spring(pos(key, i), {
      toValue: s,
      useNativeDriver: true,
      friction: 12,
      tension: 90,
    }).start();
    dragRef.current = null;
    setDragKey(null);
    onDragChangeRef.current?.(false);
    c.onReorder(c.order.map((x) => c.keyOf(x)));
  };

  const rows = Math.ceil(order.length / columns);
  return (
    <View style={[{ height: rows * cellH + Math.max(0, rows - 1) * gap }, style]}>
      {order.map((item, i) => {
        const key = keyOf(item);
        const dragging = dragKey === key;
        return (
          <Animated.View
            key={key}
            {...responderFor(key).panHandlers}
            onStartShouldSetResponder={() => false}
            style={{
              position: 'absolute',
              width: cellW,
              transform: pos(key, i).getTranslateTransform(),
              /*
                Sürüklenen karo ÜSTTE kalmalı. Android'de sırayı `elevation`
                belirliyor — `zIndex` tek başına yetmiyor (bkz. AGENTS.md).
              */
              zIndex: dragging ? 20 : 1,
              elevation: dragging ? 20 : 0,
            }}
          >
            <View
              onTouchStart={() => {
                // Basılı tutma: 220ms sonra sürükleme kipine geçiyor
                const t = setTimeout(() => {
                  dragRef.current = key;
                  setDragKey(key);
                  onDragChange?.(true);
                }, 220);
                holdRef.current = t;
              }}
              onTouchEnd={() => {
                if (holdRef.current) clearTimeout(holdRef.current);
              }}
              onTouchCancel={() => {
                if (holdRef.current) clearTimeout(holdRef.current);
              }}
            >
              {renderItem(item, dragging)}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}
