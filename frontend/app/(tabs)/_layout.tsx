import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    height: Platform.select({
      ios: insets.bottom + 58,
      android: insets.bottom + 58,
      default: 66,
    }),
    paddingTop: 8,
    paddingBottom: Platform.select({
      ios: insets.bottom + 8,
      android: insets.bottom + 8,
      default: 8,
    }),
    paddingHorizontal: 4,
    backgroundColor: Colors.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 0.3,
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'CHAT',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="chat" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="terminal"
        options={{
          title: 'TERM',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="terminal" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ops"
        options={{
          title: 'OPS',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="flash-on" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="intel"
        options={{
          title: 'INTEL',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="grid-view" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="files"
        options={{
          title: 'FILES',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="folder" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="agents"
        options={{
          title: 'AGENTS',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="smart-toy" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="config"
        options={{
          title: 'CONFIG',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="tune" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="build"
        options={{
          title: 'BUILD',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="code" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
