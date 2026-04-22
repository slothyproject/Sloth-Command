/**
 * Discord Setup Advisor Page
 * AI-driven setup interface for configuring Discord servers
 */

'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { DiscordSetupWizard } from './wizard';

export default function DiscordSetupPage() {
  const params = useParams();
  const guildId = (params?.guildId as string) || '';
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
            Your Discord server is now configured and ready to go. Your community members will have a great experience!
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

  return (
    <DiscordSetupWizard
      guildId={guildId}
      onComplete={() => setSetupComplete(true)}
      onError={(err) => setError(err)}
    />
  );
}
