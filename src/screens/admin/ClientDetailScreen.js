import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Switch, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius } from '../../theme/colors';
import { getUserProfile } from '../../services/users';
import { getPlanDays, savePlanDay, deletePlanDay, newExercise } from '../../services/plans';
import { getSession, computePercent, todayId, getRecentSessions } from '../../services/sessions';
import { getExerciseLibrary, upsertLibraryExercise } from '../../services/exerciseLibrary';
import { changeClientPassword, updateClientProfile, usernameToEmail } from '../../services/clientAccounts';
import { PrimaryButton, SecondaryButton, FormField } from '../../components/UI';
import { notify, confirmAction } from '../../utils/platformAlert';

export default function ClientDetailScreen({ route }) {
  const { clientId } = route.params;
  const [client, setClient] = useState(null);
  const [days, setDays] = useState([]);
  const [library, setLibrary] = useState([]);
  const [todayPercent, setTodayPercent] = useState(0);
  const [totalSets, setTotalSets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [phone, setPhone] = useState('');
  const [coachName, setCoachName] = useState('');
  const [planType, setPlanType] = useState('weekly');
  const [feeOk, setFeeOk] = useState(true);
  const [savingInfo, setSavingInfo] = useState(false);

  const [newDni, setNewDni] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');

  const [picker, setPicker] = useState(null); // { dayId, group }
  const [pickerQuery, setPickerQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const profile = await getUserProfile(clientId);
    setClient(profile);
    setPhone(profile?.phone || '');
    setCoachName(profile?.coachName || '');
    setPlanType(profile?.planType || 'weekly');
    setFeeOk((profile?.feeStatus || 'ok') === 'ok');

    const planDays = await getPlanDays(clientId);
    setDays(planDays);
    setLibrary(await getExerciseLibrary());

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

  function openPicker(dayId, group) {
    setPicker({ dayId, group });
    setPickerQuery('');
  }

  function addExerciseFromLibrary(libEx) {
    const { dayId, group } = picker;
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const list = d.groups[group];
        const ex = newExercise({
          name: libEx.name,
          sets: libEx.defaultSets || 3,
          reps: libEx.defaultReps || 12,
          restSeconds: libEx.defaultRestSeconds || 60,
          order: list.length + 1,
        });
        return { ...d, groups: { ...d.groups, [group]: [...list, ex] } };
      })
    );
    setPicker(null);
  }

  function addNewExercise() {
    if (!pickerQuery.trim()) return;
    addExerciseFromLibrary({ name: pickerQuery.trim(), defaultSets: 3, defaultReps: 12, defaultRestSeconds: 60 });
  }

  async function savePlan(day) {
    setSaving(true);
    try {
      await savePlanDay(clientId, day.id, { label: day.label, order: day.order, groups: day.groups });
      const allExercises = [...day.groups.core, ...day.groups.fuerza];
      await Promise.all(
        allExercises.map((ex) =>
          upsertLibraryExercise({ name: ex.name, sets: ex.sets, reps: ex.reps, restSeconds: ex.restSeconds })
        )
      );
      setLibrary(await getExerciseLibrary());
      notify('Listo', `${day.label} guardado.`);
    } catch (e) {
      notify('Error', 'No se pudo guardar el plan.');
    }
    setSaving(false);
  }

  async function addDay() {
    const nextOrder = days.length ? Math.max(...days.map((d) => d.order || 0)) + 1 : 1;
    const dayId = `day${Date.now()}`;
    const newDay = { id: dayId, label: `Día ${days.length + 1}`, order: nextOrder, groups: { core: [], fuerza: [] } };
    await savePlanDay(clientId, dayId, { label: newDay.label, order: newDay.order, groups: newDay.groups });
    setDays((prev) => [...prev, newDay]);
  }

  function confirmDeleteDay(day) {
    confirmAction('Eliminar día', `¿Eliminar "${day.label}" del plan? Esta acción no se puede deshacer.`, () => removeDay(day));
  }

  async function removeDay(day) {
    await deletePlanDay(clientId, day.id);
    setDays((prev) => prev.filter((d) => d.id !== day.id));
  }

  async function saveClientInfo() {
    setSavingInfo(true);
    try {
      await updateClientProfile(clientId, {
        phone,
        coachName,
        planType,
        feeStatus: feeOk ? 'ok' : 'overdue',
      });
      setClient((prev) => ({ ...prev, phone, coachName, planType, feeStatus: feeOk ? 'ok' : 'overdue' }));
    } catch (e) {
      notify('Error', 'No se pudieron guardar los datos.');
    }
    setSavingInfo(false);
  }

  async function handleChangePassword() {
    setPasswordMsg('');
    if (!newDni.trim() || newDni.trim().length < 6) {
      setPasswordMsg('La nueva contraseña (DNI) debe tener al menos 6 dígitos.');
      return;
    }
    setChangingPassword(true);
    try {
      const email = usernameToEmail(client.username || `${client.firstName} ${client.lastName}`);
      await changeClientPassword({ email, currentDni: client.dni, newDni: newDni.trim() });
      await updateClientProfile(clientId, { dni: newDni.trim() });
      setClient((prev) => ({ ...prev, dni: newDni.trim() }));
      setNewDni('');
      setPasswordMsg('✓ Contraseña actualizada.');
    } catch (e) {
      setPasswordMsg('No se pudo cambiar la contraseña. Probá de nuevo.');
    }
    setChangingPassword(false);
  }

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }

  const filteredLibrary = library
    .filter((e) => e.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()))
    .slice(0, 6);
  const exactMatch = library.some((e) => e.name.toLowerCase() === pickerQuery.trim().toLowerCase());

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
          <Text style={styles.sub}>Usuario: {client?.username}</Text>
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

      <Text style={styles.sectionLabel}>Datos del cliente</Text>
      <FormField label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="011 5555-0102" />
      <FormField label="Profe" value={coachName} onChangeText={setCoachName} placeholder="Agus" autoCapitalize="words" />

      <View style={styles.planTypeRow}>
        {['weekly', 'daily'].map((pt) => (
          <Pressable key={pt} onPress={() => setPlanType(pt)} style={[styles.planTypePill, planType === pt && styles.planTypePillActive]}>
            <Text style={[styles.planTypeText, planType === pt && styles.planTypeTextActive]}>
              {pt === 'weekly' ? 'Plan semanal' : 'Plan diario'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.feeRow}>
        <Text style={styles.feeLabel}>Cuota al día</Text>
        <Switch value={feeOk} onValueChange={setFeeOk} trackColor={{ false: colors.black3, true: colors.green }} thumbColor="#fff" />
      </View>

      <PrimaryButton
        title={savingInfo ? 'Guardando...' : 'Guardar datos'}
        onPress={saveClientInfo}
        disabled={savingInfo}
        style={{ marginTop: 4, marginBottom: 22 }}
      />

      <Text style={styles.sectionLabel}>Cambiar contraseña</Text>
      <Text style={styles.hint}>Contraseña actual: {client?.dni}</Text>
      <FormField
        label="Nueva contraseña (DNI)"
        value={newDni}
        onChangeText={setNewDni}
        keyboardType="number-pad"
        placeholder="Nuevo DNI"
      />
      {!!passwordMsg && <Text style={passwordMsg.startsWith('✓') ? styles.success : styles.error}>{passwordMsg}</Text>}
      <SecondaryButton
        title={changingPassword ? 'Cambiando...' : 'Cambiar contraseña'}
        onPress={handleChangePassword}
        style={{ marginBottom: 10 }}
      />

      {days.map((day) => (
        <View key={day.id}>
          <View style={styles.dayHeaderRow}>
            <Text style={[styles.sectionLabel, { marginTop: 22, marginBottom: 0 }]}>Plan · {day.label}</Text>
            <Pressable onPress={() => confirmDeleteDay(day)}>
              <Text style={styles.deleteDayText}>Eliminar día</Text>
            </Pressable>
          </View>
          <GroupEditor
            title="Core"
            exercises={day.groups.core}
            onChange={(exId, field, value) => updateExercise(day.id, 'core', exId, field, value)}
            onRemove={(exId) => removeExercise(day.id, 'core', exId)}
            onAdd={() => openPicker(day.id, 'core')}
          />
          <GroupEditor
            title="Fuerza"
            exercises={day.groups.fuerza}
            onChange={(exId, field, value) => updateExercise(day.id, 'fuerza', exId, field, value)}
            onRemove={(exId) => removeExercise(day.id, 'fuerza', exId)}
            onAdd={() => openPicker(day.id, 'fuerza')}
          />

          {picker?.dayId === day.id && (
            <View style={styles.pickerBox}>
              <Text style={styles.pickerLabel}>Buscar o crear ejercicio</Text>
              <TextInput
                value={pickerQuery}
                onChangeText={setPickerQuery}
                placeholder="Ej: Press banca con barra"
                placeholderTextColor={colors.gray2}
                style={styles.pickerInput}
                autoFocus
              />
              {filteredLibrary.map((lib) => (
                <Pressable key={lib.id} style={styles.pickerRow} onPress={() => addExerciseFromLibrary(lib)}>
                  <Text style={styles.pickerRowText}>{lib.name}</Text>
                  <Text style={styles.pickerRowMeta}>{lib.defaultSets}×{lib.defaultReps}</Text>
                </Pressable>
              ))}
              {!!pickerQuery.trim() && !exactMatch && (
                <Pressable style={styles.pickerCreateBtn} onPress={addNewExercise}>
                  <Text style={styles.pickerCreateText}>+ Crear "{pickerQuery.trim()}"</Text>
                </Pressable>
              )}
              <SecondaryButton title="Cancelar" onPress={() => setPicker(null)} style={{ marginTop: 8 }} />
            </View>
          )}

          <PrimaryButton
            title={saving ? 'Guardando...' : `Guardar ${day.label}`}
            onPress={() => savePlan(day)}
            disabled={saving}
            style={{ marginTop: 6, marginBottom: 24 }}
          />
        </View>
      ))}

      <SecondaryButton title="+ Agregar día" onPress={addDay} style={{ marginBottom: 30 }} />
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
      {exercises.length === 0 && <Text style={styles.emptyGroup}>Sin ejercicios todavía.</Text>}
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
  hint: { color: colors.gray1, fontSize: 12, marginBottom: 12 },
  success: { color: colors.green, fontSize: 12.5, fontWeight: '600', marginBottom: 10 },
  error: { color: '#ff6b76', fontSize: 12.5, fontWeight: '600', marginBottom: 10 },
  planTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  planTypePill: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.black3, alignItems: 'center' },
  planTypePillActive: { backgroundColor: colors.red },
  planTypeText: { color: colors.gray1, fontSize: 12.5, fontWeight: '700' },
  planTypeTextActive: { color: '#fff' },
  feeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.black2, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 16,
  },
  feeLabel: { color: colors.white, fontSize: 13, fontWeight: '700' },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deleteDayText: { color: '#ff6b76', fontSize: 11.5, fontWeight: '700', marginTop: 22 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 8 },
  groupTitle: { color: colors.red, fontSize: 12.5, fontWeight: '800', textTransform: 'uppercase' },
  groupLine: { flex: 1, height: 1, backgroundColor: colors.redDim },
  emptyGroup: { color: colors.gray1, fontSize: 12, marginBottom: 8 },
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
  pickerBox: {
    backgroundColor: colors.black2, borderWidth: 1, borderColor: colors.red, borderRadius: 12,
    padding: 12, marginTop: 8,
  },
  pickerLabel: { color: colors.gray1, fontSize: 10.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  pickerInput: {
    backgroundColor: colors.black3, color: colors.white, fontSize: 13, fontWeight: '600',
    borderRadius: 8, paddingVertical: 10, paddingHorizontal: 10, marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#232323',
  },
  pickerRowText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  pickerRowMeta: { color: colors.gray1, fontSize: 11.5 },
  pickerCreateBtn: { paddingVertical: 10 },
  pickerCreateText: { color: colors.red, fontSize: 13, fontWeight: '700' },
});
