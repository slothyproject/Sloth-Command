import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, Lightbulb, Loader } from 'lucide-react'
import { Link } from 'react-router-dom'

import { getJson, postJson } from '../lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

interface GuildSummary {
  id: number
  name: string
}

interface GuildOverview {
  name: string
  member_count: number
  ticket_count: number
  mod_case_count: number
}

interface AdvisorResponse {
  ok: boolean
  response: string
  model: string
  endpoint: string
  mode: string
}

interface ChatMessage {
  id: number
  role: 'user' | 'advisor' | 'error'
  body: string
  chips?: { label: string; to: string }[]
}

const STARTER_PROMPTS = [
  'Design roles and channels for a gaming server',
  'Create a moderation strategy for a large community',
  'Set up a support ticket system workflow',
  'Plan onboarding process for new members',
]

const INITIAL_MESSAGE = '👋 Welcome! I can help you design and optimize your Discord server architecture. Ask me anything about roles, channels, moderation, support systems, or community management.'

function deriveChips(text: string, guildId: string): { label: string; to: string }[] {
  if (!guildId) return []
  const lower = text.toLowerCase()
  const chips: { label: string; to: string }[] = []
  if (/moderat|warn|ban|kick|mute/.test(lower)) chips.push({ label: 'Go to Moderation', to: `/servers/${guildId}?tab=moderation` })
  if (/ticket/.test(lower)) chips.push({ label: 'Ticket Config', to: `/servers/${guildId}?tab=tickets` })
  if (/welcome|farewell|join/.test(lower)) chips.push({ label: 'Welcome Settings', to: `/servers/${guildId}?tab=settings` })
  if (/level|xp|rank/.test(lower)) chips.push({ label: 'Leveling Config', to: `/servers/${guildId}?tab=settings` })
  if (/antinuke|nuke|protect/.test(lower)) chips.push({ label: 'Anti-Nuke', to: `/servers/${guildId}?tab=settings` })
  return chips
}

export function AiAdvisorPage() {
  const [mode, setMode] = useState<'ask' | 'interview'>('ask')
  const [guildId, setGuildId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const storageKey = `advisor-chat-${guildId || 'global'}`

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(`advisor-chat-${guildId || 'global'}`)
      if (saved) return JSON.parse(saved) as ChatMessage[]
    } catch {}
    return [{ id: 1, role: 'advisor', body: INITIAL_MESSAGE }]
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Reload messages from localStorage when guildId changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        setMessages(JSON.parse(saved) as ChatMessage[])
        return
      }
    } catch {}
    setMessages([{ id: 1, role: 'advisor', body: INITIAL_MESSAGE }])
  }, [storageKey])

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)) } catch {}
  }, [messages, storageKey])

  const guildsQuery = useQuery({
    queryKey: ['guilds'],
    queryFn: () =>
      getJson<GuildSummary[]>('/api/guilds').catch(() => [
        { id: 1, name: 'Main Server' },
        { id: 2, name: 'Community Hub' },
      ]),
    retry: false,
  })

  const guildOverviewQuery = useQuery({
    queryKey: ['guild-overview-advisor', guildId],
    queryFn: () => getJson<GuildOverview>(`/api/guilds/${guildId}`),
    enabled: !!guildId,
    staleTime: 60_000,
    retry: 1,
  })

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function sendPrompt() {
    const message = prompt.trim()
    if (!message || isLoading) return

    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', body: message }])
    setPrompt('')
    setIsLoading(true)

    try {
      const context = guildOverviewQuery.data
        ? {
            guild_name: guildOverviewQuery.data.name,
            member_count: guildOverviewQuery.data.member_count,
            open_tickets: guildOverviewQuery.data.ticket_count,
            mod_cases: guildOverviewQuery.data.mod_case_count,
          }
        : undefined

      const response = await postJson<AdvisorResponse>('/api/ai/advisor', {
        message,
        mode,
        guild_id: guildId ? Number(guildId) : null,
        ...(context ? { context } : {}),
      })

      const body = response.response || 'I processed your request but have no response to share.'
      const chips = deriveChips(body, guildId)

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'advisor', body, chips: chips.length ? chips : undefined },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          role: 'error',
          body: 'Sorry, I encountered an error connecting to the advisor. Please try again.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendPrompt()
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-cyan font-display mb-2">AI Advisor</h1>
        <p className="text-text-2">Get AI-powered recommendations for your server setup</p>
      </div>

      {/* Main Chat Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Controls */}
        <Card variant="elevated" className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-1 mb-2">Mode</label>
              <Select
                options={[
                  { label: 'Quick Ask', value: 'ask' },
                  { label: 'Setup Interview', value: 'interview' },
                ]}
                value={mode}
                onChange={(e) => setMode((e.target as HTMLSelectElement).value as 'ask' | 'interview')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-1 mb-2">Guild Context</label>
              <Select
                options={[
                  { label: 'None', value: '' },
                  ...(guildsQuery.data || []).map((guild) => ({
                    label: guild.name,
                    value: String(guild.id),
                  })),
                ]}
                value={guildId}
                onChange={(e) => setGuildId((e.target as HTMLSelectElement).value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-1 mb-2">Starter Prompts</label>
              <div className="space-y-2">
                {STARTER_PROMPTS.map((starterPrompt, idx) => (
                  <Button
                    key={idx}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-auto py-2"
                    onClick={() => setPrompt(starterPrompt)}
                  >
                    <Lightbulb className="w-3 h-3 mr-1 flex-shrink-0" />
                    <span className="text-left">{starterPrompt}</span>
                  </Button>
                ))}
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => {
                const fresh: ChatMessage[] = [{ id: Date.now(), role: 'advisor', body: INITIAL_MESSAGE }]
                setMessages(fresh)
                try { localStorage.removeItem(storageKey) } catch {}
              }}
            >
              Clear History
            </Button>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card variant="elevated" className="lg:col-span-3 flex flex-col">
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
            <CardDescription>Chat with your AI Advisor</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col space-y-4">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-[400px] max-h-[600px]">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-md space-y-2">
                    <div
                      className={`px-4 py-2 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-cyan/20 border border-cyan/40 text-cyan'
                          : message.role === 'error'
                            ? 'bg-danger/20 border border-danger/40 text-danger'
                            : 'bg-surface-strong border border-cyan/20 text-text-0'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {message.body}
                      </p>
                    </div>
                    {message.chips && message.chips.length > 0 && (
                      <div className="flex flex-wrap gap-2 pl-1">
                        {message.chips.map((chip) => (
                          <Link
                            key={chip.to}
                            to={chip.to}
                            className="inline-flex items-center rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-xs text-cyan hover:bg-cyan/20 transition"
                          >
                            {chip.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-surface-strong border border-cyan/20 text-text-0 px-4 py-2 rounded-lg flex items-center gap-2">
                    <Loader className="w-4 h-4 animate-spin text-cyan" />
                    <span className="text-sm">Advisor is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask me anything..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                className="flex-1 px-4 py-2 rounded-lg bg-surface-strong border border-cyan/30 text-text-0 placeholder-text-2 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/30 disabled:opacity-50"
              />
              <Button
                onClick={() => void sendPrompt()}
                disabled={isLoading || !prompt.trim()}
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card variant="outline">
        <CardContent className="pt-6">
          <p className="text-sm text-text-2">
            💡 The AI Advisor uses your configured model endpoint to provide recommendations. Responses are based on Discord best practices and community management standards.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
