/**
 * Notification/Toast System
 * Toast notifications with queue management
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { cn } from '@/app/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  toast: {
    success: (title: string, message?: string) => string;
    error: (title: string, message?: string) => string;
    warning: (title: string, message?: string) => string;
    info: (title: string, message?: string) => string;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Toast Provider
interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
  position?: 'top-left' | 'top-right' | 'top-center' | 'bottom-left' | 'bottom-right' | 'bottom-center';
}

export function ToastProvider({ 
  children, 
  maxToasts = 5,
  position = 'bottom-right',
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${++idCounter.current}`;
    const newToast: Toast = { ...toast, id };

    setToasts((prev) => {
      // Remove oldest if at max
      const updated = [...prev, newToast];
      if (updated.length > maxToasts) {
        return updated.slice(-maxToasts);
      }
      return updated;
    });

    // Auto-remove after duration
    if (toast.duration !== 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 5000);
    }

    return id;
  }, [maxToasts]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((title: string, message?: string) => {
    return addToast({ type: 'success', title, message });
  }, [addToast]);

  const error = useCallback((title: string, message?: string) => {
    return addToast({ type: 'error', title, message, duration: 8000 });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    return addToast({ type: 'warning', title, message, duration: 6000 });
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    return addToast({ type: 'info', title, message });
  }, [addToast]);

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    toast: {
      success,
      error,
      warning,
      info,
    },
  };

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={cn('fixed z-50 flex flex-col gap-2 w-full max-w-sm', positionClasses[position])}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Toast Item Component
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const icons: Record<ToastType, React.ReactNode> = {
    success: (
      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const borderColors: Record<ToastType, string> = {
    success: 'border-green-500/30',
    error: 'border-red-500/30',
    warning: 'border-yellow-500/30',
    info: 'border-cyan-500/30',
  };

  return (
    <div
      className={cn(
        'glass-card p-4 flex gap-3 border',
        borderColors[toast.type],
        'animate-in slide-in-from-right duration-300'
      )}
      role="alert"
    >
      <div className="shrink-0">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-white">{toast.title}</h4>
        {toast.message && <p className="text-sm text-slate-400 mt-1">{toast.message}</p>}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              onRemove(toast.id);
            }}
            className="mt-2 text-sm text-cyan-400 hover:text-cyan-300"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 text-slate-400 hover:text-white"
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// Hook to use toast
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Notification Center Component
interface Notification {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClear: (id: string) => void;
  onClearAll: () => void;
  className?: string;
}

export function NotificationCenter({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClear,
  onClearAll,
  className,
}: NotificationCenterProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const icons: Record<ToastType, React.ReactNode> = {
    success: <span className="w-2 h-2 rounded-full bg-green-400" />,
    error: <span className="w-2 h-2 rounded-full bg-red-400" />,
    warning: <span className="w-2 h-2 rounded-full bg-yellow-400" />,
    info: <span className="w-2 h-2 rounded-full bg-cyan-400" />,
  };

  return (
    <div className={cn('glass-card w-full max-w-md', className)}>
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-xs">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs text-slate-400 hover:text-slate-300"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-slate-400">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  'flex items-start gap-3 p-4 transition-colors',
                  !notification.read && 'bg-white/5'
                )}
              >
                <div className="mt-1">{icons[notification.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium', !notification.read ? 'text-white' : 'text-slate-300')}>
                    {notification.title}
                  </p>
                  {notification.message && (
                    <p className="text-sm text-slate-400 mt-1">{notification.message}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-slate-500">
                      {formatTime(notification.timestamp)}
                    </span>
                    {!notification.read && (
                      <button
                        onClick={() => onMarkAsRead(notification.id)}
                        className="text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        Mark as read
                      </button>
                    )}
                    <button
                      onClick={() => onClear(notification.id)}
                      className="text-xs text-slate-500 hover:text-slate-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
