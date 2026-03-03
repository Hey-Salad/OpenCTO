import { StyleSheet, Text, View } from 'react-native';

interface EmptyStateProps {
  title: string;
  description: string;
}

export const EmptyState = ({ title, description }: EmptyStateProps) => (
  <View style={styles.root}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.description}>{description}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    gap: 6,
    backgroundColor: '#FFFFFF'
  },
  title: {
    fontWeight: '700',
    fontSize: 15,
    color: '#0F172A'
  },
  description: {
    color: '#475569'
  }
});
