"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Bell, Menu, Search, Zap, LogIn, Shield, Crown as CrownIcon, Gem } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserButton, useUser } from "@clerk/nextjs";
import { useIsDemo } from "@/lib/demo-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  FolderKanban,
  GitBranch,
  Megaphone,
  Sparkles,
  Settings,
  Crown,
  Columns3,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { usePlan } from "@/lib/hooks";

const navigation = [
  { name: "Overview", href: "/workspace", icon: LayoutDashboard },
  { name: "Projects", href: "/workspace/projects", icon: FolderKanban },
  { name: "Pipeline", href: "/workspace/pipeline", icon: Columns3 },
  { name: "Marketing", href: "/workspace/marketing", icon: Megaphone },
  { name: "GitHub", href: "/workspace/github", icon: GitBranch },
  { name: "AI Advisor", href: "/workspace/ai-advisor", icon: Sparkles, premium: true },
  { name: "Settings", href: "/workspace/settings", icon: Settings },
];

export function Header() {
  const pathname = usePathname();
  const isDemo = useIsDemo();
  const { user: clerkUser } = useUser();
  const { plan: currentPlan, refetch: refetchPlan } = usePlan();

  // Admin panel state
  const [isDev, setIsDev] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);

  useEffect(() => {
    setIsDev(
      window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
    );
  }, []);

  const showAdmin = isDev && !isDemo;

  const fetchPlan = useCallback(async () => {
    await refetchPlan();
  }, [refetchPlan]);

  const togglePlan = async (plan: "free" | "trial" | "pro") => {
    setPlanLoading(true);
    try {
      const res = await fetch("/api/admin/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      // silent
    } finally {
      setPlanLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-card/80 px-4 backdrop-blur-xl sm:gap-x-6 sm:px-6 lg:px-8">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-full flex-col gap-y-5 overflow-y-auto bg-card px-6 pb-4">
            <div className="flex h-16 shrink-0 items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-lg font-bold">VibeDash</h1>
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-1">
                {navigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/workspace" &&
                      pathname.startsWith(item.href));
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-x-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.name}
                        {item.premium && (
                          <Crown className="ml-auto h-3.5 w-3.5 text-amber-500" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </SheetContent>
      </Sheet>

      {/* Search */}
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="relative flex flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search projects, tasks, campaigns..."
            className="h-9 w-full max-w-md rounded-xl border-none bg-muted pl-10 text-sm"
          />
        </div>
        <div className="flex items-center gap-x-2">
          {/* Admin menu — visible on localhost / dev only */}
          {showAdmin && (
            <DropdownMenu onOpenChange={(open) => open && fetchPlan()}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-lg text-amber-500 hover:text-amber-400"
                  title="Admin"
                >
                  <Shield className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  Admin Panel
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-2">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Subscription Plan
                  </p>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant={currentPlan === "free" ? "default" : "outline"}
                      className="flex-1 gap-1.5 text-xs"
                      disabled={planLoading}
                      onClick={() => togglePlan("free")}
                    >
                      Free
                    </Button>
                    <Button
                      size="sm"
                      variant={currentPlan === "trial" ? "default" : "outline"}
                      className="flex-1 gap-1.5 text-xs"
                      disabled={planLoading}
                      onClick={() => togglePlan("trial")}
                    >
                      Trial
                    </Button>
                    <Button
                      size="sm"
                      variant={currentPlan === "pro" ? "default" : "outline"}
                      className="flex-1 gap-1.5 text-xs"
                      disabled={planLoading}
                      onClick={() => togglePlan("pro")}
                    >
                      <CrownIcon className="h-3.5 w-3.5 text-amber-500" />
                      Pro
                    </Button>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground/60">
                    Current: <span className="font-semibold">{currentPlan}</span> · Dev mode
                  </p>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <ThemeToggle />

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-violet-500" />
          </Button>

          {/* User menu */}
          {isDemo ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-400">
                Demo Mode
              </span>
              <Link href="/login">
                <Button size="sm" variant="ghost" className="gap-1.5 rounded-xl text-xs">
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" variant="outline" className="gap-1.5 rounded-xl text-xs">
                  Sign Up
                </Button>
              </Link>
            </div>
          ) : (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: cn(
                    "h-8 w-8 rounded-full ring-2",
                    currentPlan === "pro" ? "ring-amber-500/50" : "ring-violet-500/20"
                  ),
                  userButtonPopoverCard: "bg-card border border-border rounded-xl shadow-xl",
                  userButtonPopoverActionButton: "text-foreground hover:bg-accent",
                  userButtonPopoverActionButtonText: "text-foreground",
                  userButtonPopoverActionButtonIconBox: "text-muted-foreground",
                  userButtonPopoverFooter: "hidden",
                },
              }}
              afterSignOutUrl="/"
            />
          )}
        </div>
      </div>
    </header>
  );
}
