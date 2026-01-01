import { SidebarProvider } from '@/components/ui/sidebar';
import { AppShell } from '@/components/app-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppShell>{children}</AppShell>
    </SidebarProvider>
  );
}
