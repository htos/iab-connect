'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    id?: string;
    name?: string;
    email?: string;
    roles: string[];
  } | null;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasAllRoles: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  hasRole: () => false,
  hasAnyRole: () => false,
  hasAllRoles: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<AuthContextType['user']>(null);

  useEffect(() => {
    if (session?.user) {
      const sessionUser = session.user as {
        id?: string;
        name?: string;
        email?: string;
        roles?: string[];
      };
      setUser({
        id: sessionUser.id,
        name: sessionUser.name || undefined,
        email: sessionUser.email || undefined,
        roles: sessionUser.roles || [],
      });
    } else {
      setUser(null);
    }
  }, [session]);

  const hasRole = (role: string): boolean => {
    return user?.roles?.includes(role) ?? false;
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return roles.some((role) => user?.roles?.includes(role) ?? false);
  };

  const hasAllRoles = (roles: string[]): boolean => {
    return roles.every((role) => user?.roles?.includes(role) ?? false);
  };

  const value: AuthContextType = {
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    user,
    hasRole,
    hasAnyRole,
    hasAllRoles,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
