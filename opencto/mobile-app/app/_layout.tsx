import { Grandstander_600SemiBold, Grandstander_700Bold, useFonts } from '@expo-google-fonts/grandstander';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BrandLoader } from '@/components/ui';
import { AppProviders } from '@/state/AppProviders';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Grandstander_600SemiBold,
    Grandstander_700Bold
  });

  if (!fontsLoaded) {
    return <BrandLoader />;
  }

  return (
    <AppProviders>
      <StatusBar style="light" backgroundColor={colors.bgApp} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgApp } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="run/[id]" />
      </Stack>
    </AppProviders>
  );
}
