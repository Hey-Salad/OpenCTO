import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Image } from 'react-native';
import { BrandLoader } from '@/components/ui';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors } from '@/theme/colors';

function ChatTabIcon({ color, size }: { color: string; size: number }) {
  return <Ionicons name="rocket-outline" color={color} size={size} />;
}

function RunsTabIcon({ color, size }: { color: string; size: number }) {
  return <Ionicons name="terminal-outline" color={color} size={size} />;
}

function AccountTabIcon({ color, size }: { color: string; size: number }) {
  return <Ionicons name="person-circle-outline" color={color} size={size} />;
}

export default function TabsLayout() {
  const { shouldWait, isAuthenticated } = useAuthGate();

  if (shouldWait) {
    return <BrandLoader />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: 'center',
        sceneStyle: { backgroundColor: colors.bgApp },
        headerStyle: {
          backgroundColor: colors.bgApp,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0
        },
        headerShadowVisible: false,
        headerTintColor: colors.textBody,
        headerLeft: () => (
          <Image
            source={require('../../assets/images/brand-corner-icon.png')}
            style={{ width: 26, height: 26, marginLeft: 14 }}
            resizeMode="contain"
          />
        ),
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgApp,
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          elevation: 0
        }
      }}
    >
      <Tabs.Screen name="chat" options={{ title: 'Launchpad', tabBarLabel: 'Launchpad', tabBarIcon: ChatTabIcon }} />
      <Tabs.Screen name="runs" options={{ title: 'Runs', tabBarLabel: 'Runs', tabBarIcon: RunsTabIcon }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarLabel: 'Account', tabBarIcon: AccountTabIcon }} />
    </Tabs>
  );
}
