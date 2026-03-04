import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

export const BrandLoader = () => {
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.wordmark}>OpenCTO</Text>
        <Text style={styles.byline}>Powered by HeySalad (r)</Text>
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
    backgroundColor: colors.white,
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 12
  },
  wordmark: {
    color: colors.black,
    fontFamily: 'Grandstander_700Bold',
    fontSize: 42,
    textAlign: 'center',
    letterSpacing: 0.4
  },
  byline: {
    color: colors.black,
    fontFamily: 'Grandstander_600SemiBold',
    fontSize: 14,
    textAlign: 'center'
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.bgSurface2,
    marginTop: 2
  },
  progressFill: {
    width: '42%',
    height: '100%',
    backgroundColor: colors.brandSecondary
  }
});
