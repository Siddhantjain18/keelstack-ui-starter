import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { tokenStore, type KSUser } from "./api-client";

interface AuthState {
  user: KSUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (u: KSUser | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState]           = useState<KSUser | null>(null);
  const [hasSession, setHasSession]    = useState(false);
  const [isLoading, setIsLoading]      = useState(true);

  const syncFromStorage = useCallback(() => {
    const storedUser    = tokenStore.getUser();
    const storedSession = tokenStore.getSession();
    setUserState(storedUser);
    setHasSession(!!storedSession);
  }, []);

  useEffect(() => {
    // Restore from storage on mount
    syncFromStorage();
    setIsLoading(false);
  }, [syncFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onAuthChanged = () => syncFromStorage();
    const onStorage = () => syncFromStorage();

    window.addEventListener("ks-auth-changed", onAuthChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("ks-auth-changed", onAuthChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [syncFromStorage]);

  const setUser = useCallback((u: KSUser | null) => {
    setUserState(u);
    setHasSession(!!tokenStore.getSession());
    if (u) tokenStore.setUser(u);
    else   tokenStore.clear();
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUserState(null);
    setHasSession(false);
    window.location.href = "/auth/login";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: hasSession,
        isLoading,
        setUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
