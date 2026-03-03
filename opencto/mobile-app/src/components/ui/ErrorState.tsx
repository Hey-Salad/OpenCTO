import { StyleSheet, Text, View } from 'react-native';

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
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    gap: 6
  },
  title: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '700'
  },
  message: {
    color: '#7F1D1D'
  }
});
