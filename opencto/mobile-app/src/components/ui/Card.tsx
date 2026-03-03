import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

export const Card = ({ children }: PropsWithChildren) => <View style={styles.card}>{children}</View>;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10
  }
});
