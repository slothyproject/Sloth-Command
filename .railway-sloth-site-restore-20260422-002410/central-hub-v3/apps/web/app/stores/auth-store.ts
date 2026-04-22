/**
 * Auth Store - Zustand
 * Manages authentication state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Tokens } from '@/app/types';

interface AuthState {
  user: User | null;
  tokens: Tokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setTokens: (tokens: Tokens) => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://central-hub-api-production.up.railway.app/api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          
          const data = await response.json();
          
          if (!response.ok || !data.success) {
            throw new Error(data.error || 'Login failed');
          }
          
          set({
            user: data.user,
            tokens: { access: data.accessToken, refresh: data.refreshToken },
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
            isAuthenticated: false,
          });
          throw error;
        }
      },
      
      logout: () => {
        // Optionally call logout API
        fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${get().tokens?.access}`,
          },
        }).catch(console.error);
        
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          error: null,
        });
      },
      
      setUser: (user) => set({ user }),
      
      setTokens: (tokens) => set({ tokens, isAuthenticated: true }),
      
      refreshToken: async () => {
        const currentTokens = get().tokens;
        if (!currentTokens?.refresh) return;
        
        try {
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: currentTokens.refresh }),
          });
          
          const data = await response.json();
          
          if (data.success) {
            set({
              tokens: {
                access: data.accessToken,
                refresh: currentTokens.refresh,
              },
            });
          } else {
            // Token refresh failed, logout
            get().logout();
          }
        } catch {
          get().logout();
        }
      },
      
      clearError: () => set({ error: null }),
    }),
    {
      name: 'central-hub-auth',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
