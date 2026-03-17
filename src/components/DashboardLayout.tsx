import React, { createContext, useContext, useState, useLayoutEffect } from 'react';
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
  BellOff
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavItem {
  title: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  activeId?: string;
  isBottomNav?: boolean; // Controls if it appears in the bottom bar
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  navItems: NavItem[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const DashboardContext = createContext<{
  setTitle: (t: string) => void;
  setNavItems: (n: NavItem[]) => void;
  setActiveTab: (a: string | undefined) => void;
} | null>(null);

function AppSidebar({ 
  navItems, 
  activeTab, 
  onTabChange 
}: { 
  navItems: NavItem[]; 
  activeTab?: string; 
  onTabChange?: (tab: string) => void;
}) {
  const { signOut, user, userRole } = useAuth();
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
        supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
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
          if (signedData?.signedUrl) avatarUrl = signedData.signedUrl;
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
    <>
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      
      <Sidebar collapsible="icon" className="border-r-0 bg-[#4338CA] text-white" variant="sidebar">
        <SidebarContent className="pt-6 px-3 bg-[#4338CA] overflow-y-auto no-scrollbar">
          
          <div className={cn("flex items-center px-2 mb-6 transition-all duration-300", collapsed ? "justify-center" : "justify-start")}>
            {collapsed ? (
              <div className="bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm h-10 w-10 overflow-hidden p-1.5">
                <img src="/logo.png" alt="Logo" className="h-full w-full object-cover object-left shrink-0" />
              </div>
            ) : (
              <div className="flex flex-col w-full gap-2">
                <div className="bg-white p-2 rounded-lg w-full flex justify-center shadow-sm">
                  <img src="/logo.png" alt="StockCheck360" className="h-auto w-32 object-contain shrink-0" />
                </div>
                <div className="text-center">
                  <span className="text-[11px] text-indigo-200 uppercase tracking-widest font-bold whitespace-nowrap">Audit Flow</span>
                </div>
              </div>
            )}
          </div>

          {!collapsed ? (
            <div className="bg-[#3730A3] rounded-lg p-3 shadow-sm ring-1 ring-[#312E81] mx-1 mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-medium text-indigo-200 uppercase tracking-wider whitespace-nowrap">
                  Logged in as
                </p>
                <div className="inline-flex items-center rounded-full border border-[#4338CA] bg-[#312E81] px-2 py-0.5 text-[10px] font-medium text-white capitalize whitespace-nowrap">
                  {userRole || 'User'}
                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#4338CA]">
                <Avatar className="h-8 w-8 border border-white/20 shrink-0 shadow-sm">
                  <AvatarImage src={avatarUrl || ''} alt={fullName} className="object-cover" />
                  <AvatarFallback className="bg-white/10 text-white font-semibold text-xs">
                    {getInitials(fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden min-w-0">
                  <span className="text-xs font-semibold text-white truncate">{fullName}</span>
                  <span className="text-[10px] text-indigo-200 truncate" title={user?.email}>{user?.email}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-6">
              <Avatar className="h-10 w-10 border-2 border-white/20 shrink-0 shadow-sm">
                <AvatarImage src={avatarUrl || ''} alt={fullName} className="object-cover" />
                <AvatarFallback className="bg-white/10 text-white font-semibold">
                  {getInitials(fullName)}
                </AvatarFallback>
              </Avatar>
            </div>
          )}

          <SidebarGroup>
            <SidebarGroupLabel className={cn("text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2 px-3 truncate", collapsed && "sr-only")}>
              Menu
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {navItems.map((item) => {
                  const itemActiveId = item.activeId || item.title.toLowerCase().replace(/\s+/g, '-');
                  const isActive = activeTab ? activeTab === itemActiveId : location.pathname.includes(item.href || '');
                  
                  return (
                    <SidebarMenuItem 
                      key={item.title} 
                      className={cn(item.isBottomNav ? "hidden md:block" : "block")}
                    >
                      {/* FIX 1: Comment moved safely inside the element */}
                      <SidebarMenuButton
                        onClick={() => {
                          if (item.href) navigate(item.href);
                          else if (item.onClick) item.onClick();
                          else if (onTabChange) onTabChange(itemActiveId);
                        }}
                        tooltip={item.title}
                        className={cn(
                          "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 overflow-hidden",
                          isActive 
                            ? "bg-white text-[#4338CA] font-semibold shadow-md hover:bg-white hover:text-[#4338CA]" 
                            : "text-indigo-100 hover:bg-[#3730A3] hover:text-white"
                        )}
                      >
                        <item.icon className={cn(
                          "h-5 w-5 shrink-0 transition-colors",
                          isActive ? "text-[#4338CA]" : "text-indigo-300 group-hover:text-white"
                        )} />
                        <span className={cn("text-sm flex-1 truncate whitespace-nowrap", collapsed && "sr-only")}>{item.title}</span>
                        {!collapsed && isActive && <ChevronRight className="h-4 w-4 shrink-0 text-[#4338CA]/60" />}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="mt-auto pb-4">
            <SidebarGroupContent>
              <div className={cn("pt-4 border-t border-[#3730A3] space-y-2", collapsed && "border-transparent px-0")}>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={handleSignOut}
                      tooltip="Sign Out"
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 overflow-hidden",
                        "text-indigo-100 hover:bg-[#3730A3] hover:text-white"
                      )}
                    >
                      <LogOut className="h-5 w-5 shrink-0 text-indigo-300 group-hover:text-white transition-colors" />
                      <span className={cn("text-sm font-medium flex-1 truncate whitespace-nowrap", collapsed && "sr-only")}>Log out</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>

                {!collapsed && (
                  <div className="mt-2 px-2 text-center">
                    <p className="text-[10px] text-indigo-300/60 font-medium whitespace-nowrap">
                      &copy; {new Date().getFullYear()} StockCheck360
                    </p>
                  </div>
                )}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </>
  );
}

export function DashboardLayout({ children, title, navItems, activeTab, onTabChange }: DashboardLayoutProps) {
  const parentContext = useContext(DashboardContext);
  const location = useLocation();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    if (parentContext) {
      parentContext.setTitle(title);
      parentContext.setNavItems(navItems);
      parentContext.setActiveTab(activeTab);
    }
  }, [parentContext, title, navItems, activeTab]);

  if (parentContext) {
    return <>{children}</>;
  }

  const [currentTitle, setTitle] = useState(title);
  const [currentNavItems, setNavItems] = useState<NavItem[]>(navItems);
  const [currentActiveTab, setActiveTab] = useState<string | undefined>(activeTab);

  const { userRole, isProfileComplete } = useAuth();
  const { requestPermissionAndGetToken, permissionStatus } = usePushNotifications();

  const filteredNavItems = (userRole === 'auditor' && !isProfileComplete)
    ? currentNavItems.filter(item => item.href === '/profile-setup') 
    : currentNavItems;

  const bottomNavItems = filteredNavItems.filter(item => item.isBottomNav);

  const handleDeniedClick = () => {
    toast.error("Notifications Blocked", {
      description: "Please tap the lock icon (🔒) near your web address bar, change Notifications to 'Allow', and refresh the page.",
      duration: 8000,
    });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background relative">
        <AppSidebar navItems={filteredNavItems} activeTab={currentActiveTab} onTabChange={onTabChange} />
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <header className="sticky top-0 z-10 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex h-full items-center gap-4 px-6">
              <SidebarTrigger className="-ml-2 p-2 rounded-lg hover:bg-accent transition-colors">
                <Menu className="h-5 w-5 text-muted-foreground" />
              </SidebarTrigger>
              
              <div className="flex-1 min-w-0">
                <h1 className="font-heading text-xl font-semibold text-foreground truncate">{currentTitle}</h1>
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                {permissionStatus === 'default' && (
                  <Button onClick={requestPermissionAndGetToken} variant="outline" size="sm" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 gap-2 shadow-sm animate-pulse">
                    <BellRing className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline whitespace-nowrap">Enable Notifications</span>
                  </Button>
                )}
                {permissionStatus === 'denied' && (
                  <Button onClick={handleDeniedClick} variant="outline" size="sm" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 gap-2 shadow-sm">
                    <BellOff className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline whitespace-nowrap">Unblock Notifications</span>
                  </Button>
                )}
                {permissionStatus === 'unsupported' && (
                  <Button 
                    onClick={() => toast.info("App Install Required", { 
                      description: "To enable notifications on iPhone, tap the Share icon and select 'Add to Home Screen'. Open the app from your home screen to enable."
                    })} 
                    variant="outline" 
                    size="sm" 
                    className="bg-gray-50 text-gray-700 border-gray-200 gap-2 shadow-sm"
                  >
                    <BellOff className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="hidden sm:inline whitespace-nowrap">Not Supported</span>
                  </Button>
                )}

                <NotificationBell />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto pb-20 md:pb-0">
            <div className="p-6 max-w-[1600px] mx-auto">
              <DashboardContext.Provider value={{ setTitle, setNavItems, setActiveTab }}>
                {children}
              </DashboardContext.Provider>
            </div>
          </main>

          {bottomNavItems.length > 0 && (
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-[68px] bg-white border-t border-border shadow-[0_-10px_15px_-3px_rgb(0,0,0,0.05)] flex items-center overflow-x-auto no-scrollbar pb-1">
              {bottomNavItems.map((item) => {
                const itemActiveId = item.activeId || item.title.toLowerCase().replace(/\s+/g, '-');
                const isActive = currentActiveTab ? currentActiveTab === itemActiveId : location.pathname.includes(item.href || '');
                
                return (
                  <button
                    key={item.title}
                    onClick={() => {
                      if (item.href) navigate(item.href);
                      else if (item.onClick) item.onClick();
                      else if (onTabChange) onTabChange(itemActiveId);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center flex-1 h-full space-y-1 relative transition-all duration-200",
                      isActive ? "text-[#4338CA]" : "text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {isActive && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] bg-[#4338CA] rounded-b-full" />
                    )}
                    
                    <item.icon className={cn(
                      "h-5 w-5 transition-transform mt-1", 
                      isActive && "scale-110 stroke-[2.5px]"
                    )} />
                    
                    <span className={cn(
                      "text-[10px] text-center leading-none px-1 truncate w-full", 
                      isActive ? "font-bold text-[#4338CA]" : "font-medium"
                    )}>
                      {item.title}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}

export const adminNavItems: NavItem[] = [
  { title: 'Overview', icon: LayoutDashboard, href: '/admin/overview', activeId: 'overview', isBottomNav: true },
  { title: 'Assignments', icon: Briefcase, href: '/admin/assignments', activeId: 'assignments', isBottomNav: true },
  { title: 'Applications & KYC', icon: FileCheck, href: '/admin/applications', activeId: 'applications', isBottomNav: true },
  { title: 'Deadlines', icon: AlertTriangle, href: '/admin/deadlines', activeId: 'deadlines' },
  { title: 'Reports', icon: FileText, href: '/admin/reports', activeId: 'reports' },
  { title: 'User Roles', icon: Shield, href: '/admin/users', activeId: 'user-roles' },
  { title: 'Map View', icon: MapPin, href: '/map' },
  { title: 'Payments', icon: DollarSign, href: '/payments', isBottomNav: true },
];

export const auditorNavItems: NavItem[] = [
  { title: 'Overview', icon: LayoutDashboard, href: '/auditor/overview', activeId: 'overview', isBottomNav: true },
  { title: 'My Profile', icon: Users, href: '/profile-setup' },
  { title: 'Bank & KYC', icon: Landmark, href: '/bank-kyc' },
  { title: 'Available Jobs', icon: Briefcase, href: '/auditor/available-jobs', activeId: 'available-jobs', isBottomNav: true },
  { title: 'My Jobs', icon: FileCheck, href: '/auditor/assignments', activeId: 'my-jobs', isBottomNav: true }, 
  { title: 'Payments', icon: DollarSign, href: '/payments', isBottomNav: true },
];