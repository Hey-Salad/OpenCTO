import { useMemo } from 'react';
import { useAuth } from './useAuth';

export const useAuthGate = () => {
  const { isHydrated, token } = useAuth();

  return useMemo(
    () => ({
      isHydrated,
      isAuthenticated: Boolean(token),
      shouldWait: !isHydrated
    }),
    [isHydrated, token]
  );
};
