import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, TextInputField } from '@/components/ui';

interface ChatComposerProps {
  onSend: (content: string) => Promise<void>;
}

export const ChatComposer = ({ onSend }: ChatComposerProps) => {
  const [text, setText] = useState('');

  const handleSend = async () => {
    const value = text.trim();
    if (!value) {
      return;
    }
    setText('');
    await onSend(value);
  };

  return (
    <View style={styles.row}>
      <View style={styles.inputWrap}>
        <TextInputField placeholder="Ask OpenCTO..." value={text} onChangeText={setText} />
      </View>
      <Button label="Send" onPress={handleSend} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  inputWrap: {
    flex: 1
  }
});
