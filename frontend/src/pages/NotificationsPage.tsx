import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, Check, CheckCheck, ExternalLink, Settings, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { formatRelativeDate } from '../lib/format'
import { deleteJson, getJson, patchJson, postJson } from '../lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Toggle } from '@/components/ui/toggle'

interface NotificationPrefs {
  notify_ticket_open: boolean
  notify_ticket_close: boolean
  notify_mod_action: boolean
  notify_guild_join: boolean
  notify_guild_leave: boolean
  notify_bot_offline: boolean
  mute_all: boolean
}

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
  const [tab, setTab] = useState<'feed' | 'preferences'>('feed')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const queryClient = useQueryClient()

  const prefsQuery = useQuery<NotificationPrefs>({
    queryKey: ['notification-prefs'],
    queryFn: () => getJson<NotificationPrefs>('/api/notifications/preferences'),
    staleTime: 60_000,
  })

  const prefsMutation = useMutation({
    mutationFn: (patch: Partial<NotificationPrefs>) => patchJson('/api/notifications/preferences', patch),
    onSuccess: (res) => {
      queryClient.setQueryData(['notification-prefs'], (res as { prefs: NotificationPrefs }).prefs)
      toast.success('Preferences saved')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save preferences'),
  })

  function togglePref(key: keyof NotificationPrefs) {
    if (!prefsQuery.data) return
    prefsMutation.mutate({ [key]: !prefsQuery.data[key] })
  }

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
          {/* Tab switcher */}
          <div className="flex rounded-xl overflow-hidden border border-white/10 text-sm">
            <button
              onClick={() => setTab('feed')}
              className={`px-4 py-2 flex items-center gap-1.5 transition-colors ${
                tab === 'feed' ? 'bg-cyan text-void font-semibold' : 'text-text-2 hover:bg-white/5'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              Feed
            </button>
            <button
              onClick={() => setTab('preferences')}
              className={`px-4 py-2 flex items-center gap-1.5 transition-colors ${
                tab === 'preferences' ? 'bg-cyan text-void font-semibold' : 'text-text-2 hover:bg-white/5'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Preferences
            </button>
          </div>
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

      {tab === 'feed' && (
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
      )}

      {tab === 'preferences' && (
        <div className="dashboard-chrome rounded-[1.6rem] divide-y divide-white/5">
          {prefsQuery.isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-cyan/40 border-t-cyan rounded-full animate-spin" />
            </div>
          )}
          {prefsQuery.data && (() => {
            const p = prefsQuery.data
            const rows: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
              { key: 'mute_all', label: 'Mute all notifications', desc: 'Suppress all in-app notifications.' },
              { key: 'notify_ticket_open', label: 'Ticket opened', desc: 'Notify when a new support ticket is created.' },
              { key: 'notify_ticket_close', label: 'Ticket closed', desc: 'Notify when a ticket is resolved or closed.' },
              { key: 'notify_mod_action', label: 'Moderation action', desc: 'Notify on bans, kicks, mutes, and warns.' },
              { key: 'notify_guild_join', label: 'Server joined', desc: 'Notify when the bot joins a new server.' },
              { key: 'notify_guild_leave', label: 'Server left', desc: 'Notify when the bot leaves a server.' },
              { key: 'notify_bot_offline', label: 'Bot offline', desc: 'Notify when the bot goes offline.' },
            ]
            return rows.map(({ key, label, desc }) => (
              <div key={key} className="p-5 flex items-center justify-between gap-6">
                <div>
                  <p className={`text-sm font-medium ${key === 'mute_all' ? 'text-red-300' : 'text-text-0'}`}>{label}</p>
                  <p className="text-xs text-text-3 mt-0.5">{desc}</p>
                </div>
                <Toggle
                  value={p[key]}
                  onChange={() => togglePref(key)}
                  disabled={prefsMutation.isPending}
                />
              </div>
            ))
          })()}
        </div>
      )}
    </div>
  )
}
