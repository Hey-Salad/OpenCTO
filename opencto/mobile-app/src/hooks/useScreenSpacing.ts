import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export const useScreenSpacing = () => {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    if (width <= 360) {
      return { padding: 10, gap: 8 };
    }
    if (width <= 420) {
      return { padding: 12, gap: 9 };
    }
    return { padding: 14, gap: 10 };
  }, [width]);
};
