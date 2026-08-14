import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { FormField, PrimaryButton, SecondaryButton } from '../../components/UI';
import { createClientAccount } from '../../services/clientAccounts';

export default function NewClientScreen({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [dni, setDni] = useState('');
  const [coachName, setCoachName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  async function handleSubmit() {
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('Completá nombre y apellido.');
      return;
    }
    if (!dni.trim() || dni.trim().length < 6) {
      setError('El DNI debe tener al menos 6 dígitos (es la contraseña del cliente).');
      return;
    }
    setSubmitting(true);
    try {
      await createClientAccount({ firstName: firstName.trim(), lastName: lastName.trim(), phone, dni: dni.trim(), coachName });
      setCreated({ username: `${firstName.trim()} ${lastName.trim()}`, dni: dni.trim() });
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        setError('Ya existe un cliente con ese nombre y apellido. Usá otro, o agregá una inicial (ej. "Franco P.").');
      } else if (e.code === 'auth/weak-password') {
        setError('El DNI es muy corto para usarlo como contraseña (mínimo 6 dígitos).');
      } else {
        setError('No se pudo crear el cliente. Probá de nuevo.');
      }
    }
    setSubmitting(false);
  }

  if (created) {
    return (
      <View style={[styles.screen, { padding: 20, justifyContent: 'center' }]}>
        <View style={styles.successBox}>
          <Text style={styles.successTitle}>✓ Cliente creado</Text>
          <Text style={styles.previewLabel}>Datos de acceso</Text>
          <Text style={styles.previewText}>Usuario: {created.username}</Text>
          <Text style={styles.previewText}>Contraseña: {created.dni}</Text>
        </View>
        <PrimaryButton title="Volver a clientes" onPress={() => navigation.goBack()} style={{ marginTop: 20 }} />
        <SecondaryButton
          title="Cargar otro cliente"
          onPress={() => {
            setFirstName(''); setLastName(''); setPhone(''); setDni(''); setCoachName(''); setCreated(null);
          }}
          style={{ marginTop: 10 }}
        />
      </View>
    );
  }

  const previewUser = firstName.trim() && lastName.trim() ? `${firstName.trim()} ${lastName.trim()}` : '';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Text style={styles.header}>Nuevo cliente</Text>
      <Text style={styles.sub}>
        El cliente va a iniciar sesión con su nombre y apellido como usuario, y su DNI como contraseña.
      </Text>

      <FormField label="Nombre" value={firstName} onChangeText={setFirstName} placeholder="Franco" autoCapitalize="words" />
      <FormField label="Apellido" value={lastName} onChangeText={setLastName} placeholder="Pereyra" autoCapitalize="words" />
      <FormField label="Teléfono" value={phone} onChangeText={setPhone} placeholder="011 5555-0102" keyboardType="phone-pad" />
      <FormField label="DNI (será su contraseña)" value={dni} onChangeText={setDni} placeholder="38221904" keyboardType="number-pad" />
      <FormField label="Profe" value={coachName} onChangeText={setCoachName} placeholder="Agus" autoCapitalize="words" />

      {!!previewUser && (
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>Vista previa del login</Text>
          <Text style={styles.previewText}>Usuario: {previewUser}</Text>
          <Text style={styles.previewText}>Contraseña: {dni || '—'}</Text>
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <PrimaryButton
        title={submitting ? 'Creando...' : 'Crear cliente'}
        onPress={handleSubmit}
        disabled={submitting}
        style={{ marginTop: 8 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  header: { color: colors.white, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  sub: { color: colors.gray1, fontSize: 12.5, marginBottom: 22, lineHeight: 18 },
  previewBox: {
    backgroundColor: colors.black2, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, marginBottom: 18,
  },
  successBox: {
    backgroundColor: colors.black2, borderWidth: 1, borderColor: 'rgba(46,204,113,0.35)',
    borderRadius: 16, padding: 20,
  },
  successTitle: { color: colors.green, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  previewLabel: { color: colors.gray1, fontSize: 10.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  previewText: { color: colors.white, fontSize: 13, fontWeight: '600', marginTop: 2 },
  error: { color: '#ff6b76', fontSize: 12.5, fontWeight: '600', marginBottom: 14 },
});
