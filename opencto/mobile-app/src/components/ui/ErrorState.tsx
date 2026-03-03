import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

interface ErrorStateProps {
  message: string;
}

export const ErrorState = ({ message }: ErrorStateProps) => (
  <View style={styles.root}>
    <Text style={styles.title}>Something went wrong</Text>
    <Text style={styles.message}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: {
    borderWidth: 1,
    borderColor: 'rgba(237,76,76,0.45)',
    backgroundColor: 'rgba(237,76,76,0.12)',
    borderRadius: 12,
    padding: 14,
    gap: 6
  },
  title: {
    color: colors.brandPrimary,
    fontSize: 14,
    fontWeight: '700'
  },
  message: {
    color: colors.brandTertiary
  }
});
