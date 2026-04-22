import { useQuery } from "@tanstack/react-query";

import { formatDate } from "../lib/format";
import { getJson, patchJson } from "../lib/api";

interface UserRecord {
  id: number;
  username: string;
  discord_id?: string | null;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  last_login?: string | null;
}

export function UsersPage() {
  const usersQuery = useQuery({
    queryKey: ["users-admin"],
    queryFn: () => getJson<UserRecord[]>("/api/users"),
    retry: false,
  });

  async function toggleAdmin(user: UserRecord) {
    await patchJson(`/api/users/${user.id}`, { is_admin: !user.is_admin });
    await usersQuery.refetch();
  }

  async function toggleActive(user: UserRecord) {
    await patchJson(`/api/users/${user.id}`, { is_active: !user.is_active });
    await usersQuery.refetch();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-cyan/20 bg-surface/80 p-6 shadow-panel">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan">Users</p>
        <h2 className="mt-3 text-3xl font-semibold text-text-0">Access Control</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-2">Admin-only user management for role and activation state.</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
        {usersQuery.isError ? (
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-text-2">User management requires admin access.</p>
        ) : (
          <div className="space-y-2">
            {(usersQuery.data ?? []).map((user) => (
              <article key={user.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-0">{user.username}</p>
                    <p className="mt-1 text-xs text-text-2">Created {formatDate(user.created_at)} · Last login {formatDate(user.last_login ?? null)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => void toggleAdmin(user)} className={`rounded-xl border px-3 py-2 text-xs uppercase tracking-[0.12em] ${user.is_admin ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-white/10 bg-white/5 text-text-1"}`}>
                      {user.is_admin ? "admin" : "user"}
                    </button>
                    <button onClick={() => void toggleActive(user)} className={`rounded-xl border px-3 py-2 text-xs uppercase tracking-[0.12em] ${user.is_active ? "border-lime/30 bg-lime/10 text-lime" : "border-rose-300/30 bg-rose-300/10 text-rose-200"}`}>
                      {user.is_active ? "active" : "disabled"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
