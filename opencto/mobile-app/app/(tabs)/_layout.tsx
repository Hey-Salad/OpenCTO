import { Redirect, Tabs } from 'expo-router';
import { useAuthGate } from '@/hooks/useAuthGate';

export default function TabsLayout() {
  const { shouldWait, isAuthenticated } = useAuthGate();

  if (shouldWait) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: 'left',
        tabBarActiveTintColor: '#0B5FFF'
      }}
    >
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="runs" options={{ title: 'Runs' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
