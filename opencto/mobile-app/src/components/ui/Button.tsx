import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
  leftIcon?: ReactNode;
}

const palette = {
  primary: colors.brandPrimary,
  secondary: colors.bgSurface2,
  danger: colors.error
};

export const Button = ({ label, onPress, variant = 'primary', disabled, style, leftIcon }: ButtonProps) => (
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
    <View style={styles.inner}>
      {leftIcon}
      <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center'
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
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
