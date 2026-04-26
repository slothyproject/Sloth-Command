'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MetricCard } from '@/app/components/ui';
import { StatusBadge } from '@/app/components/ui';
import { Timeline, Loading } from '@/app/components/ui';
import type { TimelineEvent } from '@/app/components/ui';
import { cn } from '@/app/lib/utils';

// ── Mock Data ──

const ticketMap: Record<string, { id: string; number: string; subject: string; status: string; priority: string; assignedTo: string; createdAt: string; description: string }> = {
  '1': { id: '1', number: 'TKT-001', subject: 'Login issue with Discord OAuth', status: 'open', priority: 'high', assignedTo: 'Alice', createdAt: '2026-04-25T10:00:00Z', description: 'Users are unable to log in via Discord OAuth. The redirect URL seems to be misconfigured after the recent deployment.' },
  '2': { id: '2', number: 'TKT-002', subject: 'API rate limiting too aggressive', status: 'in_progress', priority: 'medium', assignedTo: 'Bob', createdAt: '2026-04-24T14:30:00Z', description: 'Clients are being rate-limited at 100 req/min despite having a pro plan that promises 1000 req/min.' },
  '3': { id: '3', number: 'TKT-003', subject: 'Dashboard not loading on mobile', status: 'resolved', priority: 'low', assignedTo: 'Charlie', createdAt: '2026-04-23T09:15:00Z', description: 'The dashboard layout breaks on viewports narrower than 375px.' },
  '4': { id: '4', number: 'TKT-004', subject: 'Database connection timeout', status: 'open', priority: 'urgent', assignedTo: 'Unassigned', createdAt: '2026-04-25T08:00:00Z', description: 'Production database connections are timing out intermittently. Connection pool exhausted.' },
  '5': { id: '5', number: 'TKT-005', subject: 'Webhook failing intermittently', status: 'in_progress', priority: 'high', assignedTo: 'Alice', createdAt: '2026-04-22T11:20:00Z', description: 'Outgoing webhooks are returning 500 errors roughly 30% of the time.' },
  '6': { id: '6', number: 'TKT-006', subject: 'Update branding colors', status: 'closed', priority: 'low', assignedTo: 'Bob', createdAt: '2026-04-20T16:45:00Z', description: 'Replace deprecated purple accents with cyan/lime palette per brand guidelines.' },
};

const timelineEvents: TimelineEvent[] = [
  { id: 'e1', timestamp: '2026-04-25T10:00:00Z', title: 'Ticket Created', description: 'Alice created the ticket', status: 'open', color: 'cyan' },
  { id: 'e2', timestamp: '2026-04-25T10:30:00Z', title: 'Assigned to Alice', description: 'Bob assigned the ticket to Alice', status: 'info', color: 'violet' },
  { id: 'e3', timestamp: '2026-04-25T12:00:00Z', title: 'Comment added', description: 'Investigating OAuth redirect URL configuration.', color: 'slate' },
  { id: 'e4', timestamp: '2026-04-25T14:00:00Z', title: 'Status updated', description: 'Marked as in progress', status: 'running', color: 'green' },
];

// ── Loading helper ──
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

// ── Page ──

export default function TicketDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const ticket = ticketMap[id];
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<TimelineEvent[]>([...timelineEvents]);

  if (!ticket) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/tickets" className="text-cyan-400 hover:text-cyan-300 text-sm inline-flex items-center gap-2">
          ← Back to Tickets
        </Link>
        <div className="glass-card p-12 text-center">
          <p className="text-slate-400">Ticket not found</p>
        </div>
      </div>
    );
  }

  const addComment = () => {
    if (!comment.trim()) return;
    setComments((prev) => [
      ...prev,
      {
        id: `e-${Date.now()}`,
        timestamp: new Date().toISOString(),
        title: 'Comment added',
        description: comment.trim(),
        color: 'slate',
      },
    ]);
    setComment('');
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/tickets" className="text-cyan-400 hover:text-cyan-300 text-sm inline-flex items-center gap-2 transition-colors">
          ← Back to Tickets
        </Link>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-white">
            {ticket.number} — {ticket.subject}
          </h1>
          <StatusBadge
            status={ticket.status === 'in_progress' ? 'running' : (ticket.status as 'open' | 'resolved' | 'completed')}
            size="sm"
          />
          <span
            className={cn(
              'text-xs font-semibold',
              ticket.priority === 'urgent' && 'text-red-400',
              ticket.priority === 'high' && 'text-orange-400',
              ticket.priority === 'medium' && 'text-yellow-400',
              ticket.priority === 'low' && 'text-slate-400'
            )}
          >
            {ticket.priority.toUpperCase()}
          </span>
        </div>
        <p className="text-slate-400 mt-2 text-sm">Created on {new Date(ticket.createdAt).toLocaleString()}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Status" value={ticket.status.replace('_', ' ')} color="cyan" size="sm" />
        <MetricCard title="Priority" value={ticket.priority} color="yellow" size="sm" />
        <MetricCard title="Assigned To" value={ticket.assignedTo} color="violet" size="sm" />
        <MetricCard title="Created" value={new Date(ticket.createdAt).toLocaleDateString()} color="slate" size="sm" />
      </div>

      {/* Description */}
      <DetailSection title="Description">
        <p className="text-slate-300 leading-relaxed">{ticket.description}</p>
        <div className="flex gap-3 pt-2">
          <button className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-sm hover:bg-cyan-500/30 transition-colors">Assign</button>
          <button className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 text-sm hover:bg-white/10 transition-colors">Change Status</button>
          <button className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 text-sm hover:bg-white/10 transition-colors">Change Priority</button>
        </div>
      </DetailSection>

      {/* Timeline */}
      <DetailSection title="Activity Timeline">
        <Timeline events={comments} groupByDate showTimeMarkers />
      </DetailSection>

      {/* Comment Input */}
      <div className="glass-card p-6 space-y-3">
        <h3 className="text-lg font-semibold text-white">Add Comment</h3>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Write a comment..."
          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 text-sm min-h-[80px]"
        />
        <div className="flex justify-end">
          <button
            onClick={addComment}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium text-white transition-all',
              'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500',
              'shadow-lg shadow-cyan-500/25'
            )}
          >
            Post Comment
          </button>
        </div>
      </div>
    </div>
  );
}
