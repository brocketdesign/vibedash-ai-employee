"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Link2,
  Unlink,
  RefreshCw,
  Sparkles,
  Loader2,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Project, UserDataViewConfig } from "@/types";
import { formatDistanceToNow } from "date-fns";

interface UserDataConnectProps {
  project: Project;
  onUpdate: (data: Partial<Project>) => void;
  onViewConfigChange?: (config: UserDataViewConfig | null) => void;
}

interface ConnectionState {
  connected: boolean;
  externalApiUrl?: string;
  connectedAt?: string;
  lastFetchedAt?: string;
  cachedData?: Record<string, unknown> | null;
  viewConfig?: UserDataViewConfig | null;
}

export function UserDataConnect({ project, onUpdate, onViewConfigChange }: UserDataConnectProps) {
  const [connection, setConnection] = useState<ConnectionState>({ connected: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ hasToken: boolean; tokenPrefix?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadConnection = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/user-data`);
      if (res.ok) {
        const data = await res.json();
        setConnection(data);
        if (data.viewConfig && onViewConfigChange) {
          onViewConfigChange(data.viewConfig);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [project.id, onViewConfigChange]);

  const loadTokenInfo = useCallback(async () => {
    const res = await fetch("/api/user/connection-token");
    if (res.ok) {
      const data = await res.json();
      setTokenInfo(data);
    }
  }, []);

  useEffect(() => {
    loadConnection();
    loadTokenInfo();
  }, [loadConnection, loadTokenInfo]);

  const handleConnect = async () => {
    if (!urlInput.trim()) return;
    setIsConnecting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/user-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalApiUrl: urlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to connect");
      setConnection({ connected: true, externalApiUrl: urlInput.trim(), connectedAt: data.connectedAt });
      onUpdate({ userDataConnection: { externalApiUrl: urlInput.trim(), connectedAt: data.connectedAt } });
      setIsSetupOpen(false);
      setUrlInput("");
      toast.success("Connected!", { description: "Now click 'Fetch Data' to pull user stats." });
    } catch (err) {
      toast.error("Connection failed", { description: (err as Error).message });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await fetch(`/api/projects/${project.id}/user-data`, { method: "DELETE" });
      setConnection({ connected: false });
      onUpdate({ userDataConnection: undefined });
      if (onViewConfigChange) onViewConfigChange(null);
      toast.success("Disconnected");
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleFetch = async () => {
    setIsFetching(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/user-data/fetch`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fetch failed");
      setConnection((prev) => ({ ...prev, cachedData: data.data, lastFetchedAt: data.fetchedAt }));
      toast.success("Data fetched!", { description: "Click 'Generate View' to build your dashboard." });
    } catch (err) {
      toast.error("Fetch failed", { description: (err as Error).message });
    } finally {
      setIsFetching(false);
    }
  };

  const handleGenerateView = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/user-data/generate-view`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "View generation failed");
      setConnection((prev) => ({ ...prev, viewConfig: data.viewConfig }));
      if (onViewConfigChange) onViewConfigChange(data.viewConfig);
      toast.success("View generated!", { description: "AI built a custom dashboard for your user data." });
    } catch (err) {
      toast.error("Generation failed", { description: (err as Error).message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToken = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-500" />
              <CardTitle className="text-base">User Data</CardTitle>
              {connection.connected && (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Connected</Badge>
              )}
            </div>
            {connection.connected ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl"
                  disabled={isFetching}
                  onClick={handleFetch}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                  {isFetching ? "Fetching…" : "Fetch Data"}
                </Button>
                {connection.cachedData && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-xl"
                    disabled={isGenerating}
                    onClick={handleGenerateView}
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                    {isGenerating ? "Generating…" : connection.viewConfig ? "Regenerate View" : "Generate View"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 rounded-xl text-destructive hover:text-destructive"
                  disabled={isDisconnecting}
                  onClick={handleDisconnect}
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={() => setIsSetupOpen(true)}
              >
                <Link2 className="h-3.5 w-3.5" />
                Connect
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {connection.connected ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/50 p-3 text-xs font-mono text-muted-foreground break-all">
                {connection.externalApiUrl}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {connection.connectedAt && (
                  <span>Connected {formatDistanceToNow(new Date(connection.connectedAt), { addSuffix: true })}</span>
                )}
                {connection.lastFetchedAt && (
                  <span>· Last fetched {formatDistanceToNow(new Date(connection.lastFetchedAt), { addSuffix: true })}</span>
                )}
              </div>
              {connection.cachedData && !connection.viewConfig && (
                <div className="flex items-start gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-xs text-violet-700 dark:text-violet-300">
                  <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Data fetched! Click <strong className="mx-0.5">Generate View</strong> to let AI build a custom dashboard for this project.
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <Users className="h-10 w-10 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium">No user data connected</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Add one API endpoint to your project, enter its URL here, and VibeDash will pull user stats on demand.
                </p>
              </div>
              <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => setIsSetupOpen(true)}>
                <Link2 className="h-3.5 w-3.5" />
                Connect Project
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-500" />
              Connect User Data
            </DialogTitle>
            <DialogDescription>
              Two steps: set up an endpoint in your external project, then paste its URL here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Step 1 — Token */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">1</span>
                <p className="text-sm font-semibold">Your VibeDash Connection Token</p>
              </div>
              <p className="text-xs text-muted-foreground pl-7">
                This token identifies you. Copy it into the <code className="bg-muted px-1 rounded">VIBEDASH_TOKEN</code> env variable of your external project.
              </p>
              {tokenInfo?.hasToken ? (
                <div className="ml-7 flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
                  <code className="flex-1 text-xs text-muted-foreground">{tokenInfo.tokenPrefix}</code>
                  <span className="text-[10px] text-muted-foreground">(hidden for security)</span>
                </div>
              ) : (
                <div className="ml-7 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  No token yet. Go to <strong className="mx-0.5">Settings → User Data</strong> to generate your token first.
                </div>
              )}
            </div>

            {/* Step 2 — Endpoint code */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">2</span>
                <p className="text-sm font-semibold">Add this route to your external project</p>
              </div>
              <div className="ml-7 relative">
                <pre className="rounded-xl bg-muted p-3 text-[10px] leading-relaxed overflow-x-auto text-muted-foreground">{`// app/api/vibedash/users/route.ts
export async function GET(req: Request) {
  const token = req.headers.get('authorization')
    ?.replace('Bearer ', '');
  if (token !== process.env.VIBEDASH_TOKEN)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });

  return Response.json({
    meta: { projectName: 'My App' },
    summary: {
      totalUsers: 150, premiumUsers: 30,
      newUsersToday: 5, newUsersThisMonth: 80,
    },
    metrics: { /* your custom data */ },
    // users: [...] // optional, for table views
  });
}`}</pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 rounded-lg"
                  onClick={() => handleCopyToken(`// app/api/vibedash/users/route.ts
export async function GET(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (token !== process.env.VIBEDASH_TOKEN)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json({
    meta: { projectName: 'My App' },
    summary: { totalUsers: 150, premiumUsers: 30, newUsersToday: 5, newUsersThisMonth: 80 },
    metrics: {},
  });
}`)}
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {/* Step 3 — URL */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">3</span>
                <p className="text-sm font-semibold">Enter the full URL of that endpoint</p>
              </div>
              <div className="ml-7 space-y-1.5">
                <Label htmlFor="api-url" className="text-xs">Endpoint URL</Label>
                <Input
                  id="api-url"
                  placeholder="https://myapp.com/api/vibedash/users"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="rounded-xl text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setIsSetupOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl gap-1.5"
              disabled={!urlInput.trim() || isConnecting || !tokenInfo?.hasToken}
              onClick={handleConnect}
            >
              {isConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isConnecting ? "Connecting…" : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
