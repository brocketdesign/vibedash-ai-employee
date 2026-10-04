"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useIsDemo } from "@/lib/demo-context";
import {
  LayoutDashboard,
  FolderKanban,
  GitBranch,
  Megaphone,
  Sparkles,
  Settings,
  Zap,
  Crown,
  Columns3,
  LogIn,
  LogOut,
  KeyRound,
  Users,
} from "lucide-react";
import { usePlan } from "@/lib/hooks";

const navigation = [
  { name: "Overview", href: "/workspace", icon: LayoutDashboard },
  { name: "Projects", href: "/workspace/projects", icon: FolderKanban },
  { name: "Pipeline", href: "/workspace/pipeline", icon: Columns3 },
  { name: "Users", href: "/workspace/users", icon: Users },
  { name: "Marketing", href: "/workspace/marketing", icon: Megaphone },
  { name: "GitHub", href: "/workspace/github", icon: GitBranch },
  { name: "AI Advisor", href: "/workspace/ai-advisor", icon: Sparkles, premium: true },
  { name: "API Keys", href: "/workspace/api-keys", icon: KeyRound },
  { name: "Settings", href: "/workspace/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const isDemo = useIsDemo();
  const { plan } = usePlan();
  const isPro = plan === "pro" || plan === "trial";

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4">
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">VibeDash</h1>
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Vibe Coding Manager
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-1">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/workspace" && pathname.startsWith(item.href));
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-x-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive
                          ? "text-primary-foreground"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    {item.name}
                    {item.premium && (
                      <Crown className="ml-auto h-3.5 w-3.5 text-amber-500" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Pro upgrade card */}
          <div className="mt-auto space-y-3">
            {isDemo && (
              <div className="flex flex-col gap-2">
                <Link
                  href="/login"
                  className="flex items-center gap-x-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
                >
                  <LogIn className="h-4 w-4 shrink-0" />
                  Sign In
                </Link>
                <Link
                  href="/"
                  className="flex items-center gap-x-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
                  onClick={() => {
                    document.cookie = "demo_mode=; path=/; max-age=0";
                  }}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Exit Demo
                </Link>
              </div>
            )}
            {isPro ? (
              <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold">Pro Plan</span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  You have access to all premium features.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 p-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold">Upgrade to Pro</span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Unlock AI Advisor, unlimited projects, and advanced analytics.
                </p>
                <button className="mt-3 w-full rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40">
                  Upgrade Now
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </aside>
  );
}
