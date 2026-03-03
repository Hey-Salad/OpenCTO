import { Redirect } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorState, TextInputField } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useAuthGate } from '@/hooks/useAuthGate';

export default function LoginScreen() {
  const { signIn, error } = useAuth();
  const { isAuthenticated } = useAuthGate();
  const [inputToken, setInputToken] = useState('');

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/chat" />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
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
    backgroundColor: '#F8FAFC'
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A'
  },
  subtitle: {
    color: '#334155'
  }
});
