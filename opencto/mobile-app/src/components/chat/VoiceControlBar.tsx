import { StyleSheet, Text, View } from 'react-native';
import { RealtimeConnectionState } from '@/types/models';
import { Button } from '@/components/ui';
import { colors } from '@/theme/colors';

interface VoiceControlBarProps {
  state: RealtimeConnectionState;
  muted: boolean;
  startedAt?: number;
  onToggleStartStop: () => void;
  onToggleMute: () => void;
}

const activeStates: RealtimeConnectionState[] = ['connecting', 'live', 'reconnecting'];

export const VoiceControlBar = ({
  state,
  muted,
  startedAt,
  onToggleStartStop,
  onToggleMute
}: VoiceControlBarProps) => {
  const isLive = activeStates.includes(state);
  const seconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>Voice: {state}</Text>
        <Text style={styles.timer}>{isLive ? `${seconds}s` : '--'}</Text>
      </View>
      <View style={styles.controls}>
        <Button label={isLive ? 'Stop' : 'Start'} onPress={onToggleStartStop} />
        <Button label={muted ? 'Unmute' : 'Mute'} onPress={onToggleMute} variant="secondary" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize'
  },
  timer: {
    color: colors.textBody,
    fontWeight: '600'
  },
  controls: {
    flexDirection: 'row',
    gap: 8
  }
});
