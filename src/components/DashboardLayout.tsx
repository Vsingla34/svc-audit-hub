import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { NotificationBell } from '@/components/NotificationBell';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
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
  Shield,
  LogOut,
  AlertTriangle,
  FileText,
  Menu,
  ChevronRight,
  Landmark,
  BellRing,
  BellOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavItem {
  title: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  activeId?: string; // used to match with activeTab
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
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const handleSignOut = async () => {
    try {
      await signOut(); 
    } catch (error) {
      console.warn("Server logout failed. Forcing local logout.");
    } finally {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key === 'current_device_fcm_token') {
          localStorage.removeItem(key);
        }
      });
      window.location.href = '/auth';
    }
  };

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
    return name?.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2) || 'U';
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-[#4338CA] text-white" variant="sidebar">
      <SidebarContent className="pt-6 px-3 bg-[#4338CA]">
        <div className={cn("flex items-center gap-3 px-2 mb-8 transition-all duration-300", collapsed ? "justify-center" : "justify-start")}>
          <Avatar className="h-10 w-10 border-2 border-white/20">
            <AvatarImage src={avatarUrl || ''} alt={fullName} className="object-cover" />
            <AvatarFallback className="bg-white/10 text-white font-semibold">
              {getInitials(fullName)}
            </AvatarFallback>
          </Avatar>
          
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-heading text-sm font-semibold text-white truncate">{fullName}</span>
              <span className="text-xs text-white/60 truncate" title={user?.email}>{user?.email}</span>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className={cn("text-white/50 text-xs font-medium uppercase tracking-wider mb-2", collapsed && "sr-only")}>
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => {
                const itemActiveId = item.activeId || item.title.toLowerCase().replace(/\s+/g, '-');
                const isActive = activeTab ? activeTab === itemActiveId : location.pathname.includes(item.href || '');
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      onClick={() => {
                        if (item.href) navigate(item.href);
                        else if (item.onClick) item.onClick();
                        else if (onTabChange) onTabChange(itemActiveId);
                      }}
                      tooltip={item.title}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                        "text-white",
                        "hover:bg-white hover:text-[#4338CA]",
                        isActive && "bg-white text-[#4338CA] font-semibold shadow-sm hover:bg-white hover:text-[#4338CA]"
                      )}
                    >
                      <item.icon className="h-4.5 w-4.5 shrink-0 transition-colors" />
                      <span className={cn("text-sm flex-1", collapsed && "sr-only")}>{item.title}</span>
                      {!collapsed && isActive && <ChevronRight className="h-4 w-4 text-[#4338CA]/60" />}
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
                  onClick={handleSignOut}
                  tooltip="Sign Out"
                  className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group", "text-white/70 hover:bg-red-500 hover:text-white")}
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

export function DashboardLayout({ children, title, navItems, activeTab, onTabChange }: DashboardLayoutProps) {
  const { userRole, isProfileComplete } = useAuth();
  const { requestPermissionAndGetToken, permissionStatus } = usePushNotifications();

  const filteredNavItems = (userRole === 'auditor' && !isProfileComplete)
    ? navItems.filter(item => item.href === '/profile-setup') 
    : navItems;

  const handleDeniedClick = () => {
    toast.error("Notifications Blocked", {
      description: "Please tap the lock icon (🔒) near your web address bar, change Notifications to 'Allow', and refresh the page.",
      duration: 8000,
    });
  };

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
                <h1 className="font-heading text-xl font-semibold text-foreground truncate">{title}</h1>
              </div>
              
              <div className="flex items-center gap-3">
                
                {/* 1. Default State: Ask for Permission */}
                {permissionStatus === 'default' && (
                  <Button onClick={requestPermissionAndGetToken} variant="outline" size="sm" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 gap-2 shadow-sm animate-pulse">
                    <BellRing className="h-4 w-4" />
                    <span className="hidden sm:inline">Enable Notifications</span>
                  </Button>
                )}

                {/* 2. Denied State: Tell them how to unblock it */}
                {permissionStatus === 'denied' && (
                  <Button onClick={handleDeniedClick} variant="outline" size="sm" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 gap-2 shadow-sm">
                    <BellOff className="h-4 w-4" />
                    <span className="hidden sm:inline">Unblock Notifications</span>
                  </Button>
                )}

                {/* 3. Unsupported State: iPhone/Safari without App Install */}
                {permissionStatus === 'unsupported' && (
                  <Button 
                    onClick={() => toast.info("App Install Required", { 
                      description: "To enable notifications on iPhone, tap the Share icon and select 'Add to Home Screen'. Open the app from your home screen to enable."
                    })} 
                    variant="outline" 
                    size="sm" 
                    className="bg-gray-50 text-gray-700 border-gray-200 gap-2 shadow-sm"
                  >
                    <BellOff className="h-4 w-4 text-gray-400" />
                    <span className="hidden sm:inline">Not Supported</span>
                  </Button>
                )}

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

// ADMIN MENU UPDATED TO USE REAL ROUTES
export const adminNavItems: NavItem[] = [
  { title: 'Overview', icon: LayoutDashboard, href: '/admin/overview', activeId: 'overview' },
  { title: 'Assignments', icon: Briefcase, href: '/admin/assignments', activeId: 'assignments' },
  { title: 'Applications & KYC', icon: FileCheck, href: '/admin/applications', activeId: 'applications' },
  { title: 'Deadlines', icon: AlertTriangle, href: '/admin/deadlines', activeId: 'deadlines' },
  { title: 'Reports', icon: FileText, href: '/admin/reports', activeId: 'reports' },
  { title: 'User Roles', icon: Shield, href: '/admin/users', activeId: 'user-roles' },
  { title: 'Map View', icon: MapPin, href: '/map' },
  { title: 'Payments', icon: DollarSign, href: '/payments' },
];

// AUDITOR MENU
export const auditorNavItems: NavItem[] = [
  { title: 'Overview', icon: LayoutDashboard, href: '/auditor/overview', activeId: 'overview' },
  { title: 'My Profile', icon: Users, href: '/profile-setup' },
  { title: 'Bank & KYC', icon: Landmark, href: '/bank-kyc' },
  { title: 'Available Jobs', icon: Briefcase, href: '/auditor/available-jobs', activeId: 'available-jobs' },
  { title: 'My Jobs', icon: FileCheck, href: '/auditor/assignments', activeId: 'my-jobs' }, 
  { title: 'Payments', icon: DollarSign, href: '/payments' },
];