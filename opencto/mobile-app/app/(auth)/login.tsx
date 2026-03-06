import { Redirect } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Button, Card, ErrorState, TextInputField } from '@/components/ui';
import { buildGitHubOAuthStartUrl, extractAuthTokenFromOAuthCallback, MOBILE_OAUTH_CALLBACK_URL } from '@/auth/oauth';
import { API_BASE_URL } from '@/config/env';
import { useAuth } from '@/hooks/useAuth';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors } from '@/theme/colors';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { signIn, error } = useAuth();
  const { isAuthenticated } = useAuthGate();
  const [inputToken, setInputToken] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/chat" />;
  }

  const handleGitHubSignIn = async () => {
    setOauthLoading(true);
    setOauthError(null);
    try {
      const authUrl = buildGitHubOAuthStartUrl(API_BASE_URL);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, MOBILE_OAUTH_CALLBACK_URL);

      if (result.type !== 'success' || !result.url) {
        setOauthError('GitHub sign-in was canceled.');
        return;
      }

      const token = extractAuthTokenFromOAuthCallback(result.url);
      if (!token) {
        setOauthError('GitHub sign-in did not return a session token.');
        return;
      }

      await signIn(token);
    } catch {
      setOauthError('Unable to sign in with GitHub right now.');
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Card>
          <Text style={styles.title}>OpenCTO Mobile</Text>
          <Text style={styles.subtitle}>Sign in with GitHub or use your OpenCTO API token.</Text>
          <Button
            label={oauthLoading ? 'Connecting to GitHub...' : 'Continue with GitHub'}
            onPress={handleGitHubSignIn}
            disabled={oauthLoading}
          />
          <Text style={styles.divider}>or use token</Text>
          <TextInputField
            placeholder="Paste bearer token"
            value={inputToken}
            onChangeText={setInputToken}
            secureTextEntry
          />
          <Button label="Sign In" onPress={() => signIn(inputToken.trim())} disabled={!inputToken.trim()} />
          {oauthError ? <ErrorState message={oauthError} /> : null}
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
  },
  divider: {
    color: colors.textMuted,
    textAlign: 'center'
  }
});
