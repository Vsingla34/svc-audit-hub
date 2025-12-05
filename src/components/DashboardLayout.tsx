import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/NotificationBell';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileCheck,
  MapPin,
  DollarSign,
  BarChart3,
  Shield,
  LogOut,
  AlertTriangle,
  FileText,
  Clock,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  navItems: NavItem[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

function AppSidebar({ 
  navItems, 
  activeTab, 
  onTabChange 
}: { 
  navItems: NavItem[]; 
  activeTab?: string; 
  onTabChange?: (tab: string) => void;
}) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className={cn(collapsed && "sr-only")}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => {
                      if (item.href) {
                        navigate(item.href);
                      } else if (item.onClick) {
                        item.onClick();
                      } else if (onTabChange) {
                        onTabChange(item.title.toLowerCase().replace(/\s+/g, '-'));
                      }
                    }}
                    isActive={activeTab === item.title.toLowerCase().replace(/\s+/g, '-')}
                    tooltip={item.title}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className={cn(collapsed && "sr-only")}>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto pb-4">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={signOut}
                  tooltip="Sign Out"
                  className="flex items-center gap-3 px-3 py-2 text-destructive hover:text-destructive"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className={cn(collapsed && "sr-only")}>Sign Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export function DashboardLayout({ 
  children, 
  title, 
  navItems, 
  activeTab, 
  onTabChange 
}: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar navItems={navItems} activeTab={activeTab} onTabChange={onTabChange} />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
            <div className="flex h-14 items-center gap-4 px-4">
              <SidebarTrigger className="-ml-1">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <h1 className="text-xl font-semibold text-foreground truncate">{title}</h1>
              <div className="ml-auto flex items-center gap-2">
                <NotificationBell />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export const adminNavItems: NavItem[] = [
  { title: 'Overview', icon: LayoutDashboard },
  { title: 'Assignments', icon: Briefcase },
  { title: 'Deadlines', icon: AlertTriangle },
  { title: 'Auditors', icon: Users },
  { title: 'Applications', icon: FileCheck },
  { title: 'Reports', icon: FileText },
  { title: 'KYC Approvals', icon: Shield },
  { title: 'User Roles', icon: Shield },
  { title: 'Map View', icon: MapPin, href: '/map' },
  { title: 'Payments', icon: DollarSign, href: '/payments' },
];

export const auditorNavItems: NavItem[] = [
  { title: 'Overview', icon: LayoutDashboard },
  { title: 'Available Jobs', icon: Briefcase },
  { title: 'My Applications', icon: Clock },
  { title: 'My Assignments', icon: FileCheck },
  { title: 'Analytics', icon: BarChart3 },
  { title: 'Payments', icon: DollarSign, href: '/payments' },
];
