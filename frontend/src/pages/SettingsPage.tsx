import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { getJson, postJson } from "../lib/api";

interface VersionResponse {
  dashboard: string;
  bot: string;
  bot_online: boolean;
}

interface BotStatsResponse {
  guilds: number;
  members: number;
  commands_today: number;
  uptime: string;
  version: string;
  online: boolean;
}

interface InviteResponse {
  url: string;
  client_id: string;
}

type AIProvider = "ollama" | "openai" | "anthropic" | "gemini" | "custom_openai";

interface AIProviderStatusResponse {
  configured: boolean;
  provider?: AIProvider | null;
  model?: string | null;
  base_url?: string | null;
  key_hint?: string | null;
  status?: string | null;
  usage_limit_requests_per_hour?: number | null;
  validation_error?: string | null;
  supported_providers?: Record<
    string,
    {
      label: string;
      default_model: string;
      requires_base_url: boolean;
    }
  >;
}

interface AIProviderValidationResponse {
  ok: boolean;
  message?: string;
  details?: unknown;
  mode?: string;
}

const DEFAULT_PROVIDER_OPTIONS: Record<AIProvider, { label: string; default_model: string; requires_base_url: boolean }> = {
  ollama: { label: "Ollama", default_model: "llama3.1:8b", requires_base_url: true },
  openai: { label: "OpenAI", default_model: "gpt-4o-mini", requires_base_url: false },
  anthropic: { label: "Anthropic", default_model: "claude-3-5-haiku-latest", requires_base_url: false },
  gemini: { label: "Google Gemini", default_model: "gemini-2.0-flash", requires_base_url: false },
  custom_openai: { label: "Custom OpenAI-Compatible", default_model: "gpt-4o-mini", requires_base_url: true },
};

