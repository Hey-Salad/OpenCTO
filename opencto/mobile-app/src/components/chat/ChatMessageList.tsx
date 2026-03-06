import { memo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ChatMessage } from '@/types/models';
import { colors } from '@/theme/colors';

interface ChatMessageListProps {
  messages: ChatMessage[];
}

const roleColor: Record<ChatMessage['role'], string> = {
  USER: colors.brandPrimary,
  ASSISTANT: colors.success,
  TOOL: colors.warning
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
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6
  },
  role: {
    fontSize: 11,
    fontWeight: '700'
  },
  content: {
    color: colors.textBody,
    fontSize: 14,
    lineHeight: 20
  }
});
