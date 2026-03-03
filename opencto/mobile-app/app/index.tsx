import { Redirect } from 'expo-router';
import { BrandLoader } from '@/components/ui';
import { useAuthGate } from '@/hooks/useAuthGate';

export default function Index() {
  const { shouldWait, isAuthenticated } = useAuthGate();

  if (shouldWait) {
    return <BrandLoader />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)/chat" />;
}
