import { StyleSheet, TextInput, TextInputProps } from 'react-native';

export const TextInputField = (props: TextInputProps) => (
  <TextInput
    {...props}
    autoCapitalize="none"
    style={[styles.input, props.style]}
    placeholderTextColor="#94A3B8"
  />
);

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF'
  }
});
