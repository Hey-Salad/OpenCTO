import * as Linking from 'expo-linking';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { InfoRow } from '@/components/account/InfoRow';
import { Button, Card, ErrorState } from '@/components/ui';
import { PRIVACY_URL, TERMS_URL } from '@/config/env';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme/colors';

export default function AccountScreen() {
  const { session, signOut, deleteOwnAccount, error } = useAuth();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Account</Text>

        <Card>
          <InfoRow label="User" value={session?.name ?? session?.email ?? 'Unknown'} />
          <InfoRow label="Workspace" value={session?.workspaceName ?? session?.workspaceId ?? 'Unknown'} />
          <InfoRow label="User ID" value={session?.userId ?? 'Unknown'} />
        </Card>

        <Card>
          <Button label="Open Terms" variant="secondary" onPress={() => Linking.openURL(TERMS_URL)} />
          <Button label="Open Privacy" variant="secondary" onPress={() => Linking.openURL(PRIVACY_URL)} />
        </Card>

        <Card>
          <Button label="Sign Out" variant="secondary" onPress={signOut} />
          <Button label="Delete Account" variant="danger" onPress={deleteOwnAccount} />
        </Card>

        {error ? <ErrorState message={error} /> : null}
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
    gap: 10,
    padding: 14
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textBody
  }
});
