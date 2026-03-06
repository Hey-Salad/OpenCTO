import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RunStatusBadge } from '@/components/runs/RunStatusBadge';
import { Button, Card, EmptyState, ErrorState } from '@/components/ui';
import { useRuns } from '@/hooks/useRuns';
import { colors } from '@/theme/colors';
import { CodebaseRun } from '@/types/models';

const cancellableStates = new Set(['queued', 'in_progress']);

export default function RunDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const runId = params.id;
  const { eventsByRunId, refreshRun, refreshRunEvents, cancelRunById, error } = useRuns();
  const [run, setRun] = useState<CodebaseRun | null>(null);

  const events = useMemo(() => eventsByRunId[runId] ?? [], [eventsByRunId, runId]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!runId) {
        return;
      }
      const next = await refreshRun(runId);
      if (mounted) {
        setRun(next);
      }
      await refreshRunEvents(runId);
    };

    load();

    const timer = setInterval(() => {
      load();
    }, 4000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [refreshRun, refreshRunEvents, runId]);

  if (!runId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ErrorState message="Run id is missing." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Run Details</Text>
        {run ? (
          <Card>
            <Text style={styles.runTitle}>{run.title}</Text>
            <RunStatusBadge status={run.status} />
            <Text style={styles.meta}>Updated: {new Date(run.updatedAt).toLocaleString()}</Text>
            {cancellableStates.has(run.status) ? (
              <Button label="Cancel Run" variant="danger" onPress={() => cancelRunById(run.id)} />
            ) : null}
          </Card>
        ) : (
          <EmptyState title="Loading run" description="Fetching run metadata." />
        )}

        {error ? <ErrorState message={error} /> : null}

        <ScrollView contentContainerStyle={styles.events}>
          {events.length === 0 ? (
            <EmptyState title="No events yet" description="Live updates will appear here." />
          ) : (
            events.map((event) => (
              <Card key={event.id}>
                <Text style={styles.eventType}>{event.type}</Text>
                <Text style={styles.eventMessage}>{event.message}</Text>
                <Text style={styles.eventTime}>{new Date(event.createdAt).toLocaleString()}</Text>
              </Card>
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
    gap: 10
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textBody
  },
  runTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textBody
  },
  meta: {
    color: colors.textMuted
  },
  events: {
    gap: 8,
    paddingBottom: 12
  },
  eventType: {
    fontWeight: '700',
    color: colors.textBody
  },
  eventMessage: {
    color: colors.textBody
  },
  eventTime: {
    color: colors.textMuted,
    fontSize: 12
  }
});
