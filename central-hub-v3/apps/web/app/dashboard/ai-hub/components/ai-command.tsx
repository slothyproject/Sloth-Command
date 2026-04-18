/**
 * AI Command Component
 * Natural language interface for managing services
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { cn, formatTimeAgo } from '@/app/lib/utils';
import { useAIChat } from '@/app/hooks/use-ai';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: string[];
}

const quickCommands = [
  { label: 'Show service status', command: 'status' },
  { label: 'Deploy all services', command: 'deploy all' },
  { label: 'Fix Discord Bot', command: 'fix bot' },
  { label: 'Show recommendations', command: 'recommendations' },
  { label: 'Scale API Backend', command: 'scale api' },
  { label: 'Check costs', command: 'costs' },
];

export function AICommand() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. I can help you manage your services, deploy code, check status, and provide recommendations. What would you like to do?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMutation = useAIChat();

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Simulate AI response (in real app, this would call the API)
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getAIResponse(input),
        timestamp: new Date(),
        actions: getAIActions(input),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 500);
  };

  const getAIResponse = (command: string): string => {
    const lower = command.toLowerCase();
    if (lower.includes('status')) {
      return '3 out of 4 services are healthy. Discord Bot is currently degraded with high CPU usage (78%).';
    }
    if (lower.includes('deploy')) {
      return 'I\'ll deploy all services. This will trigger new deployments for Website, API Backend, Discord Bot, and Token Vault. Continue?';
    }
    if (lower.includes('fix')) {
      return 'I\'ve identified the issue with Discord Bot. High CPU is caused by inefficient message processing. Would you like me to restart the service with optimized settings?';
    }
    if (lower.includes('recommend')) {
      return 'Based on current metrics, I have 4 recommendations: 1) Scale Discord Bot, 2) Enable Redis caching, 3) Update SSL certificate, 4) Optimize database queries.';
    }
    if (lower.includes('cost')) {
      return 'Your current monthly cost is approximately $245. I\'ve identified potential savings of $73/month by optimizing instance sizes.';
    }
    return 'I understand. I can help you with that. What specific action would you like me to take?';
  };

  const getAIActions = (command: string): string[] | undefined => {
    const lower = command.toLowerCase();
    if (lower.includes('deploy')) {
      return ['Confirm Deployment', 'Cancel'];
    }
    if (lower.includes('fix')) {
      return ['Restart with Optimizations', 'View Details', 'Cancel'];
    }
    if (lower.includes('recommend')) {
      return ['View All Recommendations', 'Apply All'];
    }
    return undefined;
  };

  const handleQuickCommand = (command: string) => {
    setInput(command);
  };

  return (
    <div className="flex flex-col h-[600px] glass-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Assistant</h3>
            <p className="text-xs text-slate-400">Powered by Ollama Cloud</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-slate-400">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3",
              message.role === 'user' ? "flex-row-reverse" : ""
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                message.role === 'assistant'
                  ? "bg-gradient-to-br from-violet-500 to-cyan-500"
                  : "bg-slate-700"
              )}
            >
              {message.role === 'assistant' ? (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ) : (
                <span className="text-xs font-medium text-white">You</span>
              )}
            </div>
            
            <div className={cn(
              "flex-1 max-w-[80%]",
              message.role === 'user' ? "text-right" : ""
            )}>
              <div
                className={cn(
                  "inline-block p-3 rounded-lg text-sm",
                  message.role === 'assistant'
                    ? "bg-white/10 text-white text-left"
                    : "bg-cyan-500/20 text-cyan-100 text-left"
                )}
              >
                {message.content}
              </div>
              
              <p className="text-xs text-slate-500 mt-1">
                {formatTimeAgo(message.timestamp.toISOString())}
              </p>
              
              {/* Action Buttons */}
              {message.actions && message.actions.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {message.actions.map((action) => (
                    <button
                      key={action}
                      className={cn(
                        "px-3 py-1.5 rounded text-sm transition-colors",
                        action === 'Cancel'
                          ? "bg-white/5 text-slate-400 hover:bg-white/10"
                          : "bg-violet-500/20 text-violet-400 hover:bg-violet-500/30"
                      )}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Commands */}
      <div className="px-4 py-2 border-t border-white/10">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {quickCommands.map((cmd) => (
            <button
              key={cmd.label}
              onClick={() => handleQuickCommand(cmd.command)}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 text-sm whitespace-nowrap hover:bg-white/10 hover:text-white transition-colors"
            >
              {cmd.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a command or ask a question..."
            className="flex-1 px-4 py-3 rounded-lg input-glass text-white placeholder-slate-500 focus:outline-none"
          />
          
          <button
            type="submit"
            disabled={!input.trim() || chatMutation.isPending}
            className={cn(
              "px-4 py-3 rounded-lg bg-violet-500 text-white transition-colors",
              (!input.trim() || chatMutation.isPending) && "opacity-50 cursor-not-allowed"
            )}
          >
            {chatMutation.isPending ? (
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
