import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { useRestTimer } from '../context/RestTimerContext';
import { formatMMSS } from '../utils/time';

export default function RestTimerBanner({ onPress }) {
  const restTimer = useRestTimer();
  if (!restTimer.resting) return null;

  return (
    <View style={styles.banner}>
      <Pressable style={styles.bannerMain} onPress={onPress}>
        <View style={styles.dot} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Descansando · {restTimer.exerciseName}</Text>
          <Text style={styles.sub}>Tocá para volver</Text>
        </View>
        <Text style={styles.time}>{formatMMSS(restTimer.restLeft)}</Text>
      </Pressable>
      {restTimer.pipSupported && !restTimer.pipActive && (
        <Pressable style={styles.pipIconBtn} onPress={() => restTimer.enterPiP()}>
          <Text style={styles.pipIcon}>🗗</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 84,
    backgroundColor: colors.black2,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 50,
  },
  bannerMain: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  label: { color: colors.white, fontSize: 12.5, fontWeight: '700' },
  sub: { color: colors.gray1, fontSize: 10.5, marginTop: 1 },
  time: { color: colors.red, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  pipIconBtn: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: colors.black3,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  pipIcon: { fontSize: 16 },
});
