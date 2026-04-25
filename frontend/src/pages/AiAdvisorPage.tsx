import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Send, Loader, Sparkles, Wand2, ChevronRight, ChevronDown,
  Hash, Volume2, Megaphone, MessageSquare, Shield, Crown,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Play,
  Zap, Server, Layers, LayoutTemplate, ArrowRight, Copy, Check
} from 'lucide-react'
import { getJson, postJson } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────

interface GuildSummary { id: number; name: string; discord_id?: string }

interface BlueprintRole {
  name: string; color: string; hoist: boolean; mentionable: boolean; permissions: string[]
}
interface BlueprintChannel {
  name: string; type: 'text' | 'voice' | 'forum' | 'announcement'; topic?: string; nsfw?: boolean; slowmode?: number
}
interface BlueprintCategory {
  name: string; channels: BlueprintChannel[]
}
interface ServerBlueprint {
  server_name?: string
  description?: string
  roles: BlueprintRole[]
  categories: BlueprintCategory[]
  summary?: string
}

interface ChatMessage {
  id: number
  role: 'user' | 'advisor' | 'error' | 'system'
  body: string
  blueprint?: ServerBlueprint
  isLoading?: boolean
}

interface ExecuteResult {
  ok: boolean; summary: string
  results: {
    roles_created: string[]; roles_failed: any[]
    channels_created: string[]; channels_failed: any[]
    errors: string[]
  }
}

// ── Channel icon ───────────────────────────────────────────────────────────

function ChannelIcon({ type }: { type: string }) {
  switch (type) {
    case 'voice': return <Volume2 className="w-3.5 h-3.5 text-text-2 flex-shrink-0" />
    case 'announcement': return <Megaphone className="w-3.5 h-3.5 text-text-2 flex-shrink-0" />
    case 'forum': return <MessageSquare className="w-3.5 h-3.5 text-text-2 flex-shrink-0" />
    default: return <Hash className="w-3.5 h-3.5 text-text-2 flex-shrink-0" />
  }
}

// ── Blueprint Card ─────────────────────────────────────────────────────────

