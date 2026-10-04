"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  AlertTriangle,
  BookOpen,
  Clock,
  Activity,
} from "lucide-react";
import { useIsDemo } from "@/lib/demo-context";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  usageCount: number;
  revoked: boolean;
}

export default function ApiKeysPage() {
  const isDemo = useIsDemo();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    if (isDemo) {
      setKeys([
        {
          id: "demo-1",
          name: "Production Key",
          prefix: "vd_a3b2c4...d1e2",
          createdAt: "2026-01-15T10:00:00Z",
          lastUsedAt: "2026-02-17T14:30:00Z",
          usageCount: 247,
          revoked: false,
        },
        {
          id: "demo-2",
          name: "Development Key",
          prefix: "vd_f5g6h7...i8j9",
          createdAt: "2026-02-01T08:00:00Z",
          lastUsedAt: "2026-02-18T09:15:00Z",
          usageCount: 89,
          revoked: false,
        },
      ]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/api-keys");
      if (res.ok) {
        setKeys(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch keys:", err);
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (isDemo) return;
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.key);
        setNewKeyName("");
        fetchKeys();
      }
    } catch (err) {
      console.error("Failed to create key:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (isDemo) return;
    try {
      const res = await fetch(`/api/api-keys?id=${keyId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchKeys();
        setDeleteConfirm(null);
      }
    } catch (err) {
      console.error("Failed to revoke key:", err);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const activeKeys = keys.filter((k) => !k.revoked);
  const revokedKeys = keys.filter((k) => k.revoked);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Manage your API keys for programmatic access to VibeDash
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/docs/api" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="rounded-xl gap-2">
              <BookOpen className="h-4 w-4" />
              API Docs
              <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setCreatedKey(null);
                setNewKeyName("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="rounded-xl gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {createdKey ? "API Key Created" : "Create New API Key"}
                </DialogTitle>
                <DialogDescription>
                  {createdKey
                    ? "Copy your API key now. You won't be able to see it again."
                    : "Give your API key a name to identify it later."}
                </DialogDescription>
              </DialogHeader>

              {createdKey ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-200">
                      Save this key somewhere safe. It will only be shown once.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-muted p-3 text-xs font-mono break-all">
                      {createdKey}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 rounded-lg"
                      onClick={() => copyToClipboard(createdKey)}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    className="w-full rounded-xl"
                    onClick={() => {
                      setDialogOpen(false);
                      setCreatedKey(null);
                    }}
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="keyName">Key Name</Label>
                    <Input
                      id="keyName"
                      placeholder="e.g., Production, CI/CD, Client Demo"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="rounded-xl"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreate();
                      }}
                    />
                  </div>
                  <Button
                    className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                    onClick={handleCreate}
                    disabled={creating || isDemo}
                  >
                    {creating ? "Creating..." : "Create Key"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick Start */}
      <Card className="rounded-2xl border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-indigo-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Start</CardTitle>
          <CardDescription>
            Use your API key to access VibeDash programmatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-muted p-4 font-mono text-xs space-y-1">
            <p className="text-muted-foreground"># List your projects</p>
            <p>
              curl -H &quot;Authorization: Bearer vd_your_key_here&quot; \
            </p>
            <p className="pl-4">
              {typeof window !== "undefined"
                ? window.location.origin
                : "https://your-domain.com"}
              /api/v1/projects
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Active Keys */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            Active Keys
            <Badge variant="secondary" className="rounded-full text-xs">
              {activeKeys.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Loading...
            </div>
          ) : activeKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Key className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No API keys yet. Create one to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{key.name}</span>
                      <Badge
                        variant="outline"
                        className="rounded-full text-[10px] text-green-500 border-green-500/30"
                      >
                        Active
                      </Badge>
                    </div>
                    <code className="text-xs text-muted-foreground font-mono">
                      {key.prefix}
                    </code>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created {formatDate(key.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {key.usageCount} requests
                      </span>
                      {key.lastUsedAt && (
                        <span>Last used {formatDate(key.lastUsedAt)}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    {deleteConfirm === key.id ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="rounded-lg text-xs"
                          onClick={() => handleRevoke(key.id)}
                        >
                          Confirm Revoke
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg text-xs"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-lg text-muted-foreground hover:text-red-500"
                        onClick={() => setDeleteConfirm(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoked Keys */}
      {revokedKeys.length > 0 && (
        <Card className="rounded-2xl opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Revoked Keys
              <Badge variant="secondary" className="rounded-full text-xs">
                {revokedKeys.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {revokedKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-xl border border-dashed p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm line-through">
                        {key.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="rounded-full text-[10px] text-red-500 border-red-500/30"
                      >
                        Revoked
                      </Badge>
                    </div>
                    <code className="text-xs text-muted-foreground font-mono">
                      {key.prefix}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
