import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import ClientsListScreen from '../screens/admin/ClientsListScreen';
import ClientDetailScreen from '../screens/admin/ClientDetailScreen';
import NewClientScreen from '../screens/admin/NewClientScreen';

const Stack = createNativeStackNavigator();

export default function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClientsList" component={ClientsListScreen} />
      <Stack.Screen
        name="ClientDetail"
        component={ClientDetailScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.black },
          headerTintColor: colors.white,
          headerTitle: 'Cliente',
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="NewClient"
        component={NewClientScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.black },
          headerTintColor: colors.white,
          headerTitle: 'Nuevo cliente',
          headerShadowVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}
