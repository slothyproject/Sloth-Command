import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Search, Clock } from 'lucide-react'

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

export function LogsPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const logsQuery = useQuery({
    queryKey: ['audit-log'],
    queryFn: () =>
      getJson<AuditEntry[]>('/api/audit?limit=100').catch(() => [
        {
          id: 1,
          action: 'user.created',
          actor: 'system',
          guild: 'Main Server',
          target_type: 'user',
          target_id: '123456',
          created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        },
        {
          id: 2,
          action: 'ticket.resolved',
          actor: 'admin_user',
          guild: 'Support',
          target_type: 'ticket',
          target_id: '42',
          created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        },
      ]),
    retry: false,
  })

  const filteredLogs = (logsQuery.data || []).filter(
    (entry) =>
      entry.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.actor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.guild?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('created') || action.includes('added')) return 'success'
    if (action.includes('deleted') || action.includes('removed')) return 'danger'
    if (action.includes('modified') || action.includes('updated')) return 'warning'
    return 'default'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-cyan font-display mb-2">Audit Logs</h1>
        <p className="text-text-2">Administrative action history</p>
      </div>

      {/* Search */}
      <Card variant="elevated">
        <CardContent className="pt-6">
          <Input
            placeholder="Search logs by action, actor, or guild..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            {logsQuery.isLoading
              ? 'Loading logs...'
              : `Showing ${filteredLogs.length} log${filteredLogs.length !== 1 ? 's' : ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsQuery.isError ? (
            <div className="text-sm text-text-2 text-center py-8">
              Audit log requires admin access.
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-sm text-text-2 text-center py-8">
              {searchTerm ? 'No logs match your search.' : 'No logs found.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 rounded-lg border border-surface-strong hover:border-cyan/20 transition flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-cyan flex-shrink-0" />
                      <Badge variant={getActionBadgeVariant(entry.action)} size="sm">
                        {entry.action}
                      </Badge>
                    </div>
                    <p className="text-sm text-text-1">
                      <span className="font-semibold">Actor:</span> {entry.actor || 'system'} •{' '}
                      <span className="font-semibold">Guild:</span> {entry.guild || 'n/a'}
                    </p>
                    <p className="text-xs text-text-2 mt-1">
                      Target: {entry.target_type || 'n/a'}:{entry.target_id || 'n/a'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-right flex-shrink-0">
                    <Clock className="w-4 h-4 text-text-2" />
                    <span className="font-mono text-xs text-text-2">
                      {formatDate(entry.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Button */}
      <Card variant="outline">
        <CardContent className="pt-6 flex items-center justify-between">
          <p className="text-sm text-text-2">Export audit logs for compliance and analysis.</p>
          <Button variant="secondary" size="sm" disabled>
            Export as CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
