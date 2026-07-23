"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, apiGet, setTokens, clearTokens, getStoredRefreshToken } from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  mfa_enabled: boolean;
  is_active: boolean;
  avatar_url: string | null;
  last_login_at: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) {
        setIsLoading(false);
        return;
      }
      setTokens("", refreshToken);
      // Try to refresh to get access token
      const tokenRes = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!tokenRes.ok) {
        clearTokens();
        setIsLoading(false);
        return;
      }
      const tokens = await tokenRes.json();
      setTokens(tokens.access_token, tokens.refresh_token);

      const userData = await apiGet("/auth/me");
      setUser(userData);
    } catch {
      clearTokens();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "登录失败");
    }
    const tokens = await res.json();
    setTokens(tokens.access_token, tokens.refresh_token);

    const userData = await apiGet("/auth/me");
    setUser(userData);
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
