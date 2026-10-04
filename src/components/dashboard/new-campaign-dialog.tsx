"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ALL_PLATFORMS, PLATFORM_LABELS } from "@/lib/constants";
import { Campaign, CampaignAIAnalysis, CampaignPlatform } from "@/types";
import {
  Plus,
  X,
  Loader2,
  Upload,
  ImageIcon,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Eye,
  MousePointerClick,
  Target,
} from "lucide-react";

// SVG icons for each platform
function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const cn2 = cn("h-5 w-5", className);
  switch (platform) {
    case "google":
      return (
        <svg className={cn2} viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      );
    case "facebook":
      return (
        <svg className={cn2} viewBox="0 0 24 24" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "instagram":
      return (
        <svg className={cn2} viewBox="0 0 24 24" fill="url(#ig-gradient)">
          <defs>
            <linearGradient id="ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFDC80" />
              <stop offset="25%" stopColor="#F77737" />
              <stop offset="50%" stopColor="#E1306C" />
              <stop offset="75%" stopColor="#C13584" />
              <stop offset="100%" stopColor="#833AB4" />
            </linearGradient>
          </defs>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
        </svg>
      );
    case "twitter":
      return (
        <svg className={cn2} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg className={cn2} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.55a8.26 8.26 0 0 0 4.76 1.5V6.69h-1z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg className={cn2} viewBox="0 0 24 24" fill="#0A66C2">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    case "youtube":
      return (
        <svg className={cn2} viewBox="0 0 24 24" fill="#FF0000">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case "pinterest":
      return (
        <svg className={cn2} viewBox="0 0 24 24" fill="#E60023">
          <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z" />
        </svg>
      );
    case "snapchat":
      return (
        <svg className={cn2} viewBox="0 0 24 24" fill="#FFFC00">
          <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.922-.254.068-.033.14-.05.2-.05.16 0 .3.06.42.176.12.12.18.27.18.42 0 .345-.345.6-1.12.78-.166.044-.37.09-.568.14-.18.044-.361.09-.468.135a.56.56 0 0 0-.3.27c-.027.06-.045.12-.075.18-.225.48-.42.885-1.14 1.005-.12.015-.24.03-.36.03-.245 0-.47-.045-.685-.105a5.614 5.614 0 0 0-1.5-.225c-.12 0-.24.015-.36.015-1.275.06-2.31.87-3.12 1.86a5.27 5.27 0 0 1-.345.39c-.36.375-.675.57-.93.57-.165 0-.32-.045-.44-.105-1.065-.54-1.395-2.16-1.44-2.73-.36-.09-.675-.195-.93-.285-.15-.06-.27-.12-.36-.165-.54-.24-.735-.57-.735-.885 0-.36.27-.57.585-.57.09 0 .18.015.255.03.39.12.78.24 1.155.21.12-.015.21-.03.285-.06a.42.42 0 0 0 .09-.06 8.16 8.16 0 0 1-.03-.51c-.015-.18-.027-.375-.042-.57-.105-1.62-.225-3.653.3-4.847C7.857 1.07 11.214.793 12.206.793z" />
        </svg>
      );
    case "reddit":
      return (
        <svg className={cn2} viewBox="0 0 24 24" fill="#FF4500">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
        </svg>
      );
    case "threads":
      return (
        <svg className={cn2} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.633-1.713.063.496.098 1.003.098 1.518-.017 2.254-.64 3.996-1.854 5.18-1.258 1.228-3.012 1.854-5.213 1.864h-.036c-1.86-.008-3.37-.556-4.489-1.63l1.345-1.498c.783.704 1.868 1.07 3.134 1.08h.039c1.597-.01 2.788-.42 3.54-1.222.768-.82 1.144-2.01 1.158-3.665 0-.094-.003-.189-.004-.283a6.05 6.05 0 0 0-3.088-.842c-2.05-.018-3.643.584-4.624 1.641-.63.676-.973 1.532-.973 2.464.03 1.927 1.532 3.2 3.781 3.223h.02c1.413-.012 2.576-.548 3.357-1.553.563-.727.876-1.643.932-2.688l2.05.106c-.084 1.442-.545 2.7-1.369 3.734-1.138 1.43-2.807 2.222-4.839 2.293a7.03 7.03 0 0 1-.169.002z" />
        </svg>
      );
    default:
      return <div className={cn("h-5 w-5 rounded-full bg-muted", className)} />;
  }
}

// Platform color backgrounds for selected state
const PLATFORM_BG: Record<string, string> = {
  google: "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800",
  facebook: "bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-800",
  instagram: "bg-pink-50 border-pink-300 dark:bg-pink-950/30 dark:border-pink-800",
  twitter: "bg-neutral-50 border-neutral-400 dark:bg-neutral-900/50 dark:border-neutral-600",
  tiktok: "bg-neutral-50 border-neutral-400 dark:bg-neutral-900/50 dark:border-neutral-600",
  linkedin: "bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-800",
  youtube: "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800",
  pinterest: "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800",
  snapchat: "bg-yellow-50 border-yellow-300 dark:bg-yellow-950/30 dark:border-yellow-800",
  reddit: "bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-800",
  threads: "bg-neutral-50 border-neutral-400 dark:bg-neutral-900/50 dark:border-neutral-600",
};

interface NewCampaignDialogProps {
  onCampaignCreated: (campaign: Campaign) => void;
  trigger?: React.ReactNode;
}

type DialogStep = "platform" | "details" | "analyze" | "results";

export function NewCampaignDialog({
  onCampaignCreated,
  trigger,
}: NewCampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<DialogStep>("platform");
  const [selectedPlatform, setSelectedPlatform] = useState<CampaignPlatform | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CampaignAIAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setStep("platform");
    setSelectedPlatform(null);
    setCampaignName("");
    setImages([]);
    setAnalyzing(false);
    setAnalysis(null);
    setError(null);
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetState();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    let processed = 0;

    Array.from(files).slice(0, 4 - images.length).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        newImages.push(reader.result as string);
        processed++;
        if (processed === Math.min(files.length, 4 - images.length)) {
          setImages((prev) => [...prev, ...newImages].slice(0, 4));
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (!selectedPlatform || !campaignName || images.length === 0) return;
    setAnalyzing(true);
    setError(null);
    setStep("analyze");

    try {
      const res = await fetch("/api/campaigns/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          platform: selectedPlatform,
          campaignName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Analysis failed");
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStep("details"); // go back so they can retry
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateCampaign = () => {
    if (!selectedPlatform || !campaignName) return;

    const campaign: Campaign = {
      id: `camp-${Date.now()}`,
      projectId: "",
      platform: selectedPlatform,
      name: campaignName,
      status: "active",
      budget: analysis?.suggestedBudget || 0,
      spent: 0,
      impressions: analysis?.estimatedImpressions || 0,
      clicks: analysis?.estimatedClicks || 0,
      conversions: analysis?.estimatedConversions || 0,
      startDate: new Date().toISOString(),
      screenshotUrls: images,
      aiAnalysis: analysis || undefined,
    };

    onCampaignCreated(campaign);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "platform" && "Choose Platform"}
            {step === "details" && "Campaign Details"}
            {step === "analyze" && "Analyzing Screenshots..."}
            {step === "results" && "AI Analysis Results"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          {/* Step 1 — Platform Selection */}
          {step === "platform" && (
            <div className="space-y-4 pb-4">
              <p className="text-sm text-muted-foreground">
                Select the platform where you posted your campaign
              </p>
              <div className="grid grid-cols-3 gap-2">
                {ALL_PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setSelectedPlatform(p);
                      setStep("details");
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all hover:scale-105 hover:shadow-md cursor-pointer",
                      selectedPlatform === p
                        ? PLATFORM_BG[p]
                        : "border-border hover:border-muted-foreground/30",
                    )}
                  >
                    <PlatformIcon platform={p} className="h-7 w-7" />
                    <span className="text-xs font-medium">
                      {PLATFORM_LABELS[p]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Campaign Name + Image Upload */}
          {step === "details" && (
            <div className="space-y-5 pb-4">
              {/* Selected platform pill */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep("platform")}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Change platform
                </button>
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1.5 capitalize",
                    PLATFORM_BG[selectedPlatform || ""],
                  )}
                >
                  <PlatformIcon
                    platform={selectedPlatform || ""}
                    className="h-3.5 w-3.5"
                  />
                  {PLATFORM_LABELS[selectedPlatform || ""]}
                </Badge>
              </div>

              {/* Campaign name */}
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  placeholder="e.g. Summer Sale Promo 2026"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>

              {/* Image upload */}
              <div className="space-y-2">
                <Label>Screenshots (up to 4)</Label>
                <p className="text-xs text-muted-foreground">
                  Upload screenshots of your campaign posts, ads, or analytics
                  dashboards — Grok Vision will analyze them.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />

                {/* Image grid */}
                <div className="grid grid-cols-2 gap-3">
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative group rounded-xl overflow-hidden border border-border aspect-video"
                    >
                      <img
                        src={img}
                        alt={`Screenshot ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {images.length < 4 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border aspect-video text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer"
                    >
                      <Upload className="h-6 w-6" />
                      <span className="text-xs">Add Image</span>
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setStep("platform")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                  disabled={!campaignName || images.length === 0}
                  onClick={handleAnalyze}
                >
                  <Sparkles className="h-4 w-4" />
                  Analyze
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 — Analyzing */}
          {step === "analyze" && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative">
                <Loader2 className="h-10 w-10 text-violet-500 animate-spin" />
                <Sparkles className="h-4 w-4 text-violet-400 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold">
                  Grok Vision is analyzing your screenshots...
                </p>
                <p className="text-xs text-muted-foreground">
                  This usually takes 5–15 seconds
                </p>
              </div>
              <Progress value={65} className="w-48 h-1.5" />
            </div>
          )}

          {/* Step 4 — Results */}
          {step === "results" && analysis && (
            <div className="space-y-5 pb-4">
              {/* Summary */}
              <Card>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">Analysis Complete</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {analysis.summary}
                      </p>
                    </div>
                  </div>

                  {/* Engagement score */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28">
                      Engagement Score
                    </span>
                    <Progress
                      value={analysis.engagementScore}
                      className="flex-1 h-2"
                    />
                    <span className="text-sm font-bold w-10 text-right">
                      {analysis.engagementScore}%
                    </span>
                  </div>

                  {/* Sentiment */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-28">
                      Sentiment
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize text-xs",
                        analysis.sentiment === "positive" &&
                          "border-green-500/30 text-green-500",
                        analysis.sentiment === "negative" &&
                          "border-red-500/30 text-red-500",
                        analysis.sentiment === "neutral" &&
                          "border-yellow-500/30 text-yellow-500",
                      )}
                    >
                      {analysis.sentiment}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Estimated metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border p-3 text-center">
                  <DollarSign className="h-4 w-4 text-green-500 mx-auto mb-1" />
                  <p className="text-lg font-bold">
                    ${analysis.suggestedBudget}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Suggested Budget
                  </p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <Eye className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                  <p className="text-lg font-bold">
                    {analysis.estimatedImpressions.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Est. Impressions
                  </p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <MousePointerClick className="h-4 w-4 text-orange-500 mx-auto mb-1" />
                  <p className="text-lg font-bold">
                    {analysis.estimatedClicks.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Est. Clicks
                  </p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <Target className="h-4 w-4 text-violet-500 mx-auto mb-1" />
                  <p className="text-lg font-bold">
                    {analysis.estimatedConversions}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Est. Conversions
                  </p>
                </div>
              </div>

              {/* Key findings */}
              {analysis.keyFindings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Key Findings
                  </p>
                  <ul className="space-y-1.5">
                    {analysis.keyFindings.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm"
                      >
                        <TrendingUp className="h-3.5 w-3.5 text-violet-500 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {analysis.recommendations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Recommendations
                  </p>
                  <ul className="space-y-1.5">
                    {analysis.recommendations.map((r, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setStep("details")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                  onClick={handleCreateCampaign}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Create Campaign
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
