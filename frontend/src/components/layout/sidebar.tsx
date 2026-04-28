"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore, useAuthStore } from "@/store";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MenuItem {
  href: string;
  icon: React.ReactNode;
  label: string;
}

interface SidebarProps {
  menuItems: MenuItem[];
}

export function Sidebar({ menuItems }: SidebarProps) {
  const pathname = usePathname();
  const {
    sidebarCollapsed,
    sidebarOpen,
    isMobile,
    toggleSidebar,
    setSidebarOpen,
  } = useUIStore();
  const { user } = useAuthStore();

  const handleMenuClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full bg-background border-r border-border z-50",
          "transition-all duration-300 ease-in-out",
          "lg:flex lg:flex-col",
          isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0",
          !isMobile && sidebarCollapsed ? "w-16" : "w-64",
          isMobile ? "w-64" : "",
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center h-16 px-4 border-b border-border",
            sidebarCollapsed && !isMobile && "justify-center px-2",
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-sm">
                M
              </span>
            </div>
            {(!sidebarCollapsed || isMobile) && (
              <span className="font-semibold text-lg truncate">Messenger</span>
            )}
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 py-4 px-2">
          {menuItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleMenuClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1",
                  "transition-colors duration-200",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-accent text-accent-foreground",
                  sidebarCollapsed && !isMobile && "justify-center px-2",
                )}
              >
                <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </span>
                {(!sidebarCollapsed || isMobile) && (
                  <span className="flex-1 truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div
          className={cn(
            "p-4 border-t border-border",
            sidebarCollapsed && !isMobile && "px-2",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3",
              sidebarCollapsed && !isMobile && "justify-center",
            )}
          >
            <Avatar className="w-8 h-8 flex-shrink-0">
              {user?.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.firstName} />
              ) : (
                <AvatarFallback className="text-sm bg-secondary">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </AvatarFallback>
              )}
            </Avatar>
            {(!sidebarCollapsed || isMobile) && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  @{user?.username}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
