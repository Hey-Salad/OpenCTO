import { StyleSheet, Text, View } from 'react-native';
import { RealtimeConnectionState } from '@/types/models';
import { Badge, Button } from '@/components/ui';

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
        <Badge label={`Voice: ${state}`} />
        <Text style={styles.timer}>{isLive ? `${seconds}s` : '--'}</Text>
      </View>
      <View style={styles.controls}>
        <Button label={isLive ? 'Stop Voice' : 'Start Voice'} onPress={onToggleStartStop} />
        <Button label={muted ? 'Unmute' : 'Mute'} onPress={onToggleMute} variant="secondary" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF'
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  timer: {
    color: '#334155',
    fontWeight: '600'
  },
  controls: {
    flexDirection: 'row',
    gap: 8
  }
});
