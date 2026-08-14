import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { PrimaryButton, FormField } from '../../components/UI';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const [mode, setMode] = useState('client'); // 'client' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { loginClient, loginAdmin, authError } = useAuth();

  async function handleSubmit() {
    setSubmitting(true);
    if (mode === 'client') {
      await loginClient(email, password);
    } else {
      await loginAdmin(username, adminPassword);
    }
    setSubmitting(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.black }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Image source={require('../../../assets/logo653.png')} style={styles.logo} />
        <Text style={styles.title}>{mode === 'client' ? 'Bienvenido' : 'Panel Admin'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'client' ? 'Ingresá con tu mail para ver tu plan' : 'Acceso exclusivo para profes y staff'}
        </Text>

        {mode === 'client' ? (
          <>
            <FormField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="franco@mail.com"
            />
            <FormField
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />
          </>
        ) : (
          <>
            <FormField
              label="Usuario"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder="Admin"
            />
            <FormField
              label="Contraseña"
              value={adminPassword}
              onChangeText={setAdminPassword}
              secureTextEntry
              placeholder="••••••••"
            />
          </>
        )}

        {!!authError && <Text style={styles.error}>{authError}</Text>}

        <PrimaryButton
          title={submitting ? 'Ingresando...' : 'Ingresar'}
          onPress={handleSubmit}
          disabled={submitting}
          style={{ marginTop: 4 }}
        />

        <Text
          style={styles.switchLink}
          onPress={() => setMode(mode === 'client' ? 'admin' : 'client')}
        >
          {mode === 'client' ? 'Soy profe / admin' : 'Volver al login de cliente'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 60 },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignSelf: 'center',
    marginBottom: 22,
    resizeMode: 'contain',
  },
  title: { color: colors.white, fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { color: colors.gray1, fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 30 },
  error: { color: '#ff6b76', fontSize: 12, fontWeight: '600', marginTop: -8, marginBottom: 14 },
  switchLink: { color: colors.gray1, fontSize: 12.5, fontWeight: '600', textAlign: 'center', marginTop: 22 },
});
