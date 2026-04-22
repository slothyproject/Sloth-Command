import { create } from "zustand";

type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface CurrentUser {
  id: number;
  username: string;
  is_admin: boolean;
  discord_id?: string | null;
}

interface AuthState {
  status: AuthStatus;
  user: CurrentUser | null;
  setLoading: () => void;
  setAuthenticated: (user: CurrentUser) => void;
  setAnonymous: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  user: null,
  setLoading: () => set({ status: "loading" }),
  setAuthenticated: (user) => set({ status: "authenticated", user }),
  setAnonymous: () => set({ status: "anonymous", user: null }),
}));