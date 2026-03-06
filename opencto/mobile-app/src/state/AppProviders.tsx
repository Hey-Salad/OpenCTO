import { PropsWithChildren } from 'react';
import { AuthProvider } from './AuthContext';
import { ChatProvider } from './ChatContext';
import { RunsProvider } from './RunsContext';

export const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <AuthProvider>
      <ChatProvider>
        <RunsProvider>{children}</RunsProvider>
      </ChatProvider>
    </AuthProvider>
  );
};
