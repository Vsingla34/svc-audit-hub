import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Clock,
  ShieldCheck,
  MapPin,
  CreditCard,
  User,
  LogOut,
  Menu,
  X,
  BarChart,
  CheckSquare,
  Users
} from 'lucide-react';

// --- NAVIGATION CONFIGURATIONS ---

export const adminNavItems = [
  { title: 'Overview', href: '/admin/overview', icon: LayoutDashboard, tabValue: 'overview' },
  { title: 'Assignments', href: '/admin/assignments', icon: Briefcase, tabValue: 'assignments' },
  { title: 'Applications & KYC', href: '/admin/applications', icon: CheckSquare, tabValue: 'applications' },
  { title: 'Deadlines', href: '/admin/deadlines', icon: Clock, tabValue: 'deadlines' },
  { title: 'Live Reports', href: '/admin/reports', icon: FileText, tabValue: 'reports' },
  
  // UNIFIED DIRECTORY LINK
  { title: 'Auditor Directory', href: '/admin/users', icon: Users, tabValue: 'users' },
  
  { title: 'Finance & Payments', href: '/payments', icon: CreditCard, tabValue: 'payments' },
  { title: 'Map View', href: '/map', icon: MapPin, tabValue: 'map-view' },
];

export const auditorNavItems = [
  { title: 'Overview', href: '/auditor/overview', icon: LayoutDashboard, tabValue: 'overview' },
  { title: 'Available Jobs', href: '/auditor/available-jobs', icon: Briefcase, tabValue: 'available-jobs' },
  { title: 'My Assignments', href: '/auditor/assignments', icon: FileText, tabValue: 'my-jobs' },
  { title: 'My Applications', href: '/auditor/applications', icon: CheckSquare, tabValue: 'my-applications' },
  { title: 'Analytics', href: '/auditor/analytics', icon: BarChart, tabValue: 'analytics' },
  { title: 'My Profile', href: '/profile-edit', icon: User, tabValue: 'my-profile' },
  { title: 'Bank & KYC', href: '/bank-kyc', icon: ShieldCheck, tabValue: 'bank-kyc' },
  { title: 'My Earnings', href: '/payments', icon: CreditCard, tabValue: 'payments' },
];

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  tabValue: string;
}

interface DashboardLayoutProps {
  title: string;
  navItems: NavItem[];
  activeTab: string;
  children: React.ReactNode;
}

export function DashboardLayout({ title, navItems, activeTab, children }: DashboardLayoutProps) {
  const { signOut, userRole } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      
      {/* MOBILE OVERLAY */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#111827] text-white transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 bg-[#0f172a]">
          <span className="text-xl font-bold tracking-widest uppercase text-white">
            Audit Flow
          </span>
          <button className="md:hidden text-gray-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="mb-4 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {userRole === 'admin' ? 'Admin Panel' : 'Auditor Portal'}
          </div>
          
          {navItems.map((item) => {
            const isActive = activeTab === item.tabValue || location.pathname.includes(item.href);
            
            return (
              <Link
                key={item.tabValue}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-[#4338CA] text-white font-medium' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                {item.title}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-800">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-white" 
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-3 text-gray-400" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* HEADER */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 sm:px-6 z-10 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-md" 
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">
              {title}
            </h1>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50">
          {children}
        </div>
      </main>
      
    </div>
  );
}