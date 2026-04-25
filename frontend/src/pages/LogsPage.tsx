import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Clipboard, ClipboardCheck, Download, FileText, Search } from 'lucide-react'
import { toast } from 'sonner'

import { formatDate } from '../lib/format'
import { getJson } from '../lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface AuditEntry {
  id: number
  action: string
  actor?: string | null
  guild?: string | null
  target_type?: string | null
  target_id?: string | null
  created_at: string
}

interface AuditResponse {
  logs?: AuditEntry[]
  total?: number
}

interface GuildItem {
  id: number
  name: string
}

const PER_PAGE = 50

function getActionBadgeVariant(action: string) {
  if (action.includes('creat') || action.includes('add')) return 'success'
  if (action.includes('delet') || action.includes('remov') || action.includes('ban')) return 'danger'
  if (action.includes('modif') || action.includes('updat') || action.includes('warn')) return 'warning'
  return 'default'
}

function downloadCsv(rows: AuditEntry[]) {
  const headers = ['ID', 'Action', 'Actor', 'Guild', 'Target Type', 'Target ID', 'Date']
  const lines = [
    headers.join(','),
    ...rows.map((e) =>
      [e.id, `"${e.action}"`, `"${e.actor ?? ''}"`, `"${e.guild ?? ''}"`, `"${e.target_type ?? ''}"`, `"${e.target_id ?? ''}"`, `"${e.created_at}"`].join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function LogsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [guildFilter, setGuildFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const guildsQuery = useQuery({
    queryKey: ['guilds-list-logs'],
    queryFn: () => getJson<{ guilds: GuildItem[] }>('/api/guilds'),
    staleTime: 60_000,
    retry: 1,
  })

  const logsQuery = useQuery({
    queryKey: ['audit-log', page, guildFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) })
      if (guildFilter) params.set('guild_id', guildFilter)
      return getJson<AuditResponse | AuditEntry[]>(`/api/audit?${params}`)
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  })

  // Support both array and paginated response shapes
  const rawLogs: AuditEntry[] = Array.isArray(logsQuery.data)
    ? logsQuery.data
    : (logsQuery.data as AuditResponse)?.logs ?? []
  const totalFromApi: number | undefined = Array.isArray(logsQuery.data)
    ? undefined
    : (logsQuery.data as AuditResponse)?.total

  // Derive unique action types for filter dropdown
  const actionTypes = Array.from(new Set(rawLogs.map((e) => e.action))).sort()

  const filteredLogs = rawLogs.filter((entry) => {
    const search = searchTerm.toLowerCase()
    const matchesSearch =
      !search ||
      entry.action.toLowerCase().includes(search) ||
      (entry.actor ?? '').toLowerCase().includes(search) ||
      (entry.guild ?? '').toLowerCase().includes(search)
    const matchesAction = !actionFilter || entry.action === actionFilter
    return matchesSearch && matchesAction
  })

  const totalPages = totalFromApi ? Math.ceil(totalFromApi / PER_PAGE) : undefined

  function copyEntry(entry: AuditEntry) {
    navigator.clipboard.writeText(JSON.stringify(entry, null, 2)).then(() => {
      setCopiedId(entry.id)
      toast.success('Entry copied to clipboard')
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => toast.error('Clipboard unavailable'))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-cyan font-display mb-2">Audit Logs</h1>
          <p className="text-text-2">Administrative action history across all servers</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => filteredLogs.length > 0 && downloadCsv(filteredLogs)}
          disabled={filteredLogs.length === 0}
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card variant="elevated">
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Search action, actor, or guild…"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
              icon={<Search className="w-4 h-4" />}
            />
            <select
              value={guildFilter}
              onChange={(e) => { setGuildFilter(e.target.value); setPage(1) }}
              className="rounded-xl border border-line bg-surface-strong px-3 py-2 text-sm text-text-1 focus:outline-none focus:ring-1 focus:ring-cyan/40"
            >
              <option value="">All servers</option>
              {(guildsQuery.data?.guilds ?? []).map((g) => (
                <option key={g.id} value={String(g.id)}>{g.name}</option>
              ))}
            </select>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
              className="rounded-xl border border-line bg-surface-strong px-3 py-2 text-sm text-text-1 focus:outline-none focus:ring-1 focus:ring-cyan/40"
            >
              <option value="">All action types</option>
              {actionTypes.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Log entries */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            {logsQuery.isLoading
              ? 'Loading logs…'
              : `${filteredLogs.length} entr${filteredLogs.length !== 1 ? 'ies' : 'y'} shown${totalFromApi ? ` (${totalFromApi} total)` : ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsQuery.isError ? (
            <div className="text-sm text-text-2 text-center py-8">
              Audit logs require admin access.
            </div>
          ) : filteredLogs.length === 0 && !logsQuery.isLoading ? (
            <div className="text-sm text-text-2 text-center py-8">
              {searchTerm || actionFilter ? 'No entries match your filters.' : 'No audit logs found.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((entry) => (
                <div
                  key={entry.id}
                  className="group p-4 rounded-lg border border-line hover:border-cyan/20 transition flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-cyan flex-shrink-0" />
                      <Badge variant={getActionBadgeVariant(entry.action)} size="sm">
                        {entry.action}
                      </Badge>
                    </div>
                    <p className="text-sm text-text-1">
                      <span className="font-semibold">Actor:</span> {entry.actor ?? 'system'} ·{' '}
                      <span className="font-semibold">Guild:</span> {entry.guild ?? 'n/a'}
                    </p>
                    <p className="text-xs text-text-2 mt-0.5">
                      Target: {entry.target_type ?? 'n/a'}:{entry.target_id ?? 'n/a'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono text-xs text-text-2">{formatDate(entry.created_at)}</span>
                    <button
                      onClick={() => copyEntry(entry)}
                      className="p-1 rounded-md text-text-3 hover:text-cyan transition opacity-0 group-hover:opacity-100"
                      title="Copy entry JSON"
                    >
                      {copiedId === entry.id
                        ? <ClipboardCheck className="w-4 h-4 text-cyan" />
                        : <Clipboard className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {(totalPages !== undefined && totalPages > 1) || page > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm text-text-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || logsQuery.isLoading}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />Prev
              </Button>
              <span>Page {page}{totalPages ? ` of ${totalPages}` : ''}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={(totalPages !== undefined && page >= totalPages) || rawLogs.length < PER_PAGE || logsQuery.isLoading}
              >
                Next<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
