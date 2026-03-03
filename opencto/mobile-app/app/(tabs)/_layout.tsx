import { Redirect, Tabs } from 'expo-router';
import { BrandLoader } from '@/components/ui';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors } from '@/theme/colors';

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
        headerTitleAlign: 'left',
        headerStyle: { backgroundColor: colors.bgSurface },
        headerTintColor: colors.textBody,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.bgSurface, borderTopColor: colors.border }
      }}
    >
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="runs" options={{ title: 'Runs' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
