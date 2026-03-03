import * as SecureStore from 'expo-secure-store';
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createApiModules } from '@/api';
import { AuthSession } from '@/types/models';

const TOKEN_KEY = 'opencto.auth.token';

interface AuthContextValue {
  isHydrated: boolean;
  token: string | null;
  session: AuthSession | null;
  error: string | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  deleteOwnAccount: () => Promise<void>;
  api: ReturnType<typeof createApiModules>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [isHydrated, setHydrated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = useMemo(() => createApiModules(async () => token), [token]);

  const refreshSession = useCallback(async () => {
    if (!token) {
      setSession(null);
      return;
    }
    try {
      const nextSession = await api.auth.getAuthSession(api.client);
      setSession(nextSession);
      setError(null);
    } catch {
      setSession(null);
      setError('Unable to validate session. Sign in again.');
    }
  }, [api, token]);

  const signIn = async (nextToken: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
    setToken(nextToken);
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setSession(null);
  };

  const deleteOwnAccount = async () => {
    await api.auth.deleteAccount(api.client);
    await signOut();
  };

  useEffect(() => {
    const hydrate = async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      setToken(stored);
      setHydrated(true);
    };

    hydrate();
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    refreshSession();
  }, [isHydrated, refreshSession]);

  return (
    <AuthContext.Provider
      value={{
        isHydrated,
        token,
        session,
        error,
        signIn,
        signOut,
        refreshSession,
        deleteOwnAccount,
        api
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used inside AuthProvider');
  }
  return context;
};
