import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ListItemProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}

export const ListItem = ({ title, subtitle, right, onPress }: ListItemProps) => (
  <Pressable onPress={onPress} disabled={!onPress} style={styles.item}>
    <View style={styles.copy}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
    {right}
  </Pressable>
);

const styles = StyleSheet.create({
  item: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    gap: 10
  },
  copy: {
    flexShrink: 1,
    gap: 4
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827'
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B'
  }
});
