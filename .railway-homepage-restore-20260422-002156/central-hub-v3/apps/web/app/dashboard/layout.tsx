/**
 * Dashboard Layout
 * Shell with sidebar, top navigation, and main content area
 * Protected by simple password auth
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/app/components/layout/sidebar';
import { TopNav } from '@/app/components/layout/top-nav';
import { CommandPalette } from '@/app/components/layout/command-palette';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user has JWT token
    const token = localStorage.getItem('central-hub-token');
    if (!token) {
      router.push('/login');
    } else {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, [router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="lg:ml-72">
        <TopNav />
        
        <main className="p-6 pt-20">
          {children}
        </main>
      </div>
      
      {/* Command Palette - Global Search */}
      <CommandPalette />
    </div>
  );
}
