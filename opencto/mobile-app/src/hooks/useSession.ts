import { useAuthContext } from '@/state/AuthContext';

export const useSession = () => {
  const { session, isHydrated, refreshSession } = useAuthContext();
  return {
    session,
    isHydrated,
    refreshSession
  };
};
