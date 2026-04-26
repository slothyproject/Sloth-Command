'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTicket, useAddTicketComment } from '@/app/hooks/use-tickets';
import { MetricCard } from '@/app/components/ui';
import { StatusBadge } from '@/app/components/ui';
import { Timeline, Loading } from '@/app/components/ui';
import { SectionError } from '@/app/components/ui';
import type { TimelineEvent } from '@/app/components/ui';
import { cn } from '@/app/lib/utils';

const defaultTimelineEvents: TimelineEvent[] = [
  { id: 'e1', timestamp: '2026-04-25T10:00:00Z', title: 'Ticket Created', description: 'Ticket was created', status: 'open', color: 'cyan' },
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
  const { data: ticket, isLoading, isError, refetch } = useTicket(id);
  const addComment = useAddTicketComment();
  const [comment, setComment] = useState('');
  const [localComments, setLocalComments] = useState<TimelineEvent[]>([...defaultTimelineEvents]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/tickets" className="text-cyan-400 hover:text-cyan-300 text-sm inline-flex items-center gap-2">
          ← Back to Tickets
        </Link>
        <Loading.Page statsCount={4} />
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/tickets" className="text-cyan-400 hover:text-cyan-300 text-sm inline-flex items-center gap-2">
          ← Back to Tickets
        </Link>
        <SectionError
          title="Failed to load ticket"
          message="There was an error loading the ticket details. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const timeline: TimelineEvent[] = [
    ...localComments,
    ...(ticket.comments ?? []).map((c) => ({
      id: `c-${c.id}`,
      timestamp: c.createdAt,
      title: `Comment by ${c.author}`,
      description: c.content,
      color: 'slate',
    })),
  ];

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setLocalComments((prev) => [
      ...prev,
      {
        id: `e-${Date.now()}`,
        timestamp: new Date().toISOString(),
        title: 'Comment added',
        description: comment.trim(),
        color: 'slate',
      } as TimelineEvent,
    ]);
    await addComment.mutateAsync({ id, content: comment.trim() });
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
            status={ticket.status === 'in_progress' ? 'running' : (ticket.status as 'open' | 'resolved' | 'closed')}
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
        <p className="text-slate-300 leading-relaxed">{ticket.description ?? 'No description provided.'}</p>
        <div className="flex gap-3 pt-2">
          <button className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-sm hover:bg-cyan-500/30 transition-colors">Assign</button>
          <button className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 text-sm hover:bg-white/10 transition-colors">Change Status</button>
          <button className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 text-sm hover:bg-white/10 transition-colors">Change Priority</button>
        </div>
      </DetailSection>

      {/* Timeline */}
      <DetailSection title="Activity Timeline">
        <Timeline events={timeline} groupByDate showTimeMarkers />
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
            onClick={handleAddComment}
            disabled={addComment.isPending}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium text-white transition-all',
              'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500',
              'shadow-lg shadow-cyan-500/25 disabled:opacity-50'
            )}
          >
            {addComment.isPending ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </div>
    </div>
  );
}
