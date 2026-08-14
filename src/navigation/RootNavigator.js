import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import ClientNavigator from './ClientNavigator';
import AdminNavigator from './AdminNavigator';
import { SecondaryButton } from '../components/UI';

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.black, card: colors.black, border: '#212121' },
};

export default function RootNavigator() {
  const { user, profile, loading, logout } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.red} size="large" />
      </View>
    );
  }

  if (user && !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.white, fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
          Falta el perfil de este usuario
        </Text>
        <Text style={{ color: colors.gray1, fontSize: 12.5, textAlign: 'center', marginBottom: 20 }}>
          Este login existe en Firebase Auth pero no tiene un documento en la colección "users" de Firestore
          (con su rol: client o admin).
        </Text>
        <SecondaryButton title="Cerrar sesión" onPress={logout} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {!user ? <LoginScreen /> : profile.role === 'admin' ? <AdminNavigator /> : <ClientNavigator />}
    </NavigationContainer>
  );
}
