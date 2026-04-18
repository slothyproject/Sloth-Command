/**
 * Top Navigation Component
 * Header with search, notifications, user menu
 */

'use client';

import { useState } from 'react';
import { useThemeStore } from '@/app/stores/theme-store';
import { useAuthStore } from '@/app/stores/auth-store';

export function TopNav() {
  const { toggleTheme } = useThemeStore();
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-72 z-30 h-16 glass border-b border-white/10">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left: Mobile Menu Button */}
        <button className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Center: Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <svg 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search services, variables..."
              className="w-full pl-10 pr-4 py-2 rounded-lg input-glass text-sm text-white placeholder-slate-500 focus:outline-none"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-xs rounded bg-slate-700 text-slate-400">
                ⌘K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
            title="Toggle theme"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 glass-elevated rounded-lg border border-white/10 shadow-xl">
                <div className="p-4 border-b border-white/10">
                  <h3 className="font-semibold text-white">Notifications</h3>
                </div>
                <div className="p-2">
                  <div className="p-3 rounded-lg hover:bg-white/5">
                    <p className="text-sm text-white">Discord Bot deployment failed</p>
                    <p className="text-xs text-slate-400 mt-1">2 minutes ago</p>
                  </div>
                  <div className="p-3 rounded-lg hover:bg-white/5">
                    <p className="text-sm text-white">High CPU usage on API Backend</p>
                    <p className="text-xs text-slate-400 mt-1">15 minutes ago</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-white font-medium">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 glass-elevated rounded-lg border border-white/10 shadow-xl">
                <div className="p-4 border-b border-white/10">
                  <p className="font-medium text-white truncate">{user?.email}</p>
                  <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
                </div>
                <div className="p-2">
                  <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300">
                    Profile
                  </button>
                  <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300">
                    Settings
                  </button>
                  <hr className="my-2 border-white/10" />
                  <button 
                    onClick={logout}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500/20 text-red-400"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
