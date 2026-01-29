import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
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
  
  const [fullName, setFullName] = useState<string>('User');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      getProfile();
    }
  }, [user]);

  const getProfile = async () => {
    if (!user) return;
    try {
      // 1. Fetch Name from 'profiles' table
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profileData?.full_name) {
        setFullName(profileData.full_name);
      }

      
      const { data: auditorData } = await supabase
        .from('auditor_profiles')
        .select('profile_photo_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (auditorData?.profile_photo_url) {
        const path = auditorData.profile_photo_url;
        
        // If it's already a full URL (e.g. from Google Auth or external), use it
        if (path.startsWith('http') || path.startsWith('https')) {
          setAvatarUrl(path);
        } else {
          // Otherwise, generate a signed URL from the 'kyc-documents' bucket
          // We use signed URL because 'kyc-documents' is a private bucket
          const { data: signedData } = await supabase.storage
            .from('kyc-documents')
            .createSignedUrl(path, 3600 * 24); // Valid for 24 hours

          if (signedData?.signedUrl) {
            setAvatarUrl(signedData.signedUrl);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'U';
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-sidebar">
      <SidebarContent className="pt-6 px-3">
        {/* User Header */}
        <div className={cn(
          "flex items-center gap-3 px-2 mb-8 transition-all duration-300",
          collapsed ? "justify-center" : "justify-start"
        )}>
          <Avatar className="h-10 w-10 border-2 border-sidebar-primary/20">
            <AvatarImage src={avatarUrl || ''} alt={fullName} className="object-cover" />
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-semibold">
              {getInitials(fullName)}
            </AvatarFallback>
          </Avatar>
          
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-heading text-sm font-semibold text-sidebar-foreground truncate">
                {fullName}
              </span>
              <span className="text-xs text-sidebar-foreground/60 truncate" title={user?.email}>
                {user?.email}
              </span>
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
  { title: 'Auditors', icon: Users, href: '/dashboard?tab=auditors' },
  { title: 'Applications', icon: FileCheck, href: '/dashboard?tab=applications' },
  { title: 'Reports', icon: FileText, href: '/dashboard?tab=reports' },
  { title: 'KYC Approvals', icon: Shield, href: '/dashboard?tab=kyc-approvals' },
  { title: 'User Roles', icon: Shield, href: '/dashboard?tab=user-roles' },
  { title: 'Map View', icon: MapPin, href: '/map' },
  { title: 'Payments', icon: DollarSign, href: '/payments' },
];

export const auditorNavItems: NavItem[] = [
  { title: 'Overview', icon: LayoutDashboard, href: '/dashboard?tab=overview' },
  { title: 'My Profile', icon: Users, href: '/profile-setup' },
  { title: 'Bank & KYC', icon: Landmark, href: '/bank-kyc' },
  { title: 'Available Jobs', icon: Briefcase, href: '/dashboard?tab=available-jobs' },
  { title: 'My Applications', icon: Clock, href: '/dashboard?tab=my-applications' },
  { title: 'My Assignments', icon: FileCheck, href: '/dashboard?tab=my-assignments' },
  { title: 'Analytics', icon: BarChart3, href: '/dashboard?tab=analytics' },
  { title: 'Payments', icon: DollarSign, href: '/payments' },
];