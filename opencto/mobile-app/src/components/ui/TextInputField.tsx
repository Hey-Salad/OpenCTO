import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { colors } from '@/theme/colors';

export const TextInputField = (props: TextInputProps) => (
  <TextInput
    {...props}
    autoCapitalize="none"
    style={[styles.input, props.style]}
    placeholderTextColor={colors.textMuted}
  />
);

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textBody,
    backgroundColor: colors.bgSurface2
  }
});
