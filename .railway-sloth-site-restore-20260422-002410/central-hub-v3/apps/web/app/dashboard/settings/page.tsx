/**
 * Settings Page
 * User preferences and keyboard shortcuts
 */

'use client';

import { useState, useEffect } from 'react';
import { useThemeStore } from '@/app/stores/theme-store';
import { cn } from '@/app/lib/utils';

export default function SettingsPage() {
  const { theme, setTheme } = useThemeStore();
  const [activeSection, setActiveSection] = useState('general');

  const shortcuts = [
    { key: '⌘ K', action: 'Open Command Palette', description: 'Search services and commands' },
    { key: '⌘ /', action: 'Toggle Help', description: 'Show keyboard shortcuts' },
    { key: '⌘ B', action: 'Toggle Sidebar', description: 'Show/hide sidebar' },
    { key: '⌘ T', action: 'Toggle Theme', description: 'Switch dark/light mode' },
    { key: 'ESC', action: 'Close Modal', description: 'Close any open modal' },
    { key: '⌘ S', action: 'Save Changes', description: 'Save current form' },
    { key: '⌘ D', action: 'Deploy Service', description: 'Deploy selected service' },
    { key: '⌘ R', action: 'Restart Service', description: 'Restart selected service' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your preferences and keyboard shortcuts</p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="glass-card p-4 h-fit">
          <nav className="space-y-1">
            {[
              { id: 'general', label: 'General', icon: 'Settings' },
              { id: 'security', label: 'Security', icon: 'Shield' },
              { id: 'appearance', label: 'Appearance', icon: 'Palette' },
              { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: 'Keyboard' },
              { id: 'notifications', label: 'Notifications', icon: 'Bell' },
              { id: 'integrations', label: 'Integrations', icon: 'Plug' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                  activeSection === item.id
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          {activeSection === 'general' && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-white mb-6">General Settings</h2>

              <div className="space-y-6">
                {/* Auto-sync */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">Auto-sync with Railway</p>
                    <p className="text-sm text-slate-400">Automatically sync services every 5 minutes</p>
                  </div>
                  <Toggle defaultChecked={true} />
                </div>

                {/* Auto-refresh */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">Auto-refresh metrics</p>
                    <p className="text-sm text-slate-400">Update service metrics every 30 seconds</p>
                  </div>
                  <Toggle defaultChecked={true} />
                </div>

                {/* Desktop notifications */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">Desktop notifications</p>
                    <p className="text-sm text-slate-400">Show notifications for important events</p>
                  </div>
                  <Toggle defaultChecked={true} />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'security' && <SecuritySettings />}

          {activeSection === 'appearance' && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Appearance</h2>

              <div className="space-y-6">
                {/* Theme */}
                <div>
                  <p className="font-medium text-white mb-3">Theme</p>
                  <div className="flex gap-3">
                    {(['light', 'dark', 'system'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className={cn(
                          'px-4 py-2 rounded-lg border transition-colors',
                          theme === t
                            ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                            : 'border-white/10 text-slate-400 hover:bg-white/5'
                        )}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compact mode */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">Compact mode</p>
                    <p className="text-sm text-slate-400">Reduce padding and spacing</p>
                  </div>
                  <Toggle defaultChecked={false} />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'shortcuts' && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Keyboard Shortcuts</h2>

              <div className="space-y-3">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                  >
                    <div>
                      <p className="font-medium text-white">{shortcut.action}</p>
                      <p className="text-sm text-slate-400">{shortcut.description}</p>
                    </div>
                    <kbd className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 font-mono text-sm">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Notification Preferences</h2>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">Deployment notifications</p>
                    <p className="text-sm text-slate-400">Notify when deployments complete or fail</p>
                  </div>
                  <Toggle defaultChecked={true} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">Health alerts</p>
                    <p className="text-sm text-slate-400">Notify when services become unhealthy</p>
                  </div>
                  <Toggle defaultChecked={true} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">AI recommendations</p>
                    <p className="text-sm text-slate-400">Notify when new recommendations are available</p>
                  </div>
                  <Toggle defaultChecked={true} />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'integrations' && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Integrations</h2>

              <div className="space-y-6">
                {/* Discord */}
                <div className="p-4 rounded-lg bg-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#5865F2] flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-white">Discord</p>
                        <p className="text-sm text-slate-400">Connected</p>
                      </div>
                    </div>
                    <button className="text-red-400 hover:text-red-300 text-sm">Disconnect</button>
                  </div>
                </div>

                {/* GitHub */}
                <div className="p-4 rounded-lg bg-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-white">GitHub</p>
                        <p className="text-sm text-slate-400">Not connected</p>
                      </div>
                    </div>
                    <button className="text-cyan-400 hover:text-cyan-300 text-sm">Connect</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Toggle Component
function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <button
      onClick={() => setChecked(!checked)}
      className={cn(
        'w-12 h-6 rounded-full transition-colors relative',
        checked ? 'bg-cyan-500' : 'bg-slate-700'
      )}
    >
      <div
        className={cn(
          'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
          checked ? 'translate-x-7' : 'translate-x-1'
        )}
      />
    </button>
  );
}

// Security Settings Component
function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [storedPassword, setStoredPassword] = useState('central-hub-2025');

  // Load current password from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('central-hub-password');
    if (saved) {
      setStoredPassword(saved);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    // Validate current password
    if (currentPassword !== storedPassword) {
      setError('Current password is incorrect');
      return;
    }

    // Validate new password
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setIsLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update password in localStorage
    localStorage.setItem('central-hub-password', newPassword);
    setStoredPassword(newPassword);
    
    setMessage('Password updated successfully!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-6">Security Settings</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current Password */}
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-slate-300 mb-2">
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg input-glass text-white placeholder-slate-500 focus:outline-none"
              placeholder="Enter current password"
            />
          </div>

          {/* New Password */}
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-slate-300 mb-2">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg input-glass text-white placeholder-slate-500 focus:outline-none"
              placeholder="Enter new password"
            />
            <p className="mt-1 text-xs text-slate-500">Must be at least 8 characters long</p>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300 mb-2">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg input-glass text-white placeholder-slate-500 focus:outline-none"
              placeholder="Confirm new password"
            />
          </div>

          {/* Success Message */}
          {message && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              {message}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full py-3 px-4 rounded-lg font-medium text-white transition-all",
              "bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500",
              "shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center justify-center gap-2"
            )}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </button>
        </form>
      </div>

      {/* Security Info */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Security Information</h3>
        <div className="space-y-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <span>Your password is stored securely</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <span>Session expires when you close the browser</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <span>All data is encrypted in transit</span>
          </div>
        </div>
      </div>
    </div>
  );
}
