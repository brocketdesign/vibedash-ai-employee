"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Globe, Link2Off, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DomainLinkButtonProps {
  domain?: string;
  /** Called when user sets/updates the domain. Return a promise to show loading state. */
  onDomainChange?: (domain: string) => Promise<void>;
  /** Size variant */
  size?: "sm" | "md";
  className?: string;
}

function ensureProtocol(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function DomainLinkButton({
  domain,
  onDomainChange,
  size = "sm",
  className,
}: DomainLinkButtonProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(domain || "");
  const [saving, setSaving] = useState(false);
  // Optimistic local domain so the icon switches instantly after save
  const [optimisticDomain, setOptimisticDomain] = useState<string | undefined>(domain);

  // Keep optimistic state in sync when the prop changes from parent
  const prevDomainRef = useRef(domain);
  useEffect(() => {
    if (domain !== prevDomainRef.current) {
      prevDomainRef.current = domain;
      setOptimisticDomain(domain);
    }
  }, [domain]);

  const effectiveDomain = optimisticDomain ?? domain;
  const hasDomain = !!effectiveDomain?.trim();

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const btnSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  const handleSave = async () => {
    if (!onDomainChange || !value.trim()) return;
    setSaving(true);
    try {
      // Optimistically update immediately so the icon changes right away
      setOptimisticDomain(value.trim());
      setOpen(false);
      await onDomainChange(value.trim());
    } catch (err) {
      // Revert on failure
      setOptimisticDomain(domain);
      console.error("Failed to save domain:", err);
    } finally {
      setSaving(false);
    }
  };

  // If there's a domain set, render a simple link button that opens in new tab
  if (hasDomain) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(effectiveDomain || ""); }}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(btnSize, "relative group/domain", className)}
                  onClick={(e) => {
                    // Left-click opens the domain; right-click or popover to edit
                    if (!e.shiftKey) {
                      e.preventDefault();
                      window.open(ensureProtocol(effectiveDomain!), "_blank", "noopener,noreferrer");
                    }
                  }}
                  onContextMenu={(e) => {
                    // Right-click to edit
                    e.preventDefault();
                    setOpen(true);
                    setValue(effectiveDomain || "");
                  }}
                >
                  <Globe className={cn(iconSize, "text-emerald-500")} />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>{effectiveDomain}</p>
              <p className="text-muted-foreground">Click to open · Shift+click to edit</p>
            </TooltipContent>
            <PopoverContent className="w-72 p-3" align="end">
              <p className="text-xs font-medium mb-2">Edit domain</p>
              <div className="flex gap-2">
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="example.com"
                  className="h-8 text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                  autoFocus
                />
                <Button
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleSave}
                  disabled={saving || !value.trim()}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // No domain set: show a muted icon that opens a popover to set it
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(""); }}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(btnSize, "relative", className)}
              >
                <Globe className={cn(iconSize, "text-muted-foreground/50")} />
                <Link2Off className="h-2 w-2 absolute -bottom-0 -right-0 text-muted-foreground/60" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            No domain set — click to add
          </TooltipContent>
          <PopoverContent className="w-72 p-3" align="end">
            <p className="text-xs font-medium mb-2">Set project domain</p>
            <div className="flex gap-2">
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="example.com"
                className="h-8 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                autoFocus
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleSave}
                disabled={saving || !value.trim()}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </Tooltip>
    </TooltipProvider>
  );
}
