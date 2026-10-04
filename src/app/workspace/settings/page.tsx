"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  User,
  Mail,
  Key,
  GitBranch,
  CreditCard,
  Crown,
  Check,
  Zap,
  Shield,
  Clock,
  Bell,
  Palette,
  Globe,
  Link2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Calendar,
  Send,
  Loader2,
  Plus,
  Target,
} from "lucide-react";

import { usePlan } from "@/lib/hooks";

export default function SettingsPage() {
  const { plan } = usePlan();
  const isPro = plan === "pro";

  // ── Notification state ──────────────────────────────────
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [clerkEmail, setClerkEmail] = useState("");
  const [notifSettings, setNotifSettings] = useState({
    projectUpdates: true,
    githubActivity: true,
    marketingAlerts: true,
    aiInsights: true,
    weeklySummary: true,
    dailySummary: false,
    additionalEmail: "",
    top3Enabled: true,
    top3Email: true,
    top3InApp: true,
    top3DeliveryTime: "08:00",
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/user/notification-settings");
      if (res.ok) {
        const data = await res.json();
        setClerkEmail(data.clerkEmail || "");
        setNotifSettings(data.settings);
      }
    } catch (e) {
      console.error("Failed to load notification settings", e);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (updated: typeof notifSettings) => {
    setNotifSaving(true);
    try {
      await fetch("/api/user/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      setNotifSettings(updated);
    } catch (e) {
      console.error("Failed to save settings", e);
    } finally {
      setNotifSaving(false);
    }
  };

  const toggleSetting = (key: keyof typeof notifSettings) => {
    const updated = { ...notifSettings, [key]: !notifSettings[key] };
    setNotifSettings(updated);
    saveSettings(updated);
  };

  const sendTestEmail = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/email/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ ok: true, msg: `Test email sent to ${data.sentTo?.join(", ")}` });
      } else {
        setTestResult({ ok: false, msg: data.error || "Failed to send" });
      }
    } catch {
      setTestResult({ ok: false, msg: "Network error" });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account, integrations, and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="profile" className="rounded-lg">
            Profile
          </TabsTrigger>
          <TabsTrigger value="integrations" className="rounded-lg">
            Integrations
          </TabsTrigger>
          <TabsTrigger value="billing" className="rounded-lg">
            Billing
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg">
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-600 text-lg text-white">
                    VC
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm" className="rounded-xl">
                    Change Avatar
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    JPG, PNG, or GIF. Max 2MB.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    defaultValue="Vibe Coder"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    defaultValue="you@example.com"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    defaultValue="vibecoder"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    defaultValue="https://example.com"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Password</p>
                    <p className="text-xs text-muted-foreground">
                      Last changed 30 days ago
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl">
                  Change Password
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      Two-Factor Authentication
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Add an extra layer of security
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl">
                  Enable 2FA
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connected Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* GitHub */}
              <div className="flex items-center justify-between rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 dark:bg-white">
                    <GitBranch className="h-5 w-5 text-white dark:text-gray-900" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">GitHub</p>
                    <p className="text-xs text-muted-foreground">
                      Connected as @vibecoder
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="gap-1 border-green-500/30 text-green-500">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              </div>

              {/* Stripe */}
              <div className="flex items-center justify-between rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
                    <CreditCard className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Stripe</p>
                    <p className="text-xs text-muted-foreground">
                      Payment processing
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                  <Link2 className="h-3.5 w-3.5" />
                  Connect
                </Button>
              </div>

              {/* Google Ads */}
              <div className="flex items-center justify-between rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500">
                    <Globe className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Google Ads</p>
                    <p className="text-xs text-muted-foreground">
                      Ad campaign management
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                  <Link2 className="h-3.5 w-3.5" />
                  Connect
                </Button>
              </div>

              {/* OpenAI */}
              <div className="flex items-center justify-between rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-800">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">OpenAI</p>
                    <p className="text-xs text-muted-foreground">
                      AI Advisor integration
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                  <Link2 className="h-3.5 w-3.5" />
                  Connect
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Keys</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" size="sm" className="rounded-xl">
                Save API Keys
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing" className="space-y-4">
          {/* Current plan */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "flex items-center justify-between rounded-xl border-2 p-4",
                isPro
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-violet-500/30 bg-violet-500/5"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br",
                    isPro
                      ? "from-amber-500 to-orange-600"
                      : "from-violet-600 to-indigo-600"
                  )}>
                    {isPro ? <Crown className="h-5 w-5 text-white" /> : <Zap className="h-5 w-5 text-white" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{isPro ? "Pro Plan" : "Free Plan"}</p>
                      <Badge
                        variant="secondary"
                        className={cn("text-[10px]", isPro && "bg-amber-500/15 text-amber-600")}
                      >
                        Current
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isPro
                        ? "Unlimited projects, AI Advisor, advanced analytics"
                        : "Up to 3 projects, basic analytics"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Free */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-bold">Free</h3>
                <p className="mt-1 text-3xl font-bold">
                  $0<span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <Separator className="my-4" />
                <ul className="space-y-2">
                  {["Up to 3 projects", "Basic analytics", "GitHub integration", "Email support"].map(
                    (feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    )
                  )}
                </ul>
                <Button
                  variant="outline"
                  className="mt-6 w-full rounded-xl"
                  disabled={!isPro}
                >
                  {isPro ? "Downgrade" : "Current Plan"}
                </Button>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="relative border-2 border-violet-500">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
                  Most Popular
                </Badge>
              </div>
              <CardContent className="p-6">
                <h3 className="text-lg font-bold">Pro</h3>
                <p className="mt-1 text-3xl font-bold">
                  $19<span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <Separator className="my-4" />
                <ul className="space-y-2">
                  {[
                    "Unlimited projects",
                    "AI Advisor",
                    "Advanced analytics",
                    "Marketing hub",
                    "Priority support",
                    "Custom domains",
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn(
                    "mt-6 w-full rounded-xl",
                    isPro
                      ? ""
                      : "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25"
                  )}
                  variant={isPro ? "outline" : "default"}
                  disabled={isPro}
                >
                  {isPro ? "Current Plan" : "Upgrade to Pro"}
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-bold">Enterprise</h3>
                <p className="mt-1 text-3xl font-bold">
                  $49<span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <Separator className="my-4" />
                <ul className="space-y-2">
                  {[
                    "Everything in Pro",
                    "Team collaboration",
                    "Custom AI models",
                    "API access",
                    "White-label option",
                    "Dedicated support",
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="mt-6 w-full rounded-xl">
                  Contact Sales
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4">
          {/* Email Delivery */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email Delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Primary Clerk email */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Primary Email (from your account)</Label>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {notifLoading ? "Loading…" : clerkEmail || "No email found"}
                  </span>
                  <Badge variant="outline" className="ml-auto gap-1 border-green-500/30 text-green-500 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" /> Clerk
                  </Badge>
                </div>
              </div>

              {/* Additional email */}
              <div className="space-y-2">
                <Label htmlFor="additional-email" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Plus className="h-3 w-3" /> Additional Email (optional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="additional-email"
                    type="email"
                    placeholder="backup@example.com"
                    className="rounded-xl"
                    value={notifSettings.additionalEmail}
                    onChange={(e) =>
                      setNotifSettings({ ...notifSettings, additionalEmail: e.target.value })
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-xl"
                    disabled={notifSaving}
                    onClick={() => saveSettings(notifSettings)}
                  >
                    {notifSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  This email will also receive all enabled notifications alongside your primary email.
                </p>
              </div>

              {/* Sender info */}
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                <p className="text-xs text-muted-foreground">
                  📬 All emails are sent through Resend.
                </p>
              </div>

              {/* Test Email */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={sendTestEmail}
                  disabled={testSending}
                >
                  {testSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send Test Email
                </Button>
                {testResult && (
                  <span className={cn("text-xs font-medium", testResult.ok ? "text-green-600" : "text-red-500")}>
                    {testResult.ok ? "✅" : "❌"} {testResult.msg}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {([
                {
                  key: "dailySummary" as const,
                  title: "Daily Summary",
                  description:
                    "Receive a daily email digest with project stats, AI insights, and campaign updates",
                  icon: Calendar,
                  badge: "New",
                },
                {
                  key: "projectUpdates" as const,
                  title: "Project Updates",
                  description:
                    "Get notified when projects change phases or hit milestones",
                  icon: Zap,
                },
                {
                  key: "githubActivity" as const,
                  title: "GitHub Activity",
                  description:
                    "Notifications for new commits, issues, and pull requests",
                  icon: GitBranch,
                },
                {
                  key: "marketingAlerts" as const,
                  title: "Marketing Alerts",
                  description:
                    "Campaign performance updates and budget warnings",
                  icon: Bell,
                },
                {
                  key: "aiInsights" as const,
                  title: "AI Insights",
                  description:
                    "New recommendations from the AI Advisor",
                  icon: Sparkles,
                },
                {
                  key: "weeklySummary" as const,
                  title: "Weekly Summary",
                  description:
                    "Weekly digest of all project activity",
                  icon: Mail,
                },
              ] as const).map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-xl border border-border p-4"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{item.title}</p>
                        {"badge" in item && item.badge && (
                          <Badge className="bg-gradient-to-r from-violet-600 to-indigo-600 text-[10px] text-white px-1.5 py-0">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!notifSettings[item.key]}
                    onClick={() => toggleSetting(item.key)}
                    className={cn(
                      "flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors",
                      notifSettings[item.key] ? "bg-violet-600" : "bg-gray-300 dark:bg-gray-600"
                    )}
                  >
                    <div
                      className={cn(
                        "h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                        notifSettings[item.key] ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Today's Top 3 Delivery Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-amber-500" />
                Today&apos;s Top 3 Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Master toggle */}
              <div className="flex items-center justify-between rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">Daily Top 3 Actions</p>
                    <p className="text-xs text-muted-foreground">
                      AI-generated highest-impact actions delivered daily
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!notifSettings.top3Enabled}
                  onClick={() => toggleSetting("top3Enabled")}
                  className={cn(
                    "flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors",
                    notifSettings.top3Enabled ? "bg-violet-600" : "bg-gray-300 dark:bg-gray-600"
                  )}
                >
                  <div className={cn("h-5 w-5 rounded-full bg-white shadow-sm transition-transform", notifSettings.top3Enabled ? "translate-x-5" : "translate-x-0")} />
                </button>
              </div>

              {notifSettings.top3Enabled && (
                <>
                  {/* Channel toggles */}
                  <div className="flex items-center justify-between rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Email Delivery</p>
                        <p className="text-xs text-muted-foreground">Send Top 3 via email</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!notifSettings.top3Email}
                      onClick={() => toggleSetting("top3Email")}
                      className={cn(
                        "flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors",
                        notifSettings.top3Email ? "bg-violet-600" : "bg-gray-300 dark:bg-gray-600"
                      )}
                    >
                      <div className={cn("h-5 w-5 rounded-full bg-white shadow-sm transition-transform", notifSettings.top3Email ? "translate-x-5" : "translate-x-0")} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">In-App Notification</p>
                        <p className="text-xs text-muted-foreground">Show banner in dashboard</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!notifSettings.top3InApp}
                      onClick={() => toggleSetting("top3InApp")}
                      className={cn(
                        "flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors",
                        notifSettings.top3InApp ? "bg-violet-600" : "bg-gray-300 dark:bg-gray-600"
                      )}
                    >
                      <div className={cn("h-5 w-5 rounded-full bg-white shadow-sm transition-transform", notifSettings.top3InApp ? "translate-x-5" : "translate-x-0")} />
                    </button>
                  </div>

                  {/* Delivery time */}
                  <div className="flex items-center justify-between rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Delivery Time</p>
                        <p className="text-xs text-muted-foreground">When to refresh & send Top 3</p>
                      </div>
                    </div>
                    <Input
                      type="time"
                      value={notifSettings.top3DeliveryTime}
                      onChange={(e) => {
                        const updated = { ...notifSettings, top3DeliveryTime: e.target.value };
                        setNotifSettings(updated);
                        saveSettings(updated);
                      }}
                      className="w-28 rounded-xl text-sm"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
