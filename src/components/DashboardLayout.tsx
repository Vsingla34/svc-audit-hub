import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Landmark,
  Radio,
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

  const { data: profileData } = useQuery({
    queryKey: ['sidebar-user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return { fullName: 'User', avatarUrl: null };

      const [profileResponse, auditorResponse] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
        supabase.from('auditor_profiles').select('profile_photo_url').eq('user_id', user.id).maybeSingle()
      ]);

      let fullName = profileResponse.data?.full_name || 'User';
      let avatarUrl = null;

      if (auditorResponse.data?.profile_photo_url) {
        const path = auditorResponse.data.profile_photo_url;
        
        if (path.startsWith('http') || path.startsWith('https')) {
          avatarUrl = path;
        } else {
          const { data: signedData } = await supabase.storage
            .from('kyc-documents')
            .createSignedUrl(path, 3600 * 24); 

          if (signedData?.signedUrl) {
            avatarUrl = signedData.signedUrl;
          }
        }
      }

      return { fullName, avatarUrl };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 30, 
  });

  const fullName = profileData?.fullName || 'User';
  const avatarUrl = profileData?.avatarUrl;

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'U';
  };

  return (
    // UPDATED: bg-[#4338CA]
    <Sidebar collapsible="icon" className="border-r-0 bg-[#4338CA] text-white" variant="sidebar">
      <SidebarContent className="pt-6 px-3 bg-[#4338CA]">
        <div className={cn(
          "flex items-center gap-3 px-2 mb-8 transition-all duration-300",
          collapsed ? "justify-center" : "justify-start"
        )}>
          <Avatar className="h-10 w-10 border-2 border-white/20">
            <AvatarImage src={avatarUrl || ''} alt={fullName} className="object-cover" />
            <AvatarFallback className="bg-white/10 text-white font-semibold">
              {getInitials(fullName)}
            </AvatarFallback>
          </Avatar>
          
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-heading text-sm font-semibold text-white truncate">
                {fullName}
              </span>
              <span className="text-xs text-white/60 truncate" title={user?.email}>
                {user?.email}
              </span>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className={cn(
            "text-white/50 text-xs font-medium uppercase tracking-wider mb-2",
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
                      tooltip={item.title}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                        // Default state: White Text
                        "text-white",
                        // Hover state: White BG, Purple Text (#4338CA)
                        "hover:bg-white hover:text-[#4338CA]",
                        // Active state: White BG, Purple Text
                        isActive && "bg-white text-[#4338CA] font-semibold shadow-sm hover:bg-white hover:text-[#4338CA]"
                      )}
                    >
                      <item.icon className="h-4.5 w-4.5 shrink-0 transition-colors" />
                      
                      <span className={cn("text-sm flex-1", collapsed && "sr-only")}>
                        {item.title}
                      </span>
                      {!collapsed && isActive && (
                        <ChevronRight className="h-4 w-4 text-[#4338CA]/60" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto pb-6">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={signOut}
                  tooltip="Sign Out"
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                    "text-white/70 hover:bg-red-500 hover:text-white"
                  )}
                >
                  <LogOut className="h-4.5 w-4.5 shrink-0 transition-colors" />
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
  const { userRole, isProfileComplete } = useAuth();

  const filteredNavItems = (userRole === 'auditor' && !isProfileComplete)
    ? navItems.filter(item => item.href === '/profile-setup') 
    : navItems;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar navItems={filteredNavItems} activeTab={activeTab} onTabChange={onTabChange} />
        
        <div className="flex-1 flex flex-col min-w-0">
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
  { title: 'Overview', icon: LayoutDashboard, href: '/dashboard?tab=overview' },
  { title: 'Assignments', icon: Briefcase, href: '/dashboard?tab=assignments' },
  { title: 'Deadlines', icon: AlertTriangle, href: '/dashboard?tab=deadlines' },
  { title: 'Applications', icon: FileCheck, href: '/dashboard?tab=applications' },
  { title: 'Reports', icon: FileText, href: '/dashboard?tab=reports' },
  { title: 'KYC Approvals', icon: Shield, href: '/dashboard?tab=kyc-approvals' },
  { title: 'User Roles', icon: Shield, href: '/dashboard?tab=user-roles' },
  { title: 'Map View', icon: MapPin, href: '/map' },
  { title: 'Payments', icon: DollarSign, href: '/payments' },
];

export const auditorNavItems: NavItem[] = [
  { title: 'Overview', icon: LayoutDashboard, href: '/dashboard?tab=overview' },
  { title: 'Live Report', icon: Radio, href: '/dashboard?tab=live-report' },
  { title: 'My Profile', icon: Users, href: '/profile-setup' },
  { title: 'Bank & KYC', icon: Landmark, href: '/bank-kyc' },
  { title: 'Available Jobs', icon: Briefcase, href: '/dashboard?tab=available-jobs' },
  { title: 'My Applications', icon: Clock, href: '/dashboard?tab=my-applications' },
  { title: 'My Assignments', icon: FileCheck, href: '/dashboard?tab=my-assignments' },
  { title: 'Analytics', icon: BarChart3, href: '/dashboard?tab=analytics' },
  { title: 'Payments', icon: DollarSign, href: '/payments' },
];