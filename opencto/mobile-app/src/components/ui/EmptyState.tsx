import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

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
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 6,
    backgroundColor: colors.bgSurface
  },
  title: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.textBody
  },
  description: {
    color: colors.textMuted
  }
});
