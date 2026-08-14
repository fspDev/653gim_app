import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import ClientsListScreen from '../screens/admin/ClientsListScreen';
import ClientDetailScreen from '../screens/admin/ClientDetailScreen';

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
    </Stack.Navigator>
  );
}
