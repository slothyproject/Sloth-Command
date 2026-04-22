import { create } from "zustand";

type AuthStatus = "loading" | "authenticated" | "anonymous";

export type GuildRole = "owner" | "manager" | "admin_override";

export interface UserGuild {
  id: number;
  discord_id: string;
  name: string;
  icon_url: string | null;
  member_count: number;
  is_active: boolean;
  role: GuildRole;
}

export interface CurrentUser {
  id: number;
  username: string;
  avatar: string | null;
  is_owner?: boolean;
  is_admin: boolean;
  discord_id?: string | null;
  guilds: UserGuild[];
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