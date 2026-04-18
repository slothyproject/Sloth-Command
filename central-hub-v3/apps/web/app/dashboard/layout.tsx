/**
 * Dashboard Layout
 * Shell with sidebar, top navigation, and main content area
 */

import { Sidebar } from '@/app/components/layout/sidebar';
import { TopNav } from '@/app/components/layout/top-nav';
import { CommandPalette } from '@/app/components/layout/command-palette';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
