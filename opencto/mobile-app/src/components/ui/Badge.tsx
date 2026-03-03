import { StyleSheet, Text, View } from 'react-native';

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
    backgroundColor: '#E5EDFF'
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8'
  }
});
