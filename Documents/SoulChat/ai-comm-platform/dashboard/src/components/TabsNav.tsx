import type { ElementType } from 'react';
import { cn } from '../lib/utils';

interface Tab {
  key: string;
  label: string;
  icon?: ElementType;
  badge?: number;
}

interface TabsNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
}

export function TabsNav({ tabs, activeTab, onTabChange, className }: TabsNavProps) {
  return (
    <nav className={cn('flex gap-1 border-b border-gray-200', className)} dir="rtl">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        const Icon = tab.icon;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
              'hover:text-gray-900 focus:outline-none',
              isActive ? 'text-blue-600' : 'text-gray-500',
            )}
          >
            {Icon && <Icon size={16} />}
            <span>{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && (
              <span className="mr-1 inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {tab.badge}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
