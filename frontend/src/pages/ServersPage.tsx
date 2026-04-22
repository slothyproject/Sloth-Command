import React, { useState, useEffect } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Users, Settings } from 'lucide-react'

interface Server {
  id: string
  name: string
  members: number
  owner: string
  created: string
  status: 'active' | 'inactive' | 'maintenance'
}

export function ServersPage() {
  const [servers, setServers] = useState<Server[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const response = await fetch('/api/guilds')
        const data = await response.json()
        setServers(Array.isArray(data) ? data : [
          {
            id: '1',
            name: 'Main Server',
            members: 1250,
            owner: 'Admin',
            created: '2023-01-15',
            status: 'active' as const,
          },
          {
            id: '2',
            name: 'Community Hub',
            members: 850,
            owner: 'Moderator',
            created: '2023-06-20',
            status: 'active' as const,
          },
          {
            id: '3',
            name: 'Dev Testing',
            members: 42,
            owner: 'Dev',
            created: '2024-01-10',
            status: 'maintenance' as const,
          },
        ])
      } catch (error) {
        console.error('Failed to fetch servers:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchServers()
  }, [])

  const columns: ColumnDef<Server>[] = [
    {
      accessorKey: 'name',
      header: 'Server Name',
      cell: ({ row }) => (
        <div className=" font-semibold text-cyan\>{row.getValue('name')}</div>
 ),
 },
 {
 accessorKey: 'members',
 header: 'Members',
 cell: ({ row }) => (
 <div className=\flex items-center gap-2\>
 <Users className=\w-4 h-4 text-lime\ />
 {row.getValue('members')}
 </div>
 ),
 },
 {
 accessorKey: 'owner',
 header: 'Owner',
 cell: ({ row }) => <div>{row.getValue('owner')}</div>,
 },
 {
 accessorKey: 'created',
 header: 'Created',
 cell: ({ row }) => (
 <div className=\text-sm text-text-2\>
 {new Date(row.getValue('created') as string).toLocaleDateString()}
 </div>
 ),
 },
 {
 accessorKey: 'status',
 header: 'Status',
 cell: ({ row }) => {
 const status = row.getValue('status') as string
 return (
 <Badge
 variant={
 status === 'active' ? 'success' : status === 'maintenance' ? 'warning' : 'danger'
 }
 size=\sm\
 >
 {status.charAt(0).toUpperCase() + status.slice(1)}
 </Badge>
 )
 },
 },
 ]

 const filteredServers = servers.filter((server) =>
 server.name.toLowerCase().includes(searchTerm.toLowerCase())
 )

 return (
 <div className=\space-y-8\>
 <div>
 <h1 className=\text-4xl font-bold text-cyan font-display mb-2\>Servers</h1>
 <p className=\text-text-2\>Manage all connected Discord servers</p>
 </div>

 <Card variant=\elevated\>
 <CardContent className=\pt-6\>
 <Input
 placeholder=\Search servers...\
 icon={<Search className=\w-4 h-4\ />}
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </CardContent>
 </Card>

 <div className=\grid grid-cols-1 md:grid-cols-3 gap-6\>
 <Card variant=\outline\ className=\text-center\>
 <CardContent className=\pt-6\>
 <div className=\text-3xl font-bold text-cyan\>{servers.length}</div>
 <p className=\text-sm text-text-2 mt-2\>Total Servers</p>
 </CardContent>
 </Card>
 <Card variant=\outline\ className=\text-center\>
 <CardContent className=\pt-6\>
 <div className=\text-3xl font-bold text-lime\>
 {servers.reduce((sum, s) => sum + s.members, 0).toLocaleString()}
 </div>
 <p className=\text-sm text-text-2 mt-2\>Total Members</p>
 </CardContent>
 </Card>
 <Card variant=\outline\ className=\text-center\>
 <CardContent className=\pt-6\>
 <div className=\text-3xl font-bold text-amber\>
 {servers.filter((s) => s.status === 'active').length}
 </div>
 <p className=\text-sm text-text-2 mt-2\>Active Servers</p>
 </CardContent>
 </Card>
 </div>

 <Card variant=\elevated\>
 <CardHeader>
 <CardTitle>All Servers</CardTitle>
 <CardDescription>List of all connected Discord servers</CardDescription>
 </CardHeader>
 <CardContent>
 <DataTable columns={columns} data={filteredServers} isLoading={isLoading} />
 </CardContent>
 </Card>
 </div>
 )
}
