import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius } from '../../theme/colors';
import { getUserProfile } from '../../services/users';
import { getPlanDays, savePlanDay, newExercise } from '../../services/plans';
import { getSession, computePercent, todayId, getRecentSessions } from '../../services/sessions';
import { seedDemoPlan } from '../../services/seed';
import { PrimaryButton } from '../../components/UI';

export default function ClientDetailScreen({ route }) {
  const { clientId } = route.params;
  const [client, setClient] = useState(null);
  const [days, setDays] = useState([]);
  const [todayPercent, setTodayPercent] = useState(0);
  const [totalSets, setTotalSets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const profile = await getUserProfile(clientId);
    setClient(profile);

    let planDays = await getPlanDays(clientId);
    if (planDays.length === 0) {
      await seedDemoPlan(clientId);
      planDays = await getPlanDays(clientId);
    }
    setDays(planDays);

    const session = await getSession(clientId, todayId());
    setTodayPercent(computePercent(session));

    const recent = await getRecentSessions(clientId, 30);
    setTotalSets(recent.reduce((acc, s) => acc + s.exercises.reduce((a, e) => a + e.sets.length, 0), 0));

    setLoading(false);
  }, [clientId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function updateExercise(dayId, group, exId, field, value) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        return {
          ...d,
          groups: {
            ...d.groups,
            [group]: d.groups[group].map((ex) =>
              ex.id === exId ? { ...ex, [field]: field === 'name' ? value : Number(value) || 0 } : ex
            ),
          },
        };
      })
    );
  }

  function removeExercise(dayId, group, exId) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        return { ...d, groups: { ...d.groups, [group]: d.groups[group].filter((ex) => ex.id !== exId) } };
      })
    );
  }

  function addExercise(dayId, group) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const list = d.groups[group];
        const ex = newExercise({ name: 'Nuevo ejercicio', sets: 3, reps: 12, restSeconds: 60, order: list.length + 1 });
        return { ...d, groups: { ...d.groups, [group]: [...list, ex] } };
      })
    );
  }

  async function savePlan(day) {
    setSaving(true);
    try {
      await savePlanDay(clientId, day.id, { label: day.label, order: day.order, groups: day.groups });
      Alert.alert('Listo', `${day.label} guardado.`);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el plan.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 110 }}>
      <View style={styles.headerRow}>
        <View style={styles.av}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            {(client?.firstName?.[0] || '') + (client?.lastName?.[0] || '')}
          </Text>
        </View>
        <View>
          <Text style={styles.name}>{client?.firstName} {client?.lastName}</Text>
          <Text style={styles.sub}>{client?.phone || '—'} · DNI {client?.dni || '—'}</Text>
        </View>
      </View>

      <View style={styles.statGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{todayPercent}%</Text>
          <Text style={styles.statLabel}>Progreso hoy</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{totalSets}</Text>
          <Text style={styles.statLabel}>Series (30 días)</Text>
        </View>
      </View>

      {days.map((day) => (
        <View key={day.id}>
          <Text style={styles.sectionLabel}>Plan · {day.label}</Text>
          <GroupEditor
            title="Core"
            group="core"
            exercises={day.groups.core}
            onChange={(exId, field, value) => updateExercise(day.id, 'core', exId, field, value)}
            onRemove={(exId) => removeExercise(day.id, 'core', exId)}
            onAdd={() => addExercise(day.id, 'core')}
          />
          <GroupEditor
            title="Fuerza"
            group="fuerza"
            exercises={day.groups.fuerza}
            onChange={(exId, field, value) => updateExercise(day.id, 'fuerza', exId, field, value)}
            onRemove={(exId) => removeExercise(day.id, 'fuerza', exId)}
            onAdd={() => addExercise(day.id, 'fuerza')}
          />
          <PrimaryButton
            title={saving ? 'Guardando...' : `Guardar ${day.label}`}
            onPress={() => savePlan(day)}
            disabled={saving}
            style={{ marginTop: 6, marginBottom: 24 }}
          />
        </View>
      ))}
    </ScrollView>
  );
}

function GroupEditor({ title, exercises, onChange, onRemove, onAdd }) {
  return (
    <View>
      <View style={styles.groupTitleRow}>
        <Text style={styles.groupTitle}>● {title}</Text>
        <View style={styles.groupLine} />
      </View>
      {exercises.map((ex) => (
        <View key={ex.id} style={styles.editRow}>
          <View style={{ flex: 1 }}>
            <TextInput
              value={ex.name}
              onChangeText={(v) => onChange(ex.id, 'name', v)}
              style={styles.nameInput}
              placeholderTextColor={colors.gray2}
            />
            <View style={styles.numRow}>
              <NumField label="Series" value={ex.sets} onChange={(v) => onChange(ex.id, 'sets', v)} />
              <NumField label="Reps" value={ex.reps} onChange={(v) => onChange(ex.id, 'reps', v)} />
              <NumField label="Desc.(s)" value={ex.restSeconds} onChange={(v) => onChange(ex.id, 'restSeconds', v)} />
            </View>
          </View>
          <Pressable onPress={() => onRemove(ex.id)} style={styles.delBtn}>
            <Text style={{ color: colors.red, fontSize: 16 }}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addBtn} onPress={onAdd}>
        <Text style={styles.addBtnText}>+ Agregar ejercicio</Text>
      </Pressable>
    </View>
  );
}

function NumField({ label, value, onChange }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.numLabel}>{label}</Text>
      <TextInput
        value={String(value)}
        onChangeText={onChange}
        keyboardType="numeric"
        style={styles.numInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  av: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.black3, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.red },
  name: { color: colors.white, fontSize: 17, fontWeight: '800' },
  sub: { color: colors.gray1, fontSize: 11.5, marginTop: 2 },
  statGrid: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  statBox: { flex: 1, backgroundColor: colors.black2, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 },
  statValue: { color: colors.white, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.gray1, fontSize: 11, marginTop: 2 },
  sectionLabel: { color: colors.gray1, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 8 },
  groupTitle: { color: colors.red, fontSize: 12.5, fontWeight: '800', textTransform: 'uppercase' },
  groupLine: { flex: 1, height: 1, backgroundColor: colors.redDim },
  editRow: {
    flexDirection: 'row', backgroundColor: colors.black2, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 12, marginBottom: 8, gap: 10, alignItems: 'flex-start',
  },
  nameInput: { color: colors.white, fontSize: 13, fontWeight: '700', paddingVertical: 2, marginBottom: 8 },
  numRow: { flexDirection: 'row', gap: 8 },
  numLabel: { color: colors.gray1, fontSize: 9.5, fontWeight: '700', marginBottom: 3 },
  numInput: {
    backgroundColor: colors.black3, color: colors.white, fontSize: 12.5, fontWeight: '700',
    borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, textAlign: 'center',
  },
  delBtn: { padding: 4 },
  addBtn: {
    borderWidth: 1.5, borderColor: '#333', borderStyle: 'dashed', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginTop: 2,
  },
  addBtnText: { color: colors.gray1, fontSize: 12.5, fontWeight: '700' },
});
