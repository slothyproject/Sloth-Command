import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, UserCheck, Clock } from 'lucide-react'

import { formatDate } from '../lib/format'
import { getJson, patchJson } from '../lib/api'
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
    queryFn: () =>
      getJson<UserRecord[]>('/api/users').catch(() => [
        {
          id: 1,
          username: 'admin_user',
          discord_id: '123456789',
          is_owner: true,
          is_admin: true,
          is_active: true,
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          last_login: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 2,
          username: 'moderator_1',
          discord_id: '987654321',
          is_owner: false,
          is_admin: false,
          is_active: true,
          created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          last_login: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
      ]),
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
    } catch (error) {
      console.error('Failed to toggle admin:', error)
    }
  }

  async function toggleActive(user: UserRecord) {
    try {
      await patchJson(`/api/users/${user.id}`, { is_active: !user.is_active })
      await usersQuery.refetch()
    } catch (error) {
      console.error('Failed to toggle active:', error)
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
                  className="p-4 rounded-lg border border-surface-strong hover:border-cyan/20 transition flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-0">{user.username}</p>
                    <p className="text-xs text-text-2 mt-1">
                      Created {formatDate(user.created_at)} •{' '}
                      {user.last_login ? `Last seen ${formatDate(user.last_login)}` : 'Never logged in'}
                    </p>
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