export function SettingsPage() {
  const [status, setStatus] = useState<string>("Ready");
  const [provider, setProvider] = useState<AIProvider>("ollama");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [providerMessage, setProviderMessage] = useState("");
  const [providerError, setProviderError] = useState("");
  const [providerBusy, setProviderBusy] = useState(false);

  const versionQuery = useQuery({
    queryKey: ["version"],
    queryFn: () => getJson<VersionResponse>("/api/version"),
    retry: false,
  });

  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: () => getJson<BotStatsResponse>("/api/stats"),
    retry: false,
  });

  const inviteQuery = useQuery({
    queryKey: ["bot-invite"],
    queryFn: () => getJson<InviteResponse>("/api/bot/invite"),
    retry: false,
  });

  const providerQuery = useQuery({
    queryKey: ["user-ai-provider"],
    queryFn: () => getJson<AIProviderStatusResponse>("/api/user/ai-provider"),
    retry: false,
  });

  const providerOptions: Record<string, { label: string; default_model: string; requires_base_url: boolean }> = {
    ...DEFAULT_PROVIDER_OPTIONS,
    ...(providerQuery.data?.supported_providers || {}),
  };

  async function saveProviderConfig(e: React.FormEvent) {
    e.preventDefault();
    setProviderError("");
    setProviderMessage("");

    if (!apiKey.trim()) {
      setProviderError("API key is required");
      return;
    }

    setProviderBusy(true);
    try {
      await postJson<AIProviderStatusResponse>("/api/user/ai-provider", {
        provider,
        api_key: apiKey,
        base_url: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
      });
      setApiKey("");
      setProviderMessage("AI provider configuration saved");
      await providerQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save AI provider";
      setProviderError(message);
    } finally {
      setProviderBusy(false);
    }
  }

  async function validateProviderConfig() {
    setProviderError("");
    setProviderMessage("");

    if (!apiKey.trim()) {
      setProviderError("API key is required to validate");
      return;
    }

    setProviderBusy(true);
    try {
      const result = await postJson<AIProviderValidationResponse>("/api/user/ai-provider/validate", {
        provider,
        api_key: apiKey,
        base_url: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
      });
      const modeHint = result.mode ? ` (${result.mode})` : "";
      setProviderMessage((result.message || "Validation succeeded") + modeHint);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Validation failed";
      setProviderError(message);
    } finally {
      setProviderBusy(false);
    }
  }

  async function disableProviderConfig() {
    setProviderError("");
    setProviderMessage("");
    setProviderBusy(true);
    try {
      await postJson<AIProviderStatusResponse>("/api/user/ai-provider/disable");
      setProviderMessage("AI provider disabled");
      await providerQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to disable AI provider";
      setProviderError(message);
    } finally {
      setProviderBusy(false);
    }
  }

  async function deleteProviderConfig() {
    setProviderError("");
    setProviderMessage("");
    setProviderBusy(true);
    try {
      const response = await fetch("/api/user/ai-provider", {
        method: "DELETE",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to remove provider (${response.status})`);
      }
      setProviderMessage("AI provider removed");
      await providerQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove AI provider";
      setProviderError(message);
    } finally {
      setProviderBusy(false);
    }
  }

  async function runAdminAction(action: "sync_guilds" | "clear_cache" | "reload_config") {
    try {
      await postJson(`/api/actions/${action}`);
      setStatus(`Ran action: ${action}`);
    } catch {
      setStatus(`Action failed: ${action}`);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-cyan/20 bg-surface/80 p-6 shadow-panel">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan">Settings</p>
        <h2 className="mt-3 text-3xl font-semibold text-text-0">System Configuration</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-2">Operational settings, version visibility, invite utilities, and admin controls for the React command center.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-cyan/30 bg-panel/80 p-5 shadow-panel lg:col-span-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Personal AI provider</p>
          <p className="mt-3 text-sm text-text-2">Use your own provider credentials for AI Advisor (BYOK). Supports Ollama Cloud/self-hosted and OpenAI-compatible fallback.</p>

          {providerError ? (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{providerError}</p>
          ) : null}
          {providerMessage ? (
            <p className="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">{providerMessage}</p>
          ) : null}

          <form className="mt-4 grid gap-3 lg:grid-cols-2" onSubmit={saveProviderConfig}>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-2">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as AIProvider)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0"
              >
                {Object.entries(providerOptions).map(([name, cfg]) => (
                  <option key={name} value={name}>{cfg.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-2">Model (optional)</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. llama3.1:8b"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-2">API key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your provider API key"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-2">Base URL (optional, required for custom endpoints)</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="e.g. https://your-ollama-or-openai-endpoint"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0"
              />
            </div>

            <div className="lg:col-span-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => void validateProviderConfig()} disabled={providerBusy} className="rounded-xl border border-cyan/30 bg-cyan/15 px-4 py-2 text-sm text-cyan transition hover:bg-cyan/20 disabled:opacity-50">Validate</button>
              <button type="submit" disabled={providerBusy} className="rounded-xl border border-cyan/30 bg-cyan/15 px-4 py-2 text-sm text-cyan transition hover:bg-cyan/20 disabled:opacity-50">Save</button>
              <button type="button" onClick={() => void disableProviderConfig()} disabled={providerBusy} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 transition hover:bg-amber-500/15 disabled:opacity-50">Disable</button>
              <button type="button" onClick={() => void deleteProviderConfig()} disabled={providerBusy} className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/15 disabled:opacity-50">Remove</button>
            </div>
          </form>

          <div className="mt-4 text-sm text-text-1">
            {providerQuery.isLoading ? (
              <p>Loading provider status...</p>
            ) : providerQuery.data?.configured ? (
              <p>
                Configured: <span className="text-text-0">{providerQuery.data.provider || "unknown"}</span>
                {providerQuery.data.model ? ` • Model: ${providerQuery.data.model}` : ""}
                {providerQuery.data.base_url ? ` • URL: ${providerQuery.data.base_url}` : ""}
                {providerQuery.data.key_hint ? ` • Key: ${providerQuery.data.key_hint}` : ""}
                {providerQuery.data.status ? ` • Status: ${providerQuery.data.status}` : ""}
              </p>
            ) : (
              <p>No personal AI provider is configured yet.</p>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Runtime versioning</p>
          <div className="mt-4 space-y-2 text-sm text-text-1">
            <p>Dashboard: <span className="text-text-0">{versionQuery.data?.dashboard ?? "--"}</span></p>
            <p>Bot: <span className="text-text-0">{versionQuery.data?.bot ?? "--"}</span></p>
            <p>Bot online: <span className="text-text-0">{versionQuery.data?.bot_online ? "yes" : "no"}</span></p>
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Bot operations</p>
          <div className="mt-4 space-y-2 text-sm text-text-1">
            <p>Guilds: <span className="text-text-0">{statsQuery.data?.guilds ?? "--"}</span></p>
            <p>Members: <span className="text-text-0">{statsQuery.data?.members ?? "--"}</span></p>
            <p>Commands today: <span className="text-text-0">{statsQuery.data?.commands_today ?? "--"}</span></p>
            <p>Uptime: <span className="text-text-0">{statsQuery.data?.uptime ?? "--"}</span></p>
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Invite utility</p>
          <p className="mt-3 text-sm text-text-2">Generate bot install URL from current backend config.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={inviteQuery.data?.url ?? "#"} target="_blank" rel="noreferrer" className="rounded-xl border border-cyan/30 bg-cyan/15 px-4 py-2 text-sm text-cyan transition hover:bg-cyan/20">Open invite URL</a>
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Admin actions</p>
          <p className="mt-3 text-sm text-text-2">Requires admin access. Executes existing backend maintenance actions.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => void runAdminAction("sync_guilds")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Sync guilds</button>
            <button onClick={() => void runAdminAction("clear_cache")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Clear cache</button>
            <button onClick={() => void runAdminAction("reload_config")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Reload config</button>
          </div>
          <p className="mt-3 text-xs text-text-2">{status}</p>
        </article>
      </section>
    </div>
  );
}
