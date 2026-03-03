import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

interface BadgeProps {
  label: string;
}

export const Badge = ({ label }: BadgeProps) => (
  <View style={styles.badge}>
    <Text style={styles.text}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(250,160,154,0.35)',
    backgroundColor: 'rgba(237,76,76,0.12)'
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.brandSecondary
  }
});
