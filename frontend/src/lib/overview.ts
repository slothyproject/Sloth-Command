import { useQuery } from "@tanstack/react-query";

import { getJson } from "./api";

export interface ShellOverview {
  stats: {
    guilds: number;
    members: number;
    channels: number;
    commands_today: number;
    uptime: string;
    latency_ms: number;
    version: string;
    online: boolean;
  };
  guilds: Array<{
    id: number;
    name: string;
    member_count: number;
  }>;
}

export function useShellOverviewQuery() {
  return useQuery({
    queryKey: ["shell-overview"],
    queryFn: () => getJson<ShellOverview>("/api/overview"),
    retry: false,
    refetchInterval: 30000,
  });
}