import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { VoiceControlBar } from '@/components/chat/VoiceControlBar';
import { EmptyState, ErrorState } from '@/components/ui';
import { useChat } from '@/hooks/useChat';
import { useRealtime } from '@/hooks/useRealtime';

export default function ChatScreen() {
  const { messages, sendTextMessage, error } = useChat();
  const realtime = useRealtime();

  const handleVoiceToggle = () => {
    if (['connecting', 'live', 'reconnecting'].includes(realtime.state)) {
      realtime.stop();
      return;
    }
    realtime.start();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Conversation</Text>
        <VoiceControlBar
          state={realtime.state}
          muted={realtime.muted}
          startedAt={realtime.startedAt}
          onToggleStartStop={handleVoiceToggle}
          onToggleMute={realtime.toggleMute}
        />
        {realtime.errorMessage ? <ErrorState message={realtime.errorMessage} /> : null}
        {error ? <ErrorState message={error} /> : null}
        <View style={styles.messagesWrap}>
          {messages.length > 0 ? (
            <ChatMessageList messages={messages} />
          ) : (
            <EmptyState title="No messages yet" description="Start with voice or text to begin." />
          )}
        </View>
        <ChatComposer onSend={sendTextMessage} />
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
    padding: 14,
    gap: 10
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A'
  },
  messagesWrap: {
    flex: 1
  }
});
