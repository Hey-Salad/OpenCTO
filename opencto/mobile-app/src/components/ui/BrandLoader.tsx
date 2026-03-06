import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

export const BrandLoader = () => {
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Image source={require('../../../assets/images/splash-wordmark.png')} style={styles.wordmark} resizeMode="contain" />
        <Text style={styles.label}>Loading workspace</Text>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgApp,
    padding: 16
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.bgSurface,
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 14
  },
  wordmark: {
    width: 220,
    height: 54,
    alignSelf: 'center'
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center'
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.bgSurface2
  },
  progressFill: {
    width: '42%',
    height: '100%',
    backgroundColor: colors.brandSecondary
  }
});
