import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const ITEM_HEIGHT = 54;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

// Source arrays
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['am', 'pm'];

// Triple/multi-copy for infinite-scroll illusion
const PADDED_HOURS = [...HOURS, ...HOURS, ...HOURS];
const PADDED_MINUTES = [...MINUTES, ...MINUTES, ...MINUTES];
// AM/PM: just 2 items, no infinite scroll
const PADDED_PERIODS = PERIODS;

// Starting absolute indices (middle copy of each padded array)
const HOUR_START_OFFSET = HOURS.length;       // 12
const MINUTE_START_OFFSET = MINUTES.length;   // 60
const PERIOD_START_OFFSET = 0;                // 0 = am, 1 = pm

// ─────────────────────────────────────────────
// Wheel column — single reusable scroll picker
// ─────────────────────────────────────────────
interface WheelProps {
  data: string[];
  sourceLength: number;
  selectedAbsIdx: number;
  onSettle: (absIdx: number) => void;
  listRef: React.RefObject<FlatList>;
  width?: number;
  fontSize?: number;
}

function Wheel({
  data,
  sourceLength,
  selectedAbsIdx,
  onSettle,
  listRef,
  width = 72,
  fontSize,
}: WheelProps) {
  const lastHapticIdx = useRef<number>(-1);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const snapToIndex = useCallback(
    (rawAbsIdx: number) => {
      const clamped = Math.max(0, Math.min(rawAbsIdx, data.length - 1));

      // Non-infinite mode (e.g. AM/PM): just clamp and settle
      if (data.length === sourceLength) {
        onSettle(clamped);
        return;
      }

      const actualIdx = clamped % sourceLength;
      const midAbsIdx = sourceLength + actualIdx;

      if (clamped >= sourceLength && clamped < sourceLength * 2) {
        onSettle(clamped);
      } else {
        // Silently jump to equivalent slot in middle copy
        listRef.current?.scrollToOffset({
          offset: midAbsIdx * ITEM_HEIGHT,
          animated: false,
        });
        onSettle(midAbsIdx);
      }
    },
    [data.length, sourceLength, onSettle, listRef]
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const idx = Math.round(y / ITEM_HEIGHT);
      if (idx !== lastHapticIdx.current) {
        lastHapticIdx.current = idx;
        Haptics.selectionAsync();
      }
    },
    []
  );

  // onScrollEndDrag: force snap to nearest row; momentum end will update state
  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const snapY = Math.round(y / ITEM_HEIGHT) * ITEM_HEIGHT;
      listRef.current?.scrollToOffset({ offset: snapY, animated: true });
    },
    [listRef]
  );

  // onMomentumScrollEnd: wheel has settled — update state
  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const absIdx = Math.round(y / ITEM_HEIGHT);
      snapToIndex(absIdx);
    },
    [snapToIndex]
  );

  return (
    <View style={[styles.wheelWrapper, { width }]}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <View style={styles.itemContainer}>
            <Text
              style={[
                styles.itemText,
                fontSize ? { fontSize } : null,
                index === selectedAbsIdx && styles.selectedItemText,
                fontSize && index === selectedAbsIdx ? { fontSize: fontSize + 4 } : null,
              ]}
            >
              {item}
            </Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate={0.85}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: PADDING }}
        getItemLayout={getItemLayout}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────
interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  initialDate: Date;
}

