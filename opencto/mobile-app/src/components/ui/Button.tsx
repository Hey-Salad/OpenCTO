import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}

const colors = {
  primary: '#0B5FFF',
  secondary: '#E9EEF7',
  danger: '#C62828'
};

export const Button = ({ label, onPress, variant = 'primary', disabled, style }: ButtonProps) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.base,
      { backgroundColor: colors[variant], opacity: pressed || disabled ? 0.7 : 1 },
      style
    ]}
  >
    <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center'
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  secondaryLabel: {
    color: '#0F172A'
  }
});
