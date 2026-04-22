/**
 * Utility Functions
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date to readable string
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  });
}

/**
 * Format time ago
 */
export function formatTimeAgo(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return formatDate(date);
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals = 1) {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Mask sensitive value
 */
export function maskValue(value: string, visibleChars = 4) {
  if (value.length <= visibleChars * 2) return '•'.repeat(value.length);
  const start = value.slice(0, visibleChars);
  const end = value.slice(-visibleChars);
  return `${start}${'•'.repeat(value.length - visibleChars * 2)}${end}`;
}

/**
 * Generate unique ID
 */
export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
) {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
) {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Get status color class
 */
export function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    healthy: 'text-green-400 bg-green-400/10 border-green-400/20',
    degraded: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    unhealthy: 'text-red-400 bg-red-400/10 border-red-400/20',
    paused: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
    deploying: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    crashed: 'text-red-400 bg-red-400/10 border-red-400/20',
    pending: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
    in_progress: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    success: 'text-green-400 bg-green-400/10 border-green-400/20',
    failed: 'text-red-400 bg-red-400/10 border-red-400/20',
    critical: 'text-red-400 bg-red-400/10 border-red-400/20',
    warning: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    suggestion: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    info: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  };
  return colors[status] || colors.info;
}

/**
 * Get status icon
 */
export function getStatusIcon(status: string) {
  const icons: Record<string, string> = {
    healthy: 'CheckCircle2',
    degraded: 'AlertTriangle',
    unhealthy: 'XCircle',
    crashed: 'AlertOctagon',
    deploying: 'Loader2',
    success: 'CheckCircle2',
    failed: 'XCircle',
    pending: 'Clock',
    in_progress: 'Loader2',
  };
  return icons[status] || 'Circle';
}

/**
 * Copy to clipboard
 */
export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download file
 */
export function downloadFile(content: string, filename: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse JSON safely
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Check if running in browser
 */
export function isBrowser() {
  return typeof window !== 'undefined';
}

/**
 * Check if PWA is installed
 */
export function isPWA() {
  return isBrowser() && window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Get initial theme
 */
export function getInitialTheme(): 'light' | 'dark' {
  if (!isBrowser()) return 'dark';
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
