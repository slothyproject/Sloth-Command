import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Hash, Save, Shield, Ticket } from "lucide-react";
import { toast } from "sonner";

import { getJson, patchJson } from "@/lib/api";
import type { GuildSettings } from "@/types";

type TicketForm = Pick<GuildSettings, "ticket_channel" | "ticket_role">;

export function TicketConfigPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["guild-settings", guildId],
    queryFn: () => getJson<GuildSettings>(`/api/guilds/${guildId}/settings`),
    enabled: !!guildId,
    staleTime: 30_000,
  });

  const [form, setForm] = useState<TicketForm>({
    ticket_channel: null,
    ticket_role: null,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        ticket_channel: settings.ticket_channel,
        ticket_role: settings.ticket_role,
      });
    }
  }, [settings]);

  const dirty =
    settings !== undefined &&
    (form.ticket_channel !== settings.ticket_channel ||
      form.ticket_role !== settings.ticket_role);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (patch: Partial<GuildSettings>) =>
      patchJson(`/api/guilds/${guildId}/settings`, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["guild-settings", guildId] });
      toast.success("Ticket settings saved");
    },
    onError: (err: Error) => toast.error(`Save failed: ${err.message}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-cyan/40 border-t-cyan rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + Save */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-text-0">Ticket Configuration</h2>
          <p className="text-sm text-text-3 mt-0.5">
            Set up where tickets are created and which staff role manages them.
          </p>
        </div>
        <button
          onClick={() => save(form)}
          disabled={!dirty || isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan text-void text-sm font-semibold disabled:opacity-40 hover:bg-cyan/90 transition-colors flex-shrink-0"
        >
          <Save className="w-4 h-4" />
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="dashboard-chrome rounded-[1.6rem] divide-y divide-white/5">
        {/* Ticket channel */}
        <div className="p-5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Ticket className="w-5 h-5 text-cyan/60 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-0">Ticket Channel</p>
              <p className="text-xs text-text-3 mt-0.5">
                Category or channel where new ticket threads are created.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-text-3 flex-shrink-0" />
            <input
              type="text"
              value={form.ticket_channel ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, ticket_channel: e.target.value || null }))
              }
              className="w-48 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-0 font-mono focus:border-cyan/50 focus:outline-none"
              placeholder="Channel / Category ID"
            />
          </div>
        </div>

        {/* Staff role */}
        <div className="p-5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-cyan/60 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-0">Support Staff Role</p>
              <p className="text-xs text-text-3 mt-0.5">
                Role that has access to all ticket threads and can close them.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-3 text-sm">@</span>
            <input
              type="text"
              value={form.ticket_role ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, ticket_role: e.target.value || null }))
              }
              className="w-48 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-0 font-mono focus:border-cyan/50 focus:outline-none"
              placeholder="Role ID"
            />
          </div>
        </div>
      </div>

      {/* Info callout */}
      <div className="rounded-xl border border-cyan/15 bg-cyan/5 p-4 flex items-start gap-3">
        <Ticket className="w-4 h-4 text-cyan/70 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-text-2 leading-relaxed">
          To view and manage open tickets, use the{" "}
          <strong className="text-text-0">Tickets</strong> section in the main navigation.
          This page controls where new tickets are routed.
        </p>
      </div>
    </div>
  );
}
