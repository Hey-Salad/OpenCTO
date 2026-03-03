import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/colors';

export const Card = ({ children }: PropsWithChildren) => <View style={styles.card}>{children}</View>;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10
  }
});
