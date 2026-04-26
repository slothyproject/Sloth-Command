import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, UserCheck, Clock, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { formatDate } from '../lib/format'
import { getJson, patchJson, deleteJson } from '../lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'
import { Input } from '@/components/ui/input'

interface UserRecord {
  id: number
  username: string
  discord_id?: string | null
  is_owner?: boolean
  is_admin: boolean
  is_active: boolean
  created_at: string
  last_login?: string | null
}

export function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const usersQuery = useQuery({
    queryKey: ['users-admin'],
    queryFn: () => getJson<UserRecord[]>('/api/users'),
    retry: false,
  })

  const filteredUsers = (usersQuery.data || []).filter((user) =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.discord_id?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalUsers = usersQuery.data?.length || 0
  const activeUsers = usersQuery.data?.filter((u) => u.is_active).length || 0
  const adminUsers = usersQuery.data?.filter((u) => u.is_admin || u.is_owner).length || 0

  async function toggleAdmin(user: UserRecord) {
    try {
      await patchJson(`/api/users/${user.id}`, { is_admin: !user.is_admin })
      await usersQuery.refetch()
      toast.success(user.is_admin ? `Removed admin from ${user.username}` : `Granted admin to ${user.username}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to toggle admin')
    }
  }

  async function toggleActive(user: UserRecord) {
    try {
      await patchJson(`/api/users/${user.id}`, { is_active: !user.is_active })
      await usersQuery.refetch()
      toast.success(user.is_active ? `Disabled ${user.username}` : `Enabled ${user.username}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to toggle active status')
    }
  }

  async function deleteUser(user: UserRecord) {
    if (!window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) return
    try {
      await deleteJson(`/api/users/${user.id}`)
      await usersQuery.refetch()
      toast.success(`Deleted user ${user.username}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete user')
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-cyan font-display mb-2">User Management</h1>
        <p className="text-text-2">Manage user roles and access permissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={<Users className="w-5 h-5 text-cyan" />}
          label="Total Users"
          value={totalUsers}
          size="md"
        />
        <StatCard
          icon={<UserCheck className="w-5 h-5 text-lime" />}
          label="Active"
          value={activeUsers}
          size="md"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-amber" />}
          label="Administrators"
          value={adminUsers}
          size="md"
        />
      </div>

      {/* Search */}
      <Card variant="elevated">
        <CardContent className="pt-6">
          <Input
            placeholder="Search by username or Discord ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Users className="w-4 h-4" />}
          />
        </CardContent>
      </Card>

      {/* Users List */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {usersQuery.isLoading ? 'Loading users...' : `Showing ${filteredUsers.length} user${filteredUsers.length !== 1 ? 's' : ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersQuery.isError ? (
            <div className="text-sm text-text-2 text-center py-8">
              User management requires admin access.
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-sm text-text-2 text-center py-8">
              {searchTerm ? 'No users match your search.' : 'No users found.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-4 rounded-lg border border-line hover:border-cyan/20 transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <img
                      src={
                        user.discord_id
                          ? `https://cdn.discordapp.com/embed/avatars/${Number(user.discord_id) % 5}.png`
                          : '/sloth-lee-logo.png'
                      }
                      alt={user.username}
                      className="h-9 w-9 rounded-full border border-line bg-white/10 object-cover flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-text-0 truncate">{user.username}</p>
                      <p className="text-xs text-text-2 mt-0.5">
                        {user.discord_id ? `Discord #${user.discord_id} · ` : ''}Created {formatDate(user.created_at)}{' '}
                        {user.last_login ? `· Last seen ${formatDate(user.last_login)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={user.is_owner ? 'warning' : user.is_admin ? 'default' : 'info'} size="sm">
                      {user.is_owner ? 'Owner' : user.is_admin ? 'Admin' : 'User'}
                    </Badge>
                    <Badge
                      variant={user.is_active ? 'success' : 'danger'}
                      size="sm"
                    >
                      {user.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void toggleAdmin(user)}
                      disabled={user.is_owner}
                    >
                      {user.is_owner ? 'Owner Locked' : user.is_admin ? 'Remove Admin' : 'Make Admin'}
                    </Button>
                    <Button
                      variant={user.is_owner ? 'secondary' : user.is_active ? 'danger' : 'secondary'}
                      size="sm"
                      onClick={() => void toggleActive(user)}
                      disabled={user.is_owner}
                    >
                      {user.is_owner ? 'Owner Locked' : user.is_active ? 'Disable' : 'Enable'}
                    </Button>
                    {!user.is_owner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void deleteUser(user)}
                        title="Delete user"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
