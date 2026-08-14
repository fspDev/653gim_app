import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import HomeScreen from '../screens/client/HomeScreen';
import ProgressScreen from '../screens/client/ProgressScreen';
import SettingsScreen from '../screens/client/SettingsScreen';
import ExerciseExecutionScreen from '../screens/client/ExerciseExecutionScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Icon({ symbol }) {
  return <Text style={{ fontSize: 18 }}>{symbol}</Text>;
}

function ClientTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.black, borderTopColor: '#212121' },
        tabBarActiveTintColor: colors.red,
        tabBarInactiveTintColor: colors.gray1,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="Hoy" component={HomeScreen} options={{ tabBarIcon: () => <Icon symbol="🏠" /> }} />
      <Tab.Screen name="Progreso" component={ProgressScreen} options={{ tabBarIcon: () => <Icon symbol="📈" /> }} />
      <Tab.Screen name="Ajustes" component={SettingsScreen} options={{ tabBarIcon: () => <Icon symbol="⚙️" /> }} />
    </Tab.Navigator>
  );
}

export default function ClientNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClientTabs" component={ClientTabs} />
      <Stack.Screen
        name="ExerciseExecution"
        component={ExerciseExecutionScreen}
        options={{ presentation: 'card', animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
