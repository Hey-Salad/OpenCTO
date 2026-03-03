import { Redirect } from 'expo-router';
import { useAuthGate } from '@/hooks/useAuthGate';

export default function Index() {
  const { shouldWait, isAuthenticated } = useAuthGate();

  if (shouldWait) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)/chat" />;
}
