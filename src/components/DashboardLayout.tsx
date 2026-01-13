import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
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
  ChevronRight,
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
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-sidebar">
      <SidebarContent className="pt-6 px-3">
        {/* Logo/Brand */}
        <div className={cn(
          "flex items-center gap-3 px-3 mb-8",
          collapsed && "justify-center"
        )}>
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Shield className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-heading text-base font-semibold text-sidebar-foreground">AuditHub</h1>
              <p className="text-xs text-sidebar-foreground/60">Management Portal</p>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className={cn(
            "text-sidebar-foreground/50 text-xs font-medium uppercase tracking-wider mb-2",
            collapsed && "sr-only"
          )}>
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => {
                const isActive = activeTab === item.title.toLowerCase().replace(/\s+/g, '-');
                return (
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
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                        "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                        isActive && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                      )}
                    >
                      <item.icon className="h-4.5 w-4.5 shrink-0" />
                      <span className={cn("text-sm font-medium flex-1", collapsed && "sr-only")}>
                        {item.title}
                      </span>
                      {!collapsed && isActive && (
                        <ChevronRight className="h-4 w-4 opacity-60" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Sign Out at bottom */}
        <SidebarGroup className="mt-auto pb-6">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={signOut}
                  tooltip="Sign Out"
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                    "text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10"
                  )}
                >
                  <LogOut className="h-4.5 w-4.5 shrink-0" />
                  <span className={cn("text-sm font-medium", collapsed && "sr-only")}>Sign Out</span>
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
          <header className="sticky top-0 z-10 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex h-full items-center gap-4 px-6">
              <SidebarTrigger className="-ml-2 p-2 rounded-lg hover:bg-accent transition-colors">
                <Menu className="h-5 w-5 text-muted-foreground" />
              </SidebarTrigger>
              
              <div className="flex-1">
                <h1 className="font-heading text-xl font-semibold text-foreground">{title}</h1>
              </div>
              
              <div className="flex items-center gap-3">
                <NotificationBell />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="p-6 max-w-[1600px] mx-auto">
              {children}
            </div>
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
  { title: 'My Profile', icon: Users, href: '/profile-setup' },
  { title: 'Available Jobs', icon: Briefcase },
  { title: 'My Applications', icon: Clock },
  { title: 'My Assignments', icon: FileCheck },
  { title: 'Analytics', icon: BarChart3 },
  { title: 'Payments', icon: DollarSign, href: '/payments' },
];
