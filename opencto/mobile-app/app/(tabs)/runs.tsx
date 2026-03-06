import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RunListItem } from '@/components/runs/RunListItem';
import { EmptyState, ErrorState } from '@/components/ui';
import { useRuns } from '@/hooks/useRuns';
import { colors } from '@/theme/colors';

export default function RunsScreen() {
  const router = useRouter();
  const { runs, loading, error, refreshRuns } = useRuns();

  useEffect(() => {
    refreshRuns();
  }, [refreshRuns]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Codebase Runs</Text>
        {error ? <ErrorState message={error} /> : null}
        <ScrollView
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshRuns} tintColor={colors.brandPrimary} />}
          contentContainerStyle={styles.scroll}
        >
          {runs.length === 0 ? (
            <EmptyState title="No runs" description="Start a run from chat or dashboard." />
          ) : (
            runs.map((run) => (
              <RunListItem
                key={run.id}
                run={run}
                onPress={() => router.push({ pathname: '/run/[id]', params: { id: run.id } })}
              />
            ))
          )}
        </ScrollView>
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
    padding: 14,
    gap: 8
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textBody
  },
  scroll: {
    paddingBottom: 16
  }
});
