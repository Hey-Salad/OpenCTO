import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

interface InfoRowProps {
  label: string;
  value: string;
}

export const InfoRow = ({ label, value }: InfoRowProps) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  label: {
    color: colors.textMuted
  },
  value: {
    color: colors.textBody,
    fontWeight: '600',
    maxWidth: '70%',
    textAlign: 'right'
  }
});
