/**
 * AI Command Component
 * Natural language interface for managing services - with real API integration
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/app/lib/utils';
import { useAIChat, useProcessAgentRequest } from '@/app/hooks/use-ai';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: string[];
  isProcessing?: boolean;
}

const quickCommands = [
  { label: 'Show service status', command: 'Show me the status of all my services' },
  { label: 'Deploy all services', command: 'Deploy all services' },
  { label: 'Scale Discord Bot', command: 'Scale up the Discord Bot service' },
  { label: 'Check for issues', command: 'Are there any issues with my services?' },
  { label: 'View recommendations', command: 'Show me AI recommendations' },
  { label: 'Check costs', command: 'What are my current infrastructure costs?' },
];

export function AICommand() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm your AI assistant powered by Central Hub. I can help you manage services, deploy code, check status, and provide recommendations. What would you like to do?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMutation = useAIChat();
  const agentMutation = useProcessAgentRequest();

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending || agentMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Add processing message
    const processingId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, {
      id: processingId,
      role: 'system',
      content: 'AI is processing your request...',
      timestamp: new Date(),
      isProcessing: true,
    }]);

    try {
      // First try to process as agent request for complex operations
      const agentResponse = await agentMutation.mutateAsync({
        request: input,
        context: { source: 'ai_command' },
      });

      // Remove processing message
      setMessages((prev) => prev.filter(m => m.id !== processingId));

      if (agentResponse.plan) {
        // Agent created a plan
        const aiResponse: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `I've created a plan to handle your request: "${agentResponse.plan.goal}"\n\nThis plan has ${agentResponse.plan.steps?.length || 0} steps and will ${agentResponse.plan.requiresApproval ? 'require your approval' : 'execute automatically'}.`,
          timestamp: new Date(),
          actions: agentResponse.plan.requiresApproval 
            ? ['View Plan', 'Approve & Execute', 'Cancel']
            : ['View Plan', 'Execute Now', 'Cancel'],
        };
        setMessages((prev) => [...prev, aiResponse]);
      } else if (agentResponse.response) {
        // Direct response from agent
        const aiResponse: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: agentResponse.response,
          timestamp: new Date(),
          actions: agentResponse.suggestedActions,
        };
        setMessages((prev) => [...prev, aiResponse]);
      } else {
        // Fallback to simple chat
        await handleSimpleChat(input, processingId);
      }
    } catch (error) {
      // Remove processing message and show error
      setMessages((prev) => prev.filter(m => m.id !== processingId));
      
      const errorResponse: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: error instanceof Error 
          ? `Sorry, I encountered an error: ${error.message}`
          : 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorResponse]);
    }
  };

  const handleSimpleChat = async (message: string, processingId: string) => {
    try {
      const response = await chatMutation.mutateAsync(message);
      
      // Remove processing message
      setMessages((prev) => prev.filter(m => m.id !== processingId));
      
      const aiResponse: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        actions: response.suggestions,
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      // Remove processing message
      setMessages((prev) => prev.filter(m => m.id !== processingId));
      
      const errorResponse: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorResponse]);
    }
  };

  const handleQuickCommand = (command: string) => {
    setInput(command);
  };

  const handleAction = (action: string, messageId: string) => {
    // Handle action button clicks
    if (action.toLowerCase().includes('cancel')) {
      // Remove the action buttons
      setMessages((prev) => 
        prev.map(m => m.id === messageId ? { ...m, actions: undefined } : m)
      );
      return;
    }

    // For other actions, send as follow-up
    const followUpMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: action,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, followUpMessage]);
    
    // Process the action
    handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const isProcessing = chatMutation.isPending || agentMutation.isPending;

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
            <h3 className="font-semibold text-white">AI Command Center</h3>
            <p className="text-xs text-slate-400">Powered by Agentic AI</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            isProcessing ? "bg-yellow-400" : "bg-green-400"
          )} />
          <span className="text-sm text-slate-400">
            {isProcessing ? 'Processing...' : 'Online'}
          </span>
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
                  : message.role === 'system'
                  ? "bg-yellow-500/20"
                  : "bg-slate-700"
              )}
            >
              {message.role === 'assistant' ? (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ) : message.role === 'system' ? (
                <svg className="w-4 h-4 text-yellow-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
                    : message.role === 'system'
                    ? "bg-yellow-500/10 text-yellow-200 text-left italic"
                    : "bg-cyan-500/20 text-cyan-100 text-left"
                )}
              >
                {message.content}
              </div>
              
              <p className="text-xs text-slate-500 mt-1">
                {formatTimeAgo(message.timestamp)}
              </p>
              
              {/* Action Buttons */}
              {message.actions && message.actions.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {message.actions.map((action) => (
                    <button
                      key={action}
                      onClick={() => handleAction(action, message.id)}
                      className={cn(
                        "px-3 py-1.5 rounded text-sm transition-colors",
                        action.toLowerCase().includes('cancel')
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
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 text-sm whitespace-nowrap hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
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
            disabled={isProcessing}
            className="flex-1 px-4 py-3 rounded-lg bg-slate-900/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 disabled:opacity-50"
          />
          
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className={cn(
              "px-4 py-3 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-white transition-all",
              (!input.trim() || isProcessing) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isProcessing ? (
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
