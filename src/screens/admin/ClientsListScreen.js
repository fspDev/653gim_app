import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useResponsive } from '../../utils/useResponsive';
import { colors, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { getClients } from '../../services/users';
import { Badge, PrimaryButton } from '../../components/UI';

export default function ClientsListScreen({ navigation }) {
  const { logout } = useAuth();
  const layout = useResponsive();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        setClients(await getClients());
        setLoading(false);
      })();
    }, [])
  );

  const filtered = clients.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase())
  );
  const overdueCount = clients.filter((c) => c.feeStatus === 'overdue').length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[{ paddingVertical: 20, paddingBottom: 110 }, layout.contentStyle]}>
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Image source={require('../../../assets/logo653.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          </View>
          <View>
            <Text style={styles.brandName}>PANEL ADMIN</Text>
            <Text style={styles.brandSub}>GYM &amp; FITNESS</Text>
          </View>
        </View>
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Text style={{ color: '#fff', fontSize: 15 }}>⏻</Text>
        </Pressable>
      </View>

      <TextInput
        placeholder="Buscar cliente..."
        placeholderTextColor={colors.gray1}
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      <View style={styles.statGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{clients.length}</Text>
          <Text style={styles.statLabel}>Clientes activos</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{overdueCount}</Text>
          <Text style={styles.statLabel}>Cuotas vencidas</Text>
        </View>
      </View>

      <PrimaryButton title="+ Nuevo cliente" onPress={() => navigation.navigate('NewClient')} />

      <Text style={styles.sectionLabel}>Clientes</Text>
      {loading && <ActivityIndicator color={colors.red} />}
      {!loading && filtered.length === 0 && <Text style={styles.empty}>No hay clientes todavía.</Text>}
      {filtered.map((c) => (
        <Pressable key={c.id} style={styles.row} onPress={() => navigation.navigate('ClientDetail', { clientId: c.id })}>
          <View style={styles.av}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
              {(c.firstName?.[0] || '') + (c.lastName?.[0] || '')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowName}>{c.firstName} {c.lastName}</Text>
            <Text style={styles.rowSub}>
              Plan {c.planType === 'weekly' ? 'semanal' : 'diario'}
            </Text>
          </View>
          <Badge text={c.feeStatus === 'overdue' ? 'Cuota vencida' : 'Al día'} tone={c.feeStatus === 'overdue' ? 'warn' : 'default'} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#fff', overflow: 'hidden' },
  brandName: { color: colors.white, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  brandSub: { color: colors.gray1, fontSize: 9, fontWeight: '600', letterSpacing: 1 },
  logoutBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.black3, alignItems: 'center', justifyContent: 'center' },
  search: {
    backgroundColor: colors.black2, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 14, color: colors.white, fontSize: 13, marginBottom: 16,
  },
  statGrid: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  statBox: { flex: 1, backgroundColor: colors.black2, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 },
  statValue: { color: colors.white, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.gray1, fontSize: 11, marginTop: 2 },
  sectionLabel: { color: colors.gray1, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 },
  empty: { color: colors.gray1, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1c1c1c' },
  av: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.black3, alignItems: 'center', justifyContent: 'center' },
  rowName: { color: colors.white, fontSize: 13.5, fontWeight: '700' },
  rowSub: { color: colors.gray1, fontSize: 11.5, marginTop: 2 },
});
