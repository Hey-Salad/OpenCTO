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

function renderContent(item: ChatMessage) {
  if (item.kind === 'code' || item.kind === 'output') {
    return <Text style={styles.codeBlock}>{item.content}</Text>;
  }
  if (item.kind === 'command') {
    return <Text style={styles.commandText}>$ {item.metadata?.command ?? item.content}</Text>;
  }
  if (item.kind === 'plan') {
    const lines = item.content.split('\n').filter(Boolean);
    return (
      <View style={styles.planWrap}>
        {lines.map((line, index) => (
          <Text key={`${item.id}_${index}`} style={styles.planLine}>{`${index + 1}. ${line}`}</Text>
        ))}
      </View>
    );
  }
  return <Text style={styles.content}>{item.content}</Text>;
}

const MessageItem = memo(function MessageItem({ item }: { item: ChatMessage }) {
  const kindLabel = item.kind ? item.kind.toUpperCase() : null;

  return (
    <View style={styles.item}>
      <View style={styles.row}>
        <Text style={[styles.role, { color: roleColor[item.role] }]}>{item.role}</Text>
        {kindLabel ? <Text style={styles.kind}>{kindLabel}</Text> : null}
      </View>
      {renderContent(item)}
      {item.metadata?.title ? <Text style={styles.meta}>{item.metadata.title}</Text> : null}
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  role: {
    fontSize: 11,
    fontWeight: '700'
  },
  kind: {
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.8
  },
  content: {
    color: colors.textBody,
    fontSize: 14,
    lineHeight: 20
  },
  commandText: {
    color: colors.brandSecondary,
    fontSize: 13,
    fontFamily: 'Courier'
  },
  codeBlock: {
    backgroundColor: '#131318',
    color: colors.textBody,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Courier'
  },
  planWrap: {
    gap: 4
  },
  planLine: {
    color: colors.textBody,
    fontSize: 13
  },
  meta: {
    color: colors.textMuted,
    fontSize: 11
  }
});
