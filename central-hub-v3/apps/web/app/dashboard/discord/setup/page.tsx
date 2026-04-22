/**
 * Discord Setup Advisor Page
 * AI-driven setup interface for configuring Discord servers
 */

'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DiscordSetupWizard } from './wizard';

export default function DiscordSetupPage() {
  // guildId can be passed as a query param: /dashboard/discord/setup?guildId=123456
  const searchParams = useSearchParams();
  const [guildId, setGuildId] = useState<string>(searchParams?.get('guildId') ?? '');
  const [confirmed, setConfirmed] = useState<boolean>(!!searchParams?.get('guildId'));
  const [setupComplete, setSetupComplete] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="max-w-md">
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-400 mb-2">Setup Failed</h2>
            <p className="text-red-300 mb-4">{error.message}</p>
            <button
              onClick={() => setError(null)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (setupComplete) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-white mb-4">All Set!</h2>
          <p className="text-slate-300 mb-8">
            Your Discord server is now configured and ready to go. Your community members will have
            a great experience!
          </p>
          <a
            href="/dashboard"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // If no guildId yet, show a simple guild-ID entry form
  if (!confirmed) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-slate-800 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-white mb-2">Select a Discord Server</h2>
            <p className="text-slate-400 mb-6">
              Enter the Guild ID of the server you want to configure. You can find it in Discord
              under <span className="text-slate-300 font-medium">Server Settings → Widget</span>.
            </p>
            <label className="block text-sm font-medium text-slate-300 mb-2">Guild ID</label>
            <input
              type="text"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value.trim())}
              placeholder="e.g. 1234567890123456789"
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600 focus:border-blue-500 focus:outline-none mb-4"
            />
            <button
              onClick={() => setConfirmed(true)}
              disabled={!guildId}
              className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DiscordSetupWizard
      guildId={guildId}
      onComplete={() => setSetupComplete(true)}
      onError={(err) => setError(err)}
    />
  );
}
