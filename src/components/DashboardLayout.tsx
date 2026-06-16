import { Outlet } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { TopBar } from '@/components/TopBar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useMockData, mockMode } from '@/hooks/useMockData';
import { JournalPromptModal } from '@/components/JournalPromptModal';
import { TrialNotice } from '@/components/TrialNotice';

function LiveDataLoader() {
  useWebSocket();
  return null;
}
function MockDataLoader() {
  useMockData();
  return null;
}

export default function DashboardLayout() {
  const isMock = mockMode.isEnabled();

  return (
    <SidebarProvider>
      <div className="flex h-svh min-h-svh w-full overflow-hidden">
        {isMock ? <MockDataLoader /> : <LiveDataLoader />}
        <AppSidebar />
        <div className="flex h-svh min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6">
            <Outlet />
          </main>
        </div>
        <JournalPromptModal />
        <TrialNotice />
      </div>
    </SidebarProvider>
  );
}
