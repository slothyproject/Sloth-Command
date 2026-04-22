import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ServersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cyan">Servers</h1>
        <p className="text-text-2 mt-2">Coming soon: Server management interface</p>
      </div>
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Server List</CardTitle>
          <CardDescription>Server management coming in Phase 2</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-text-2">Placeholder for servers list with DataTable component</p>
        </CardContent>
      </Card>
    </div>
  )
}
