import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getJson, postJson } from "../lib/api";
import { useAuthStore } from "../store/authStore";

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

interface BotConfigResponse {
  configured: boolean;
  bot_name: string | null;
  client_id: string | null;
  application_id: string | null;
  public_key: string | null;
  guild_id: string | null;
  token_hint: string | null;
  client_secret_hint: string | null;
  status: string | null;
  updated_at: string | null;
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
  const user = useAuthStore((s) => s.user);
  const isOwner = Boolean(user?.is_owner);
  const [status, setStatus] = useState<string>("Ready");
  const [provider, setProvider] = useState<AIProvider>("ollama");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [providerMessage, setProviderMessage] = useState("");
  const [providerError, setProviderError] = useState("");
  const [providerBusy, setProviderBusy] = useState(false);
  const [botConfigBusy, setBotConfigBusy] = useState(false);
  const [botConfigMessage, setBotConfigMessage] = useState("");
  const [botConfigError, setBotConfigError] = useState("");
  const [botName, setBotName] = useState("");
  const [clientId, setClientId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [guildId, setGuildId] = useState("");
  const [botToken, setBotToken] = useState("");
  const [clientSecret, setClientSecret] = useState("");

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

  const botConfigQuery = useQuery({
    queryKey: ["bot-config"],
    queryFn: () => getJson<BotConfigResponse>("/api/bot/config"),
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

  useEffect(() => {
    const cfg = botConfigQuery.data;
    if (!cfg) return;
    setBotName(cfg.bot_name ?? "");
    setClientId(cfg.client_id ?? "");
    setApplicationId(cfg.application_id ?? "");
    setPublicKey(cfg.public_key ?? "");
    setGuildId(cfg.guild_id ?? "");
  }, [botConfigQuery.data]);

  async function saveBotConfig(e: React.FormEvent) {
    e.preventDefault();
    setBotConfigError("");
    setBotConfigMessage("");

    if (!isOwner) {
      setBotConfigError("Only dashboard owners can update bot details.");
      return;
    }

    setBotConfigBusy(true);
    try {
      await postJson<BotConfigResponse>("/api/bot/config", {
        bot_name: botName.trim() || undefined,
        client_id: clientId.trim() || undefined,
        application_id: applicationId.trim() || undefined,
        public_key: publicKey.trim() || undefined,
        guild_id: guildId.trim() || undefined,
        token: botToken.trim() || undefined,
        client_secret: clientSecret.trim() || undefined,
      });
      setBotToken("");
      setClientSecret("");
      setBotConfigMessage("Discord bot details saved.");
      await Promise.all([botConfigQuery.refetch(), inviteQuery.refetch()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save bot details";
      setBotConfigError(message);
    } finally {
      setBotConfigBusy(false);
    }
  }

  async function clearBotToken() {
    setBotConfigError("");
    setBotConfigMessage("");

    if (!isOwner) {
      setBotConfigError("Only dashboard owners can clear the bot token.");
      return;
    }

    setBotConfigBusy(true);
    try {
      const response = await fetch("/api/bot/config/token", {
        method: "DELETE",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to clear token (${response.status})`);
      }
      setBotConfigMessage("Bot token removed from dashboard storage.");
      await botConfigQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to clear bot token";
      setBotConfigError(message);
    } finally {
      setBotConfigBusy(false);
    }
  }

  async function clearBotSecrets() {
    setBotConfigError("");
    setBotConfigMessage("");

    if (!isOwner) {
      setBotConfigError("Only dashboard owners can clear bot secrets.");
      return;
    }

    setBotConfigBusy(true);
    try {
      const response = await fetch("/api/bot/config/secrets", {
        method: "DELETE",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to clear bot secrets (${response.status})`);
      }
      setBotConfigMessage("Stored bot token and client secret removed.");
      await botConfigQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to clear bot secrets";
      setBotConfigError(message);
    } finally {
      setBotConfigBusy(false);
    }
  }

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

  const queryClient = useQueryClient();

  const cogsQuery = useQuery<{ cog: string; commands: unknown[]; count: number }[]>({
    queryKey: ["bot-cogs"],
    queryFn: () => getJson("/api/bot/cogs"),
    staleTime: 60_000,
    retry: false,
  });

  const toggleCogMutation = useMutation({
    mutationFn: ({ cog_name, enabled }: { cog_name: string; enabled: boolean }) =>
      postJson("/api/bot/command", { command: "toggle_cog", payload: { cog_name, enabled } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bot-cogs"] });
      setStatus("Cog toggle sent to bot.");
    },
    onError: () => setStatus("Failed to toggle cog."),
  });

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

        <article className="rounded-2xl border border-cyan/30 bg-panel/80 p-5 shadow-panel lg:col-span-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Discord bot details</p>
          <p className="mt-3 text-sm text-text-2">Owner-only feature for storing bot metadata and token securely in dashboard storage for operational tooling.</p>
          <p className="mt-2 text-xs text-text-3">Runtime token compatibility: bot startup accepts DISSIDENT_TOKEN, DISCORD_BOT_TOKEN, or DISCORD_TOKEN. Vault push now auto-adds aliases for DISCORD_BOT_TOKEN and DISSIDENT_TOKEN.</p>

          {botConfigError ? (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{botConfigError}</p>
          ) : null}
          {botConfigMessage ? (
            <p className="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">{botConfigMessage}</p>
          ) : null}

          {!isOwner ? (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">Only dashboard owners can edit these values.</p>
          ) : null}

          <form className="mt-4 grid gap-3 lg:grid-cols-2" onSubmit={saveBotConfig}>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-2">Bot name</label>
              <input value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="Sloth Lee" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0" disabled={!isOwner || botConfigBusy} />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-2">Client ID</label>
              <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Discord application client ID" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0" disabled={!isOwner || botConfigBusy} />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-2">Application ID (optional)</label>
              <input value={applicationId} onChange={(e) => setApplicationId(e.target.value)} placeholder="Discord application ID" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0" disabled={!isOwner || botConfigBusy} />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-2">Primary Guild ID (optional)</label>
              <input value={guildId} onChange={(e) => setGuildId(e.target.value)} placeholder="Discord server ID" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0" disabled={!isOwner || botConfigBusy} />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-2">Public key (optional)</label>
              <input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="Discord interaction public key" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0" disabled={!isOwner || botConfigBusy} />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-2">Bot token (optional update)</label>
              <input type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="Paste a new token only when rotating" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0" disabled={!isOwner || botConfigBusy} />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-text-2">Client secret (optional update)</label>
              <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Paste Discord app client secret only when rotating" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0" disabled={!isOwner || botConfigBusy} />
            </div>
            <div className="lg:col-span-2 flex flex-wrap gap-2">
              <button type="submit" disabled={!isOwner || botConfigBusy} className="rounded-xl border border-cyan/30 bg-cyan/15 px-4 py-2 text-sm text-cyan transition hover:bg-cyan/20 disabled:opacity-50">Save bot details</button>
              <button type="button" onClick={() => void clearBotToken()} disabled={!isOwner || botConfigBusy} className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/15 disabled:opacity-50">Clear stored token</button>
              <button type="button" onClick={() => void clearBotSecrets()} disabled={!isOwner || botConfigBusy} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 transition hover:bg-amber-500/15 disabled:opacity-50">Clear stored secrets</button>
            </div>
          </form>

          <div className="mt-4 text-sm text-text-1">
            {botConfigQuery.isLoading ? (
              <p>Loading bot config...</p>
            ) : (
              <p>
                Status: <span className="text-text-0">{botConfigQuery.data?.status ?? "not_configured"}</span>
                {botConfigQuery.data?.token_hint ? ` • Token: ${botConfigQuery.data.token_hint}` : " • Token: not stored"}
                {botConfigQuery.data?.client_secret_hint ? ` • Client secret: ${botConfigQuery.data.client_secret_hint}` : " • Client secret: not stored"}
                {botConfigQuery.data?.updated_at ? ` • Updated: ${new Date(botConfigQuery.data.updated_at).toLocaleString()}` : ""}
              </p>
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
          <p className="mt-2 text-xs text-text-3">Client ID source: <span className="text-text-1">{inviteQuery.data?.client_id || "not configured"}</span></p>
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

      {/* Cog Management */}
      {user?.is_admin && (
        <section className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Cog management</p>
          <p className="mt-1 text-sm text-text-2">Toggle bot modules (cogs) on or off. Changes take effect immediately.</p>
          {cogsQuery.isLoading && <p className="mt-4 text-xs text-text-2">Loading cogs…</p>}
          {cogsQuery.isError && <p className="mt-4 text-xs text-danger">Could not load cog list.</p>}
          {cogsQuery.data && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cogsQuery.data.map(({ cog, count }) => (
                <div
                  key={cog}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <span className="text-sm text-text-1 truncate flex-1 mr-2" title={cog}>{cog}</span>
                  <span className="text-[10px] text-text-3 mr-3 flex-shrink-0">{count} cmd{count !== 1 ? 's' : ''}</span>
                  <button
                    onClick={() => toggleCogMutation.mutate({ cog_name: cog, enabled: false })}
                    disabled={toggleCogMutation.isPending}
                    title="Unload cog"
                    className="text-xs text-danger hover:text-danger/70 transition flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
