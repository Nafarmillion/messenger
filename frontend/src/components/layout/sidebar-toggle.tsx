'use client';

import React, { useEffect } from 'react';
import { useUIStore } from '@/store';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';

export function SidebarToggle() {
  const { sidebarCollapsed, toggleSidebar, sidebarOpen, setSidebarOpen, isMobile } = useUIStore();

  const handleClick = () => {
    if (isMobile) {
      setSidebarOpen(!sidebarOpen);
    } else {
      toggleSidebar();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'p-2 rounded-lg hover:bg-accent hover:text-accent-foreground',
        'transition-colors duration-200',
        'lg:ml-2'
      )}
      aria-label={isMobile ? 'Open menu' : 'Toggle sidebar'}
    >
      <Icons.Menu />
    </button>
  );
}
