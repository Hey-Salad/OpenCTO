import { Redirect } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorState, TextInputField } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useScreenSpacing } from '@/hooks/useScreenSpacing';
import { colors } from '@/theme/colors';

export default function LoginScreen() {
  const { signIn, error } = useAuth();
  const { isAuthenticated } = useAuthGate();
  const spacing = useScreenSpacing();
  const [inputToken, setInputToken] = useState('');

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/chat" />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, { padding: spacing.padding }]}>
        <Card>
          <Text style={styles.title}>OpenCTO Mobile</Text>
          <Text style={styles.subtitle}>Sign in using your OpenCTO API token.</Text>
          <TextInputField
            placeholder="Paste bearer token"
            value={inputToken}
            onChangeText={setInputToken}
            secureTextEntry
          />
          <Button label="Sign In" onPress={() => signIn(inputToken.trim())} disabled={!inputToken.trim()} />
          {error ? <ErrorState message={error} /> : null}
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgApp
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textBody
  },
  subtitle: {
    color: colors.textMuted
  }
});
