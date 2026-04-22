import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { getJson, postJson } from "../lib/api";

interface GuildSummary {
  id: number;
  name: string;
}

interface AdvisorResponse {
  ok: boolean;
  response: string;
  model: string;
  endpoint: string;
  mode: string;
}

interface ChatMessage {
  id: number;
  role: "user" | "advisor" | "error";
  body: string;
}

export function AiAdvisorPage() {
  const [mode, setMode] = useState<"ask" | "interview">("ask");
  const [guildId, setGuildId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("Ready");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "advisor",
      body: "Ask a question and I will generate a practical Discord setup plan.",
    },
  ]);

  const guildsQuery = useQuery({
    queryKey: ["guilds"],
    queryFn: () => getJson<GuildSummary[]>("/api/guilds"),
    retry: false,
  });

  async function sendPrompt() {
    const message = prompt.trim();
    if (!message) {
      setStatus("Prompt required");
      return;
    }

    setMessages((items) => [
      ...items,
      { id: Date.now(), role: "user", body: message },
    ]);
    setStatus("Calling advisor...");

    try {
      const response = await postJson<AdvisorResponse>("/api/ai/advisor", {
        message,
        mode,
        guild_id: guildId ? Number(guildId) : null,
      });

      setMessages((items) => [
        ...items,
        { id: Date.now() + 1, role: "advisor", body: response.response || "No response body." },
      ]);
      setStatus(`Model ${response.model} via ${response.endpoint}`);
      setPrompt("");
    } catch {
      setMessages((items) => [
        ...items,
        { id: Date.now() + 2, role: "error", body: "Network or API error while contacting advisor endpoint." },
      ]);
      setStatus("Request failed");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-cyan/20 bg-surface/80 p-6 shadow-panel">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan">AI Advisor</p>
        <h2 className="mt-3 text-3xl font-semibold text-text-0">Server Architecture Copilot</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-2">Generate practical Discord role, channel, onboarding, moderation, and ticketing plans using your configured model endpoint.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[340px,1fr]">
        <aside className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Request controls</p>
          <div className="space-y-4">
            <label className="grid gap-2 text-sm text-text-1">
              <span>Mode</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as "ask" | "interview")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-text-0 outline-none">
                <option value="ask">Ask</option>
                <option value="interview">Setup interview</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm text-text-1">
              <span>Guild context</span>
              <select value={guildId} onChange={(event) => setGuildId(event.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-text-0 outline-none">
                <option value="">None</option>
                {(guildsQuery.data ?? []).map((guild) => (
                  <option key={guild.id} value={guild.id}>{guild.name}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-text-1">
              <span>Prompt</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Design roles and channels for a gaming server with moderation and support tickets."
                className="min-h-[180px] rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-text-0 outline-none placeholder:text-text-3"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => void sendPrompt()} className="rounded-xl border border-cyan/30 bg-cyan/15 px-4 py-2 text-sm text-cyan transition hover:bg-cyan/20">Send to advisor</button>
              <button onClick={() => setPrompt("Create a complete Discord structure for a 5,000 member gaming community with onboarding, moderation, and support workflows.")} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Starter prompt</button>
              <button onClick={() => { setMessages([]); setStatus("Cleared"); }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-text-1 transition hover:border-cyan/30 hover:text-cyan">Clear</button>
            </div>

            <p className="text-xs text-text-2">{status}</p>
          </div>
        </aside>

        <div className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-panel">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan">Conversation</p>
          <div className="max-h-[640px] space-y-3 overflow-auto">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`rounded-xl border p-3 ${
                  message.role === "user"
                    ? "border-cyan/30 bg-cyan/10"
                    : message.role === "error"
                      ? "border-rose-300/30 bg-rose-300/10"
                      : "border-white/10 bg-white/5"
                }`}
              >
                <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-text-2">
                  {message.role === "user" ? "You" : message.role === "error" ? "Advisor error" : "Advisor"}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-6 text-text-1">{message.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
