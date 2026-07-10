import { Outlet } from 'react-router-dom';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { OfflineBanner } from '@/components/feedback';

export function RootLayout() {
  return (
    <div className="flex h-full min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <OfflineBanner />
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
