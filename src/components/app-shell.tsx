'use client';
import React from 'react';
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
  Package,
  Briefcase,
  Receipt,
  ExternalLink,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { COMPANY_SITES } from '@/types/site';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useAuth();
  const user = auth?.user;
  const router = useRouter();
  const { openMobile, setOpenMobile } = useSidebar();

  const handleSignOut = async () => {
    if (auth && auth.signOut) {
      await auth.signOut();
    }
  };

  const isNonNewRelic = user?.assignedSite && user.assignedSite !== 'newrelic';
  const siteConfig = user?.assignedSite ? COMPANY_SITES[user.assignedSite] : null;

  const portalHref = isNonNewRelic ? '/newrelic/tuckshop' : '/newrelic';
  const portalLabel = siteConfig ? `${siteConfig.name} Portal` : 'NewRelic DC Portal';

  const rawNavItems = [
    { href: '/', label: 'New Invoice', icon: FilePlus, app: '/invoices' },
    { href: '/quotation', label: 'New Quotation', icon: FileText, app: '/quotations' },
    { href: '/delivery-challan', label: 'Delivery Challan', icon: Truck, app: '/delivery-challans', hideIfNonNewRelic: true },
    { href: '/offer-letter', label: 'Offer Letter', icon: Briefcase, app: '/offer-letter' },
    { href: '/payslip', label: 'Payslip', icon: Receipt, app: '/payslip' },
    { href: '/invoices', label: 'Saved Invoices', icon: ListOrdered, app: '/invoices' },
    { href: '/quotations', label: 'Saved Quotations', icon: ListOrdered, app: '/quotations' },
    { href: '/delivery-challans', label: 'Saved Challans', icon: ListOrdered, app: '/delivery-challans', hideIfNonNewRelic: true },
    { href: '/products', label: 'Products', icon: Package, app: '/invoices' },
    { href: '/clients', label: 'Clients', icon: User, app: '/invoices' },
    { href: '/settings', label: 'Settings', icon: Settings, app: '/settings' },
    { href: '/declarations', label: 'GST Declarations', icon: FileText, divider: true, app: '/declarations' },
    { href: portalHref, label: portalLabel, icon: ExternalLink, app: '/newrelic' },
  ];

  const isAdmin = auth?.role === 'admin' || auth?.role === 'superadmin';
  const assignedApps = user?.assignedApps || [];

  const navItems = rawNavItems.filter((item) => {
    if (item.hideIfNonNewRelic && isNonNewRelic) return false;
    if (isAdmin) return true;
    if (assignedApps.length > 0 && item.app) {
      return assignedApps.includes(item.app);
    }
    return true;
  });

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <h1 className="text-xl font-bold text-sidebar-primary group-data-[collapsible=icon]:hidden">
              InvoiceFlow
            </h1>
            <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <React.Fragment key={item.href}>
                {item.divider && (
                  <div className="mx-2 my-1 h-px bg-sidebar-border group-data-[collapsible=icon]:hidden" />
                )}
                <SidebarMenuItem>
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
              </React.Fragment>
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
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
                  <span className="text-sm font-semibold truncate text-sidebar-primary">
                    {user?.email?.split('@')[0]}
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
        <header className="flex items-center p-3 border-b md:hidden bg-card sticky top-0 z-10 shadow-sm">
          <SidebarTrigger />
          <h1 className="text-lg font-bold ml-2 text-primary">InvoiceFlow</h1>
        </header>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
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
