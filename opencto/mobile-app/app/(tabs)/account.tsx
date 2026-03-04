import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { InfoRow } from '@/components/account/InfoRow';
import { Button, Card, ErrorState } from '@/components/ui';
import { PRIVACY_URL, TERMS_URL } from '@/config/env';
import { useAuth } from '@/hooks/useAuth';
import { useScreenSpacing } from '@/hooks/useScreenSpacing';
import { colors } from '@/theme/colors';

export default function AccountScreen() {
  const { session, signOut, deleteOwnAccount, error } = useAuth();
  const spacing = useScreenSpacing();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, { padding: spacing.padding, gap: spacing.gap }]}>
        <Card>
          <InfoRow label="User" value={session?.name ?? session?.email ?? 'Unknown'} />
          <InfoRow label="Workspace" value={session?.workspaceName ?? session?.workspaceId ?? 'Unknown'} />
          <InfoRow label="User ID" value={session?.userId ?? 'Unknown'} />
        </Card>

        <Card>
          <Button
            label="Open Terms"
            variant="secondary"
            leftIcon={<Ionicons name="document-text-outline" size={16} color={colors.textBody} />}
            onPress={() => Linking.openURL(TERMS_URL)}
          />
          <Button
            label="Open Privacy"
            variant="secondary"
            leftIcon={<Ionicons name="shield-checkmark-outline" size={16} color={colors.textBody} />}
            onPress={() => Linking.openURL(PRIVACY_URL)}
          />
        </Card>

        <Card>
          <Button
            label="Sign Out"
            variant="secondary"
            leftIcon={<Ionicons name="log-out-outline" size={16} color={colors.textBody} />}
            onPress={signOut}
          />
          <Button
            label="Delete Account"
            variant="danger"
            leftIcon={<Ionicons name="trash-outline" size={16} color={colors.white} />}
            onPress={deleteOwnAccount}
          />
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
    flex: 1
  }
});
