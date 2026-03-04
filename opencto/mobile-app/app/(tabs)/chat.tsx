import { SafeAreaView, StyleSheet, View } from 'react-native';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { LaunchpadRunStrip } from '@/components/chat/LaunchpadRunStrip';
import { Button, ErrorState } from '@/components/ui';
import { useLaunchpad } from '@/hooks/useLaunchpad';
import { useScreenSpacing } from '@/hooks/useScreenSpacing';
import { colors } from '@/theme/colors';

export default function ChatScreen() {
  const {
    messages,
    error,
    realtime,
    keyboardOpen,
    activeRun,
    onSendPrompt,
    onStartLaunchpad,
    onStopLaunchpad,
    onToggleKeyboard,
    onCancelRun,
    canCancelRun,
    isSessionLive
  } = useLaunchpad();
  const spacing = useScreenSpacing();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, { padding: Math.max(8, spacing.padding - 2), gap: Math.max(6, spacing.gap - 2) }]}>
        <LaunchpadRunStrip run={activeRun} canCancel={canCancelRun} onCancel={onCancelRun} />
        {realtime.errorMessage ? <ErrorState message={realtime.errorMessage} /> : null}
        {error ? <ErrorState message={error} /> : null}
        <View style={styles.messagesWrap}>
          <ChatMessageList messages={messages} />
        </View>

        {isSessionLive ? (
          <View style={styles.controlsRow}>
            <Button
              label={keyboardOpen ? 'Hide Keyboard' : 'Keyboard'}
              variant="secondary"
              style={styles.grow}
              onPress={onToggleKeyboard}
            />
            <Button label="Stop" variant="secondary" style={styles.grow} onPress={onStopLaunchpad} />
          </View>
        ) : (
          <Button label="Start" style={styles.startButton} onPress={onStartLaunchpad} />
        )}

        {keyboardOpen ? <ChatComposer onSend={onSendPrompt} /> : null}
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
  },
  messagesWrap: {
    flex: 1
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  grow: {
    flex: 1
  },
  startButton: {
    width: '100%'
  }
});
