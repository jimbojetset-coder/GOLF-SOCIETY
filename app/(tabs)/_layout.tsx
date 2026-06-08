import { Tabs } from 'expo-router';
import ClaimPlayerPrompt from '../../src/components/shared/ClaimPlayerPrompt';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/theme';

export default function TabLayout() {
  return (
    <>
      <ClaimPlayerPrompt />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.white,
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
            paddingBottom: 8,        // increased
            paddingTop: 8,           // increased
            height: 72,              // increased height
          },
          tabBarActiveTintColor: COLORS.accent,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 4,            // moved label up a bit
          },
        }}
      >
        <Tabs.Screen
          name="competition"
          options={{
            title: 'Compete',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trophy-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="scoring"
          options={{
            title: 'Score',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="golf-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: 'Live',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="pulse-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