export default function TimePickerModal({
  visible,
  onClose,
  onSelect,
  initialDate,
}: TimePickerModalProps) {
  const initialH = initialDate.getHours() % 12 || 12;
  const initialM = initialDate.getMinutes();
  const initialPIdx = initialDate.getHours() >= 12 ? 1 : 0;

  const [centeredHourAbsIdx, setCenteredHourAbsIdx] = useState(
    HOUR_START_OFFSET + initialH - 1
  );
  const [centeredMinuteAbsIdx, setCenteredMinuteAbsIdx] = useState(
    MINUTE_START_OFFSET + initialM
  );
  const [centeredPeriodAbsIdx, setCenteredPeriodAbsIdx] = useState(
    PERIOD_START_OFFSET + initialPIdx
  );

  const hourRef = useRef<FlatList>(null);
  const minuteRef = useRef<FlatList>(null);
  const periodRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible) return;

    const h = initialDate.getHours() % 12 || 12;
    const m = initialDate.getMinutes();
    const pIdx = initialDate.getHours() >= 12 ? 1 : 0;

    const hAbsIdx = HOUR_START_OFFSET + h - 1;
    const mAbsIdx = MINUTE_START_OFFSET + m;
    const pAbsIdx = PERIOD_START_OFFSET + pIdx;

    setCenteredHourAbsIdx(hAbsIdx);
    setCenteredMinuteAbsIdx(mAbsIdx);
    setCenteredPeriodAbsIdx(pAbsIdx);

    const timer = setTimeout(() => {
      hourRef.current?.scrollToOffset({ offset: hAbsIdx * ITEM_HEIGHT, animated: false });
      minuteRef.current?.scrollToOffset({ offset: mAbsIdx * ITEM_HEIGHT, animated: false });
      periodRef.current?.scrollToOffset({ offset: pAbsIdx * ITEM_HEIGHT, animated: false });
    }, 100);

    return () => clearTimeout(timer);
  }, [visible]);

  const handleConfirm = () => {
    const date = new Date(initialDate);
    const hour12 = parseInt(HOURS[centeredHourAbsIdx % HOURS.length]);
    const minute = parseInt(MINUTES[centeredMinuteAbsIdx % MINUTES.length]);
    const pIdx = centeredPeriodAbsIdx % PERIODS.length;

    let hour24 = hour12;
    if (pIdx === 1 && hour12 !== 12) hour24 = hour12 + 12; // pm
    if (pIdx === 0 && hour12 === 12) hour24 = 0;            // 12 am = midnight

    date.setHours(hour24);
    date.setMinutes(minute);
    date.setSeconds(0);
    onSelect(date);
  };

  const presets: { label: string; h: number; m: number; pIdx: number }[] = [
    { label: '9 am',  h: 9,  m: 0, pIdx: 0 },
    { label: '12 pm', h: 12, m: 0, pIdx: 1 },
    { label: '4 pm',  h: 4,  m: 0, pIdx: 1 },
    { label: '6 pm',  h: 6,  m: 0, pIdx: 1 },
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const hAbsIdx = HOUR_START_OFFSET + preset.h - 1;
    const mAbsIdx = MINUTE_START_OFFSET + preset.m;
    const pAbsIdx = PERIOD_START_OFFSET + preset.pIdx;

    setCenteredHourAbsIdx(hAbsIdx);
    setCenteredMinuteAbsIdx(mAbsIdx);
    setCenteredPeriodAbsIdx(pAbsIdx);

    hourRef.current?.scrollToOffset({ offset: hAbsIdx * ITEM_HEIGHT, animated: true });
    minuteRef.current?.scrollToOffset({ offset: mAbsIdx * ITEM_HEIGHT, animated: true });
    periodRef.current?.scrollToOffset({ offset: pAbsIdx * ITEM_HEIGHT, animated: true });
  };

  const currentHour = parseInt(HOURS[centeredHourAbsIdx % HOURS.length]);
  const currentMinute = parseInt(MINUTES[centeredMinuteAbsIdx % MINUTES.length]);
  const currentPIdx = centeredPeriodAbsIdx % PERIODS.length;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} onPress={onClose} />
        <View style={styles.content}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Time</Text>
            <TouchableOpacity onPress={handleConfirm} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Wheels */}
          <View style={styles.pickerContainer}>
            {/* Highlight bar */}
            <View style={styles.highlightBarContainer} pointerEvents="none">
              <View style={styles.highlightBar} />
            </View>

            {/* Hour */}
            <Wheel
              data={PADDED_HOURS}
              sourceLength={HOURS.length}
              selectedAbsIdx={centeredHourAbsIdx}
              onSettle={setCenteredHourAbsIdx}
              listRef={hourRef}
              width={72}
            />

            {/* Colon */}
            <View style={styles.separator}>
              <Text style={styles.separatorText}>:</Text>
            </View>

            {/* Minute */}
            <Wheel
              data={PADDED_MINUTES}
              sourceLength={MINUTES.length}
              selectedAbsIdx={centeredMinuteAbsIdx}
              onSettle={setCenteredMinuteAbsIdx}
              listRef={minuteRef}
              width={72}
            />

            {/* AM / PM — now a scroll wheel, lowercase, no border */}
            <Wheel
              data={PADDED_PERIODS}
              sourceLength={PERIODS.length}
              selectedAbsIdx={centeredPeriodAbsIdx}
              onSettle={setCenteredPeriodAbsIdx}
              listRef={periodRef}
              width={52}
              fontSize={18}
            />

            {/* Fade gradients */}
            <LinearGradient
              colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
              style={styles.topGradient}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)']}
              style={styles.bottomGradient}
              pointerEvents="none"
            />
          </View>

          {/* Presets */}
          <View style={styles.presetsContainer}>
            <Text style={styles.presetsTitle}>Presets</Text>
            <View style={styles.presetsRow}>
              {presets.map((p) => {
                const active =
                  currentHour === p.h &&
                  currentMinute === p.m &&
                  currentPIdx === p.pIdx;
                return (
                  <TouchableOpacity
                    key={p.label}
                    style={[styles.presetChip, active && styles.presetChipActive]}
                    onPress={() => applyPreset(p)}
                  >
                    <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  content: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  doneButton: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    backgroundColor: '#007AFF',
    borderRadius: 20,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  pickerContainer: {
    flexDirection: 'row',
    height: PICKER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  wheelWrapper: {
    height: '100%',
    overflow: 'hidden',
  },
  itemContainer: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 22,
    color: '#bbb',
    fontWeight: '500',
  },
  selectedItemText: {
    color: '#111',
    fontSize: 28,
    fontWeight: '700',
  },
  highlightBarContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  highlightBar: {
    height: ITEM_HEIGHT + 8,
    backgroundColor: '#EEF3FF',
    borderRadius: 14,
    marginHorizontal: 4,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: PADDING,
    zIndex: 10,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PADDING,
    zIndex: 10,
  },
  separator: {
    width: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 11,
  },
  separatorText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  presetsContainer: {
    marginTop: 8,
    paddingBottom: 6,
  },
  presetsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  presetChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  presetChipText: {
    fontSize: 14,
    color: '#444',
    fontWeight: '500',
  },
  presetChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});