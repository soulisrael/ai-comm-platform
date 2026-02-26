import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Users, UsersRound,
  BarChart3, Settings, LogOut, Menu, X, ChevronRight,
  Bot, Zap, Smartphone,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'ראשי' },
  { to: '/agents', icon: Bot, label: 'סוכנים' },
  { to: '/chat', icon: MessageSquare, label: 'צ׳אט חי' },
  { to: '/flows', icon: Zap, label: 'אוטומציות' },
  { to: '/team', icon: UsersRound, label: 'צוות' },
  { to: '/whatsapp', icon: Smartphone, label: 'WhatsApp' },
  { to: '/contacts', icon: Users, label: 'אנשי קשר' },
  { to: '/analytics', icon: BarChart3, label: 'אנליטיקס' },
  { to: '/settings', icon: Settings, label: 'הגדרות' },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200">
        <span className={cn('font-semibold text-gray-900 transition-opacity', !sidebarOpen && 'opacity-0 w-0 overflow-hidden')}>
          AI Comm
        </span>
        <button
          onClick={() => { setSidebarOpen(!sidebarOpen); setMobileOpen(false); }}
          className="p-1 text-gray-500 hover:text-gray-700 hidden lg:block"
        >
          <ChevronRight size={18} className={cn('transition-transform', sidebarOpen && 'rotate-180')} />
        </button>
        <button onClick={() => setMobileOpen(false)} className="p-1 text-gray-500 lg:hidden">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )
            }
          >
            <item.icon size={18} />
            <span className={cn('transition-opacity', !sidebarOpen && 'lg:opacity-0 lg:w-0 lg:overflow-hidden')}>
              {item.label}
            </span>
          </NavLink>
        ))}
      </div>

      <div className="p-3 border-t border-gray-200">
        <div className={cn('flex items-center gap-2 px-2 mb-2', !sidebarOpen && 'lg:justify-center')}>
          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-medium text-primary-700">
            {user?.email?.[0]?.toUpperCase() || 'A'}
          </div>
          <span className={cn('text-xs text-gray-600 truncate', !sidebarOpen && 'lg:hidden')}>
            {user?.email || 'admin'}
          </span>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <LogOut size={16} />
          <span className={cn(!sidebarOpen && 'lg:hidden')}>התנתק</span>
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={cn(
        'fixed inset-y-0 right-0 z-50 w-64 bg-white border-s border-gray-200 transform transition-transform lg:hidden',
        mobileOpen ? 'translate-x-0' : 'translate-x-full'
      )}>
        {sidebar}
      </aside>

      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col bg-white border-s border-gray-200 transition-all duration-200',
        sidebarOpen ? 'w-60' : 'w-16'
      )}>
        {sidebar}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center h-14 px-4 bg-white border-b border-gray-200 gap-3">
          <button onClick={() => setMobileOpen(true)} className="p-1 text-gray-500 hover:text-gray-700 lg:hidden">
            <Menu size={20} />
          </button>
          <div className="flex-1" />
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