function BlueprintCard({
  blueprint, guilds, onExecute, executing
}: {
  blueprint: ServerBlueprint
  guilds: GuildSummary[]
  onExecute: (guildId: string, renameServer: boolean) => void
  executing: boolean
}) {
  const [open, setOpen] = useState(true)
  const [selectedGuild, setSelectedGuild] = useState('')
  const [rename, setRename] = useState(false)
  const [expandedCats, setExpandedCats] = useState<Record<number, boolean>>({0: true})

  const totalChannels = blueprint.categories.reduce((s, c) => s + c.channels.length, 0)

  return (
    <div className="mt-3 rounded-xl border border-cyan/30 bg-surface-strong overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-cyan/5 transition"
      >
        <div className="flex items-center gap-2">
          <LayoutTemplate className="w-4 h-4 text-cyan" />
          <span className="text-sm font-semibold text-cyan">
            {blueprint.server_name || 'Server Blueprint'}
          </span>
          <span className="text-xs text-text-2 bg-surface px-2 py-0.5 rounded-full">
            {blueprint.roles.length} roles · {blueprint.categories.length} categories · {totalChannels} channels
          </span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-text-2" /> : <ChevronRight className="w-4 h-4 text-text-2" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Description */}
          {blueprint.description && (
            <p className="text-xs text-text-2 border-l-2 border-cyan/30 pl-3">{blueprint.description}</p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Roles */}
            <div>
              <h4 className="text-xs font-semibold text-text-1 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Roles
              </h4>
              <div className="space-y-1.5">
                {blueprint.roles.map((role, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-surface hover:bg-surface/80">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 border border-white/10"
                      style={{ backgroundColor: role.color || '#99aab5' }}
                    />
                    <span className="text-xs text-text-0 font-medium truncate">{role.name}</span>
                    {role.hoist && <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Channels */}
            <div>
              <h4 className="text-xs font-semibold text-text-1 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Channels
              </h4>
              <div className="space-y-1">
                {blueprint.categories.map((cat, ci) => (
                  <div key={ci}>
                    <button
                      onClick={() => setExpandedCats(p => ({ ...p, [ci]: !p[ci] }))}
                      className="w-full flex items-center gap-1 text-xs font-semibold text-text-2 uppercase tracking-wider py-1 hover:text-text-1 transition"
                    >
                      {expandedCats[ci] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {cat.name}
                    </button>
                    {expandedCats[ci] && (
                      <div className="ml-3 space-y-0.5">
                        {cat.channels.map((ch, chi) => (
                          <div key={chi} className="flex items-center gap-1.5 py-0.5 px-2 rounded hover:bg-surface text-xs text-text-1">
                            <ChannelIcon type={ch.type} />
                            {ch.name}
                            {ch.topic && <span className="text-text-2 truncate ml-1 hidden sm:block">— {ch.topic}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Execute section */}
          <div className="border-t border-white/5 pt-3">
            <h4 className="text-xs font-semibold text-text-1 mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan" /> Apply to Server
            </h4>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedGuild}
                onChange={e => setSelectedGuild(e.target.value)}
                className="flex-1 text-xs bg-surface border border-white/10 rounded-lg px-3 py-2 text-text-0 focus:outline-none focus:border-cyan"
              >
                <option value="">Select a server...</option>
                {guilds.map(g => (
                  <option key={g.id} value={String(g.discord_id || g.id)}>
                    {g.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-text-2 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={rename}
                  onChange={e => setRename(e.target.checked)}
                  className="rounded"
                />
                Rename server
              </label>
              <button
                disabled={!selectedGuild || executing}
                onClick={() => onExecute(selectedGuild, rename)}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan text-void text-xs font-semibold rounded-lg hover:bg-cyan/90 disabled:opacity-40 disabled:cursor-not-allowed transition whitespace-nowrap"
              >
                {executing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {executing ? 'Applying…' : 'Apply Blueprint'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Execute Result ─────────────────────────────────────────────────────────

function ExecuteResultCard({ result }: { result: ExecuteResult }) {
  return (
    <div className={`mt-2 rounded-lg border p-3 text-xs ${result.ok ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
      <div className="flex items-center gap-2 mb-2">
        {result.ok
          ? <CheckCircle2 className="w-4 h-4 text-green-400" />
          : <AlertCircle className="w-4 h-4 text-yellow-400" />}
        <span className={`font-semibold ${result.ok ? 'text-green-400' : 'text-yellow-400'}`}>
          {result.summary}
        </span>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {result.results.roles_created.length > 0 && (
          <div>
            <span className="text-text-2 font-medium">Roles: </span>
            <span className="text-text-1">{result.results.roles_created.join(', ')}</span>
          </div>
        )}
        {result.results.channels_created.length > 0 && (
          <div className="whitespace-pre-wrap font-mono text-[10px] text-text-2">
            {result.results.channels_created.join('\n')}
          </div>
        )}
        {result.results.roles_failed.map((f, i) => (
          <div key={i} className="text-red-400">✗ Role '{f.name}': {JSON.stringify(f.error).slice(0, 80)}</div>
        ))}
        {result.results.channels_failed.map((f, i) => (
          <div key={i} className="text-red-400">✗ Channel '{f.name}': {JSON.stringify(f.error).slice(0, 80)}</div>
        ))}
      </div>
    </div>
  )
}

// ── Starter Prompts ────────────────────────────────────────────────────────

const STARTERS = [
  { label: "Gaming community", prompt: "Build me a gaming server for a 500-person Minecraft community with staff hierarchy, game channels, and a ticket system" },
  { label: "Dev team", prompt: "Set up a developer workspace with channels for different tech stacks, CI/CD notifications, and code review coordination" },
  { label: "Study group", prompt: "Create an academic study server for university students with subject channels, study sessions, and resource sharing" },
  { label: "Content creator", prompt: "Design a content creator community server for a YouTube channel with VIP tiers, announcements, and fan engagement" },
  { label: "Business team", prompt: "Set up a professional business server with departments (marketing, engineering, support), project tracking, and client channels" },
  { label: "Art community", prompt: "Build a creative art community server with galleries, critique channels, commissions, and artist roles" },
]

// ── Main Page ──────────────────────────────────────────────────────────────

const WELCOME: ChatMessage = {
  id: 0,
  role: 'advisor',
  body: "👋 Hi! I'm your AI Server Advisor. I can help you:\n\n• **Design** a complete server structure with roles, channels, and categories\n• **Generate** a ready-to-apply blueprint from a simple description\n• **Apply** the blueprint directly to your Discord server\n\nTell me about the server you want to build, or pick a starter below.",
}

export function AiAdvisorPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [currentBlueprint, setCurrentBlueprint] = useState<ServerBlueprint | null>(null)
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null)
  const [blueprintGenerating, setBlueprintGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const guildsQuery = useQuery({
    queryKey: ['guilds'],
    queryFn: () => getJson<GuildSummary[]>('/api/guilds').catch(() => []),
    retry: false,
  })

  // Build conversation history for context
  const history = messages
    .filter(m => m.role === 'user' || m.role === 'advisor')
    .slice(-20)
    .map(m => ({ role: m.role === 'advisor' ? 'assistant' : 'user', content: m.body }))

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMsg = (msg: Omit<ChatMessage, 'id'>) => {
    setMessages(prev => [...prev, { ...msg, id: Date.now() + Math.random() }])
  }

  async function sendMessage(text?: string) {
    const msg = (text ?? prompt).trim()
    if (!msg || loading) return
    setPrompt('')
    addMsg({ role: 'user', body: msg })
    setLoading(true)

    try {
      const res = await postJson<{ ok: boolean; response: string; blueprint?: ServerBlueprint; error?: string }>('/api/ai/advisor', {
        message: msg,
        history,
        mode: 'ask',
      })
      if (!res.ok) throw new Error(res.error || 'Advisor error')
      addMsg({ role: 'advisor', body: res.response })
      if (res.blueprint) {
        setCurrentBlueprint(res.blueprint)
      }
    } catch (e: any) {
      addMsg({ role: 'error', body: e.message || 'Error connecting to advisor' })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function generateBlueprint(description: string) {
    setBlueprintGenerating(true)
    addMsg({ role: 'user', body: description })
    addMsg({ role: 'system', body: '🔄 Generating your server blueprint…' })

    try {
      const res = await postJson<{ ok: boolean; blueprint?: ServerBlueprint; error?: string }>('/api/ai/advisor/blueprint', {
        description,
      })
      if (!res.ok || !res.blueprint) throw new Error(res.error || 'Blueprint generation failed')
      setCurrentBlueprint(res.blueprint)
      // Replace the generating message
      setMessages(prev => {
        const copy = [...prev]
        const sysIdx = copy.findLastIndex(m => m.role === 'system')
        if (sysIdx >= 0) {
          copy[sysIdx] = {
            ...copy[sysIdx],
            role: 'advisor',
            body: res.blueprint!.summary || `Here's your server blueprint for **${res.blueprint!.server_name || 'your server'}**! Review it below, then select a server and click Apply to create everything automatically.`,
          }
        }
        return copy
      })
    } catch (e: any) {
      setMessages(prev => {
        const copy = [...prev]
        const sysIdx = copy.findLastIndex(m => m.role === 'system')
        if (sysIdx >= 0) {
          copy[sysIdx] = { ...copy[sysIdx], role: 'error', body: e.message || 'Blueprint generation failed' }
        }
        return copy
      })
    } finally {
      setBlueprintGenerating(false)
      inputRef.current?.focus()
    }
  }

  async function executeBlueprint(guildDiscordId: string, renameServer: boolean) {
    if (!currentBlueprint) return
    setExecuting(true)
    setExecuteResult(null)

    try {
      const res = await postJson<{ ok: boolean; summary: string; results: any; error?: string }>('/api/ai/advisor/execute', {
        blueprint: currentBlueprint,
        guild_id: guildDiscordId,
        rename_server: renameServer,
      })
      setExecuteResult(res as ExecuteResult)
      if (res.ok) {
        addMsg({ role: 'advisor', body: `✅ Blueprint applied! ${res.summary}` })
      } else {
        addMsg({ role: 'advisor', body: `⚠️ Applied with some issues. ${res.summary}` })
      }
    } catch (e: any) {
      addMsg({ role: 'error', body: `Execution failed: ${e.message}` })
    } finally {
      setExecuting(false)
    }
  }

  function copyBlueprint() {
    if (!currentBlueprint) return
    navigator.clipboard.writeText(JSON.stringify(currentBlueprint, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function reset() {
    setMessages([WELCOME])
    setCurrentBlueprint(null)
    setExecuteResult(null)
    setPrompt('')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-5xl mx-auto gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-cyan font-display flex items-center gap-2">
            <Sparkles className="w-7 h-7" /> AI Server Advisor
          </h1>
          <p className="text-text-2 text-sm mt-0.5">Design, generate, and deploy your Discord server structure with AI</p>
        </div>
        <div className="flex items-center gap-2">
          {currentBlueprint && (
            <button
              onClick={copyBlueprint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-white/10 rounded-lg hover:bg-surface-strong transition text-text-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
          )}
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-white/10 rounded-lg hover:bg-surface-strong transition text-text-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> New session
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Left sidebar — starters + blueprint summary */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
          {/* Quick build */}
          <div className="rounded-xl border border-white/5 bg-surface-strong p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Wand2 className="w-3.5 h-3.5 text-cyan" />
              <span className="text-xs font-semibold text-text-1">Quick Build</span>
            </div>
            <div className="space-y-1">
              {STARTERS.map((s, i) => (
                <button
                  key={i}
                  disabled={loading || blueprintGenerating}
                  onClick={() => generateBlueprint(s.prompt)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-cyan/10 hover:text-cyan text-text-2 transition disabled:opacity-40"
                >
                  <ArrowRight className="w-3 h-3 inline mr-1" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Blueprint status */}
          {currentBlueprint && (
            <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Server className="w-3.5 h-3.5 text-cyan" />
                <span className="text-xs font-semibold text-cyan">Active Blueprint</span>
              </div>
              <p className="text-xs text-text-1 font-medium truncate">{currentBlueprint.server_name || 'Unnamed Server'}</p>
              <p className="text-xs text-text-2 mt-0.5">
                {currentBlueprint.roles.length} roles · {currentBlueprint.categories.length} categories
              </p>
              <div className="mt-2 pt-2 border-t border-white/5 space-y-0.5">
                {currentBlueprint.categories.map((c, i) => (
                  <div key={i} className="text-xs text-text-2">
                    📁 {c.name} ({c.channels.length})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-white/5 bg-surface-strong overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'max-w-[70%]' : 'w-full'}`}>
                  {/* Role label */}
                  {(msg.role === 'advisor' || msg.role === 'system') && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3 h-3 text-cyan" />
                      <span className="text-xs text-cyan font-medium">Sloth Advisor</span>
                    </div>
                  )}

                  {/* Message bubble */}
                  <div className={`px-4 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-cyan/15 border border-cyan/30 text-text-0 rounded-tr-sm'
                      : msg.role === 'error'
                        ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                        : msg.role === 'system'
                          ? 'bg-surface border border-white/5 text-text-2 text-xs italic'
                          : 'bg-surface border border-white/5 text-text-0 rounded-tl-sm'
                  }`}>
                    {/* Render markdown-ish bold */}
                    {msg.body.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                      part.startsWith('**') && part.endsWith('**')
                        ? <strong key={i} className="font-semibold text-text-0">{part.slice(2, -2)}</strong>
                        : part
                    )}
                  </div>

                  {/* Blueprint card attached to advisor message */}
                  {msg.role === 'advisor' && currentBlueprint && msg.id === messages.filter(m => m.role === 'advisor').at(-1)?.id && (
                    <BlueprintCard
                      blueprint={currentBlueprint}
                      guilds={guildsQuery.data || []}
                      onExecute={executeBlueprint}
                      executing={executing}
                    />
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {(loading || blueprintGenerating) && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-white/5 text-sm text-text-2">
                  <Loader className="w-4 h-4 animate-spin text-cyan" />
                  {blueprintGenerating ? 'Generating blueprint…' : 'Advisor is thinking…'}
                </div>
              </div>
            )}

            {/* Execute result */}
            {executeResult && (
              <div className="flex justify-start w-full">
                <ExecuteResultCard result={executeResult} />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/5 p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }}
                disabled={loading || blueprintGenerating}
                placeholder="Describe your server or ask a question… (Enter to send)"
                className="flex-1 px-4 py-2.5 rounded-lg bg-surface border border-white/10 text-text-0 text-sm placeholder-text-2 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/20 disabled:opacity-50"
              />
              <button
                onClick={() => void generateBlueprint(prompt.trim() || 'a general community server')}
                disabled={loading || blueprintGenerating}
                title="Generate full blueprint"
                className="px-3 py-2.5 rounded-lg bg-surface border border-white/10 hover:border-cyan/40 hover:bg-cyan/5 text-text-2 hover:text-cyan transition disabled:opacity-40"
              >
                <Wand2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => void sendMessage()}
                disabled={loading || blueprintGenerating || !prompt.trim()}
                className="px-4 py-2.5 rounded-lg bg-cyan text-void font-semibold hover:bg-cyan/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-text-2 mt-1.5 px-1">
              Press <kbd className="text-[10px] bg-surface border border-white/10 px-1 py-0.5 rounded">Enter</kbd> to chat · 
              Click <Wand2 className="w-2.5 h-2.5 inline" /> to generate a full blueprint
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
