import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, Check, CheckCheck, ExternalLink, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { formatRelativeDate } from '../lib/format'
import { deleteJson, getJson, postJson } from '../lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface NotificationItem {
  id: number
  type: string
  title: string
  body?: string | null
  link?: string | null
  is_read: boolean
  created_at: string
}

interface NotificationsResponse {
  unread: number
  notifications: NotificationItem[]
}

function notifTypeBadge(type: string) {
  if (type.includes('mod')) return 'danger'
  if (type.includes('ticket')) return 'warning'
  if (type.includes('guild')) return 'info'
  return 'default'
}

function resolveLink(notif: NotificationItem): string | null {
  if (notif.link) return notif.link
  // Auto-derive link from type
  if (notif.type === 'ticket_open' || notif.type === 'ticket_close') {
    const match = notif.title.match(/#(\d+)/)
    if (match) return `/tickets/${match[1]}`
  }
  if (notif.type === 'mod_action') return '/moderation'
  if (notif.type === 'guild_join' || notif.type === 'guild_leave') return '/servers'
  return null
}

export function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery<NotificationsResponse>({
    queryKey: ['notifications', filter],
    queryFn: () => getJson<NotificationsResponse>(`/api/notifications?limit=50`),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  })

  const markAllMutation = useMutation({
    mutationFn: () => postJson('/api/notifications/read-all', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notif-unread-count'] })
    },
  })

  const markOneMutation = useMutation({
    mutationFn: (id: number) => postJson(`/api/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notif-unread-count'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteJson(`/api/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notif-unread-count'] })
    },
  })

  const items = (data?.notifications ?? []).filter(
    (n) => filter === 'all' || !n.is_read
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold text-cyan font-display mb-2">Notifications</h1>
          <p className="text-text-2">
            {data ? `${data.unread} unread of ${data.notifications.length} total` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'unread' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('unread')}
          >
            <BellOff className="w-3.5 h-3.5 mr-1" />
            Unread
            {data && data.unread > 0 && (
              <span className="ml-1.5 bg-cyan/20 text-cyan text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-cyan/30">
                {data.unread}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllMutation.mutate()}
            disabled={!data?.unread || markAllMutation.isPending}
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" />
            Mark all read
          </Button>
        </div>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyan" />
            Activity Feed
          </CardTitle>
          <CardDescription>
            {isLoading
              ? 'Loading notifications…'
              : `${items.length} notification${items.length !== 1 ? 's' : ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError && (
            <div className="text-sm text-danger text-center py-8">
              Could not load notifications. Try refreshing.
            </div>
          )}
          {!isError && !isLoading && items.length === 0 && (
            <div className="text-sm text-text-2 text-center py-8">
              {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
            </div>
          )}
          {items.length > 0 && (
            <div className="divide-y divide-white/5">
              {items.map((notif) => {
                const link = resolveLink(notif)
                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-4 py-4 transition-colors ${
                      !notif.is_read ? 'bg-cyan/5 rounded-lg px-3' : 'px-3'
                    }`}
                  >
                    {/* Unread dot */}
                    <div className="mt-1.5 flex-shrink-0">
                      {!notif.is_read ? (
                        <span className="w-2 h-2 rounded-full bg-cyan block" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-transparent block" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant={notifTypeBadge(notif.type)} size="sm">
                          {notif.type.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs text-text-3">
                          {formatRelativeDate(notif.created_at)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-text-0">{notif.title}</p>
                      {notif.body && (
                        <p className="text-xs text-text-2 mt-0.5 truncate">{notif.body}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {link && (
                        <Link to={link}>
                          <Button variant="ghost" size="sm" title="Go to item">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      )}
                      {!notif.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Mark as read"
                          onClick={() => markOneMutation.mutate(notif.id)}
                          disabled={markOneMutation.isPending}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete notification"
                        onClick={() => deleteMutation.mutate(notif.id)}
                        disabled={deleteMutation.isPending}
                        className="text-text-3 hover:text-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
