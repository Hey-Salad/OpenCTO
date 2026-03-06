import { Audio } from 'expo-av';

export const requestMicrophonePermission = async (): Promise<boolean> => {
  const permission = await Audio.requestPermissionsAsync();
  return permission.granted;
};

export const configureAudioSession = async (): Promise<void> => {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false
  });
};
