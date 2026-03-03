import { memo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ChatMessage } from '@/types/models';

interface ChatMessageListProps {
  messages: ChatMessage[];
}

const roleColor: Record<ChatMessage['role'], string> = {
  USER: '#0B5FFF',
  ASSISTANT: '#065F46',
  TOOL: '#7C2D12'
};

const MessageItem = memo(function MessageItem({ item }: { item: ChatMessage }) {
  return (
    <View style={styles.item}>
      <Text style={[styles.role, { color: roleColor[item.role] }]}>{item.role}</Text>
      <Text style={styles.content}>{item.content}</Text>
    </View>
  );
});

export const ChatMessageList = ({ messages }: ChatMessageListProps) => (
  <FlatList
    data={messages}
    keyExtractor={(item) => item.id}
    renderItem={({ item }) => <MessageItem item={item} />}
    contentContainerStyle={styles.container}
  />
);

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingBottom: 12
  },
  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 6
  },
  role: {
    fontSize: 11,
    fontWeight: '700'
  },
  content: {
    color: '#1F2937',
    fontSize: 14,
    lineHeight: 20
  }
});
