"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  BookOpen,
  BarChart3,
  Settings,
  Layers,
  Activity,
  ChevronLeft,
  LogOut,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui.store";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/signals", label: "Signals", icon: Zap },
  { href: "/dashboard/watchlist", label: "Watchlist", icon: Eye },
  { href: "/dashboard/journal", label: "Journal", icon: BookOpen },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/strategies", label: "Strategies", icon: Layers },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300 ease-in-out",
        sidebarOpen ? "w-64" : "w-[68px]",
        // On mobile, when open, slide over content
        sidebarOpen && " md:z-auto",
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            T
          </div>
          {sidebarOpen && (
            <span className="text-lg font-bold tracking-tight">Tram</span>
          )}
        </Link>
      </div>

      {/* Scanner Status */}
      {sidebarOpen && (
        <div className="mx-3 mt-4 flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-2 text-xs">
          <Activity className="h-3.5 w-3.5 text-profit animate-pulse" />
          <span className="text-muted-foreground">Scanner Active</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "h-4.5 w-4.5 shrink-0",
                  isActive && "text-primary",
                )}
              />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );

          if (!sidebarOpen) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" />
          {sidebarOpen && <span>Log out</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 z-50 h-6 w-6 rounded-full border border-border bg-background shadow-sm hover:bg-accent"
      >
        <ChevronLeft
          className={cn(
            "h-3 w-3 transition-transform",
            !sidebarOpen && "rotate-180",
          )}
        />
      </Button>
    </aside>
  );
}
