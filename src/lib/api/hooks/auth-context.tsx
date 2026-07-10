import { createContext, useContext, type ReactNode } from 'react';
import type { AxiosInstance } from 'axios';

import type { TokenStore } from '../token-store.js';
import type { components } from '../generated/api-types.js';

type User = components['schemas']['User'];

interface AuthContextValue {
  client: AxiosInstance;
  tokens: TokenStore;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps extends Omit<
  AuthContextValue,
  'currentUser' | 'setCurrentUser'
> {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  children: ReactNode;
}

export function AuthProvider(props: AuthProviderProps): JSX.Element {
  const { children, ...value } = props;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- Context + hook co-located by React convention; splitting adds no value.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
