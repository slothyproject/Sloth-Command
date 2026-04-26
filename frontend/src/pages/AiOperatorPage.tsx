import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, Loader, Sparkles, Wand2, ChevronRight, Shield, Play, AlertCircle, CheckCircle2 } from 'lucide-react'
import { getJson, postJson } from '../lib/api'

interface GuildSummary { id: number; name: string }

interface Step { op: string; params: Record<string, any> }

interface OperatorResult {
  ok: boolean
  summary: string
  need_confirmation: boolean
  steps: Step[]
  results: Array<{ op: string; ok: boolean; error?: string }>
  research_used: boolean
  dry_run: boolean
}

export function AiOperatorPage() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState<OperatorResult | null>(null)
  const [research, setResearch] = useState(false)
  const [guildId, setGuildId] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const guildsQuery = useQuery({
    queryKey: ['guilds'],
    queryFn: () => getJson<GuildSummary[]>('/api/guilds').catch(() => []),
    retry: false,
  })

  async function sendCommand(dryRun: boolean = true) {
    const msg = message.trim()
    if (!msg || loading) return
    setLoading(true)
    setLastResult(null)

    try {
      const res = await postJson<OperatorResult>('/api/ai/operator', {
        message: msg,
        research,
        guild_id: guildId ? Number(guildId) : undefined,
        dry_run: dryRun,
      })
      setLastResult(res)
    } catch (e: any) {
      setLastResult({
        ok: false,
        summary: e.message || 'Operator request failed',
        need_confirmation: false,
        steps: [],
        results: [],
        research_used: research,
        dry_run: true,
      })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function confirmSteps() {
    if (!lastResult?.steps?.length) return
    setLoading(true)
    try {
      const res = await postJson<OperatorResult>('/api/ai/operator/confirm', {
        steps: lastResult.steps,
      })
      setLastResult(res)
    } catch (e: any) {
      setLastResult({
        ok: false,
        summary: e.message || 'Execution failed',
        need_confirmation: false,
        steps: lastResult?.steps || [],
        results: [],
        research_used: research,
        dry_run: false,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-cyan font-display flex items-center gap-2">
          <Sparkles className="w-7 h-7" /> AI Operator
        </h1>
        <p className="text-text-2 text-sm mt-1">
          Execute moderation, tickets, and settings from natural language.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <select
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-0"
              >
                <option value="">Select guild</option>
                {(guildsQuery.data || []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-text-2">
                <input
                  type="checkbox"
                  checked={research}
                  onChange={(e) => setResearch(e.target.checked)}
                  className="rounded"
                />
                Use live data
              </label>
            </div>

            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void sendCommand(true)
                  }
                }}
                placeholder="e.g. Mute user X for 1 hour and open a ticket"
                className="flex-1 px-4 py-2.5 rounded-lg bg-surface border border-white/10 text-text-0 text-sm placeholder-text-2 focus:outline-none focus:border-cyan"
              />
              <button
                onClick={() => void sendCommand(true)}
                disabled={loading || !message.trim()}
                className="px-4 py-2.5 rounded-lg bg-cyan text-void font-semibold hover:bg-cyan/90 disabled:opacity-40 transition flex items-center gap-2"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Preview
              </button>
            </div>

            {lastResult && (
              <div className="rounded-xl border border-white/5 bg-surface-strong p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {lastResult.ok ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  )}
                  <p className="text-sm font-medium text-text-0">{lastResult.summary}</p>
                </div>

                {lastResult.steps?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-text-2">Planned steps</p>
                    {lastResult.steps.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm text-text-1 px-2 py-1 rounded bg-surface"
                      >
                        <ChevronRight className="w-3 h-3 text-cyan" />
                        <Shield className="w-3 h-3 text-text-2" />
                        <span className="font-medium">{s.op}</span>
                        <span className="text-text-2 text-xs">{JSON.stringify(s.params)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {lastResult.results?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-text-2">Execution results</p>
                    {lastResult.results.map((r, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${
                          r.ok ? 'text-green-300 bg-green-500/5' : 'text-red-300 bg-red-500/5'
                        }`}
                      >
                        {r.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        <span className="font-medium">{r.op}</span>
                        {r.error && <span className="text-xs">{r.error}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {lastResult.need_confirmation && (
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => void confirmSteps()}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 bg-cyan text-void font-semibold rounded-lg hover:bg-cyan/90 disabled:opacity-40 transition"
                    >
                      <Play className="w-4 h-4" />
                      {loading ? 'Running…' : 'Execute'}
                    </button>
                    <button
                      onClick={() => setLastResult(null)}
                      className="px-4 py-2 border border-white/10 rounded-lg text-text-1 hover:bg-surface transition"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-white/5 bg-surface-strong p-3">
            <p className="text-xs font-semibold text-text-1 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Operator Commands
            </p>
            <div className="space-y-1 text-xs text-text-2">
              <p>• moderation/ban, kick, mute, warn</p>
              <p>• moderation/unban, unmute</p>
              <p>• tickets/open, tickets/close</p>
              <p>• settings/update</p>
              <p>• automod/toggle</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
