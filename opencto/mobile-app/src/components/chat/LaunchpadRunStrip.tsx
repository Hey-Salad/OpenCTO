import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { CodebaseRun } from '@/types/models';
import { colors } from '@/theme/colors';

interface LaunchpadRunStripProps {
  run: CodebaseRun | null;
  canCancel: boolean;
  onCancel: () => void;
}

export const LaunchpadRunStrip = ({ run, canCancel, onCancel }: LaunchpadRunStripProps) => {
  if (!run) {
    return null;
  }

  return (
    <View style={styles.strip}>
      <View style={styles.row}>
        <Text style={styles.label}>Run {run.id.slice(0, 8)}…</Text>
        <Text style={styles.status}>{run.status}</Text>
      </View>
      <Text style={styles.meta}>{run.title}</Text>
      {canCancel ? <Button label="Cancel" variant="secondary" onPress={onCancel} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  strip: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  label: {
    color: colors.textBody,
    fontWeight: '700'
  },
  status: {
    color: colors.brandSecondary,
    textTransform: 'capitalize',
    fontWeight: '600'
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12
  }
});
