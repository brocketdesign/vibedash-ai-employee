"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, ExternalLink, Unlink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { GoogleAnalyticsProperty, Project } from "@/types";

interface GoogleAnalyticsConnectProps {
  project: Project;
  onUpdate: (data: Partial<Project>) => void;
}

export function GoogleAnalyticsConnect({
  project,
  onUpdate,
}: GoogleAnalyticsConnectProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [properties, setProperties] = useState<GoogleAnalyticsProperty[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  const isConnected = !!project.googleAnalytics?.propertyId;

  const loadProperties = useCallback(async () => {
    setIsLoadingProperties(true);
    setLoadError(null);
    setNeedsReconnect(false);
    try {
      const res = await fetch(
        `/api/google-analytics/properties?projectId=${project.id}`
      );
      if (!res.ok) {
        const data = await res.json();
        const errMsg = data.error || "Failed to load properties";
        // Check if user needs to reconnect (expired token or not connected)
        if (res.status === 401 || res.status === 404) {
          setNeedsReconnect(true);
          setLoadError(errMsg);
        } else {
          setLoadError(errMsg);
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      setProperties(data);
      if (data.length === 0) {
        toast.info("No GA4 properties found", {
          description:
            "Make sure your Google account has access to GA4 properties.",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to load properties", { description: msg });
    } finally {
      setIsLoadingProperties(false);
    }
  }, [project.id]);

  // Check if we just came back from OAuth (URL has ?ga_connected=true)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ga_connected") === "true") {
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("ga_connected");
      window.history.replaceState({}, "", url.pathname);
      // Open property picker
      setIsPickerOpen(true);
      loadProperties();
    }
  }, [loadProperties]);

  const handleConnect = () => {
    // Redirect to Google OAuth
    window.location.href = `/api/google-analytics/connect?projectId=${project.id}`;
  };

  const handleLinkProperty = async () => {
    if (!selectedProperty) return;
    setIsLinking(true);
    try {
      const prop = properties.find((p) => p.propertyId === selectedProperty);
      const res = await fetch("/api/google-analytics/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          propertyId: selectedProperty,
          propertyName: prop?.displayName || "GA4 Property",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to link property");
      }
      const data = await res.json();
      onUpdate({
        googleAnalytics: data.googleAnalytics,
        monthlyVisitors: data.analyticsData.monthlyVisitors,
      });
      setIsPickerOpen(false);
      toast.success("Google Analytics connected!", {
        description: `Linked to ${prop?.displayName || "GA4 Property"}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to link property", { description: msg });
    } finally {
      setIsLinking(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/google-analytics/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      onUpdate({ googleAnalytics: undefined });
      toast.success("Google Analytics disconnected");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to disconnect", { description: msg });
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="gap-1.5 border-green-500/30 text-green-600 dark:text-green-400"
        >
          <BarChart3 className="h-3 w-3" />
          GA Connected: {project.googleAnalytics?.propertyName}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="h-7 px-2 text-muted-foreground hover:text-destructive"
        >
          {isDisconnecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Unlink className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleConnect}
        className="gap-2"
      >
        <BarChart3 className="h-4 w-4" />
        Connect Google Analytics
      </Button>

      {/* Property Picker Dialog */}
      <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Select GA4 Property</DialogTitle>
            <DialogDescription>
              Choose which Google Analytics property to link with{" "}
              <strong>{project.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {isLoadingProperties ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading properties…
              </span>
            </div>
          ) : loadError ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <p className="text-destructive">{loadError}</p>
              {needsReconnect ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={handleConnect}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Reconnect Google Account
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={loadProperties}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              )}
            </div>
          ) : properties.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <p>No GA4 properties found.</p>
              <p className="mt-1">
                Make sure your Google account has GA4 properties.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
                onClick={loadProperties}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Select
                value={selectedProperty}
                onValueChange={setSelectedProperty}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a property…" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((prop) => (
                    <SelectItem key={prop.propertyId} value={prop.propertyId}>
                      {prop.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsPickerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLinkProperty}
              disabled={!selectedProperty || isLinking}
              className="gap-2"
            >
              {isLinking && <Loader2 className="h-4 w-4 animate-spin" />}
              Link Property
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
