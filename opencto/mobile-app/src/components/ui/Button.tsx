import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}

const palette = {
  primary: colors.brandPrimary,
  secondary: colors.bgSurface2,
  danger: colors.error
};

export const Button = ({ label, onPress, variant = 'primary', disabled, style }: ButtonProps) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.base,
      { backgroundColor: palette[variant], opacity: pressed || disabled ? 0.7 : 1 },
      variant === 'secondary' ? styles.secondaryBorder : null,
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
  secondaryBorder: {
    borderWidth: 1,
    borderColor: colors.border
  },
  label: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600'
  },
  secondaryLabel: {
    color: colors.textBody
  }
});
