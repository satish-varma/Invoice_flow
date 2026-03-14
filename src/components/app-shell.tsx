'use client';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
  SidebarProvider,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import {
  FilePlus,
  FileText,
  Truck,
  Settings,
  ListOrdered,
  LogOut,
  User,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useUser } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { openMobile, setOpenMobile } = useSidebar();

  const handleSignOut = async () => {
    if (auth) {
      await auth.signOut();
      router.push('/auth');
    }
  };

  const navItems = [
    { href: '/', label: 'New Invoice', icon: FilePlus },
    { href: '/quotation', label: 'New Quotation', icon: FileText },
    { href: '/delivery-challan', label: 'Delivery Challan', icon: Truck },
    { href: '/invoices', label: 'Saved Invoices', icon: ListOrdered },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <h1 className="text-xl font-bold text-sidebar-primary group-data-[collapsible=icon]:hidden">
              InvoiceFlow v2
            </h1>
            <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} passHref>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={{ children: item.label }}
                    onClick={() => {
                      if (openMobile) setOpenMobile(false);
                    }}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={{ children: 'Sign Out' }}
                onClick={handleSignOut}
              >
                <LogOut />
                <span>Sign Out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || ''} />
                  <AvatarFallback>
                    <User />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
                  <span className="text-sm font-semibold truncate text-sidebar-primary">
                    {user?.displayName}
                  </span>
                  <span className="text-xs text-sidebar-foreground/70 truncate">
                    {user?.email}
                  </span>
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center p-2 border-b md:hidden">
          <SidebarTrigger />
          <h1 className="text-lg font-bold ml-2">InvoiceFlow v2</h1>
        </header>
        {children}
      </SidebarInset>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppShellContent>{children}</AppShellContent>
    </SidebarProvider>
  );
}
