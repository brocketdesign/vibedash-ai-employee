"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { mockInsights, mockProjects } from "@/lib/mock-data";
import { AIInsight, Project } from "@/types";
import { RevenueStreakWidget } from "@/components/dashboard/revenue-streak-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useIsDemo } from "@/lib/demo-context";
import {
  Sparkles,
  Crown,
  Bot,
  Send,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  Trophy,
  ArrowRight,
  Zap,
  Brain,
  User,
  MessageSquare,
  Loader2,
  RotateCcw,
  History,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  CircleDollarSign,
  Rocket,
  Target,
  Check,
} from "lucide-react";

interface InsightsSummary {
  totalInsights: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  projectsAnalyzed: number;
  byType: {
    suggestion: number;
    warning: number;
    opportunity: number;
    milestone: number;
  };
}

interface AnalyzedProject {
  id: string;
  name: string;
  color: string;
  currentPhase: string;
  insightCount: number;
}

const insightIcons = {
  suggestion: Lightbulb,
  warning: AlertTriangle,
  opportunity: TrendingUp,
  milestone: Trophy,
};

const insightColors = {
  suggestion: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  warning: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  opportunity: "text-green-500 bg-green-500/10 border-green-500/20",
  milestone: "text-violet-500 bg-violet-500/10 border-violet-500/20",
};

interface NextMoneyStep {
  projectName: string;
  projectColor: string;
  currentPhase: string;
  action: string;
  reason: string;
  impact: string;
  urgency: "now" | "this-week" | "this-month";
  category: "monetize" | "grow" | "launch" | "build";
}

function computeNextMoneyStep(projects: Project[]): NextMoneyStep | null {
  if (projects.length === 0) return null;

  const phaseOrder = ["idea", "prototype", "free-tier", "premium", "deploy", "live"];
  const activeProjects = projects.filter((p) => p.status === "active");
  if (activeProjects.length === 0) return null;

  // Score each project by how close it is to revenue
  const scored = activeProjects.map((p) => {
    const phaseIdx = phaseOrder.indexOf(p.currentPhase);
    const hasRevenue = p.revenue > 0;
    const hasPremium = p.phaseProgress.premium > 0;
    const isDeployed = p.phaseProgress.deploy > 0;
    // Higher = closer to money
    let score = phaseIdx * 20;
    if (hasRevenue) score += 50;
    if (hasPremium) score += p.phaseProgress.premium * 0.3;
    if (isDeployed) score += p.phaseProgress.deploy * 0.2;
    if (p.priority === "critical") score += 15;
    if (p.priority === "high") score += 10;
    if (p.monthlyVisitors > 0) score += Math.min(p.monthlyVisitors / 100, 20);
    return { project: p, score, phaseIdx };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const p = best.project;

  // Determine the specific next money step based on the project state
  if (p.revenue > 0 && p.currentPhase === "live") {
    // Already monetizing — grow revenue
    const hasCampaigns = p.campaigns.length > 0;
    if (!hasCampaigns) {
      return {
        projectName: p.name,
        projectColor: p.color,
        currentPhase: p.currentPhase,
        action: "Launch a paid ad campaign to scale traffic",
        reason: `${p.name} is live and making $${p.revenue.toLocaleString()}/mo but has no active ad campaigns.`,
        impact: `Potential to 2-3x monthly visitors (currently ${p.monthlyVisitors.toLocaleString()}) and revenue`,
        urgency: "this-week",
        category: "grow",
      };
    }
    return {
      projectName: p.name,
      projectColor: p.color,
      currentPhase: p.currentPhase,
      action: "A/B test pricing or add an annual plan for higher LTV",
      reason: `${p.name} is generating $${p.revenue.toLocaleString()}/mo — optimizing pricing is the fastest way to grow.`,
      impact: "Annual plans typically boost revenue 20-30% with zero extra traffic",
      urgency: "this-week",
      category: "monetize",
    };
  }

  if (p.currentPhase === "deploy" || (p.currentPhase === "live" && p.revenue === 0)) {
    return {
      projectName: p.name,
      projectColor: p.color,
      currentPhase: p.currentPhase,
      action: "Connect Stripe and enable payment collection",
      reason: `${p.name} is deployed but not collecting payments yet. Monetization is one step away.`,
      impact: "First dollar in — every day without payments is lost revenue",
      urgency: "now",
      category: "monetize",
    };
  }

  if (p.currentPhase === "premium") {
    const premiumProgress = p.phaseProgress.premium;
    if (premiumProgress >= 70) {
      return {
        projectName: p.name,
        projectColor: p.color,
        currentPhase: p.currentPhase,
        action: "Finish premium features and deploy to start charging",
        reason: `${p.name} is ${premiumProgress}% through premium — you're almost there.`,
        impact: "Complete premium build to unlock recurring revenue",
        urgency: "now",
        category: "launch",
      };
    }
    return {
      projectName: p.name,
      projectColor: p.color,
      currentPhase: p.currentPhase,
      action: "Implement Stripe billing and one premium feature",
      reason: `${p.name} needs premium features to generate revenue. Start with the highest-value one.`,
      impact: "A single premium feature + billing can unlock your first paying users",
      urgency: "this-week",
      category: "build",
    };
  }

  if (p.currentPhase === "free-tier") {
    return {
      projectName: p.name,
      projectColor: p.color,
      currentPhase: p.currentPhase,
      action: "Define and start building a premium tier",
      reason: `${p.name} has a free tier ready — now plan the paid features that users will pay for.`,
      impact: "Adding a paid tier is the bridge between free product and revenue",
      urgency: "this-week",
      category: "build",
    };
  }

  if (p.currentPhase === "prototype") {
    return {
      projectName: p.name,
      projectColor: p.color,
      currentPhase: p.currentPhase,
      action: "Ship an MVP and get it in front of users",
      reason: `${p.name} is still in prototyping. Shipping fast → feedback → revenue.`,
      impact: "Validated products reach revenue 3x faster than those stuck in building",
      urgency: "this-month",
      category: "build",
    };
  }

  // Idea phase
  return {
    projectName: p.name,
    projectColor: p.color,
    currentPhase: p.currentPhase,
    action: "Validate the idea and start building a prototype",
    reason: `${p.name} is still in the idea stage — move to building to get closer to revenue.`,
    impact: "The sooner you validate, the sooner you can monetize",
    urgency: "this-month",
    category: "build",
  };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatSessionMeta {
  id: string;
  summary: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const items = listItems.map((item, i) => (
        <li key={i} className="ml-4">
          {renderInline(item)}
        </li>
      ));
      elements.push(
        listType === "ul" ? (
          <ul key={elements.length} className="list-disc space-y-1 my-1.5">
            {items}
          </ul>
        ) : (
          <ol key={elements.length} className="list-decimal space-y-1 my-1.5">
            {items}
          </ol>
        )
      );
      listItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^[-*•]\s+/.test(line)) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(line.replace(/^[-*•]\s+/, ""));
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(line.replace(/^\d+[.)]\s+/, ""));
      continue;
    }

    flushList();

    if (line.startsWith("### ")) {
      elements.push(
        <p key={i} className="font-semibold mt-3 mb-1 text-sm">
          {renderInline(line.slice(4))}
        </p>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <p key={i} className="font-bold mt-3 mb-1">
          {renderInline(line.slice(3))}
        </p>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <p key={i} className="font-bold text-base mt-3 mb-1">
          {renderInline(line.slice(2))}
        </p>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  }

  flushList();
  return elements;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`(.+?)`|_(.+?)_)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-muted px-1 py-0.5 text-xs font-mono"
        >
          {match[3]}
        </code>
      );
    } else if (match[4]) {
      parts.push(<em key={match.index}>{match[4]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

const DEMO_RESPONSES: Record<string, string> = {
  "What should I focus on this week?":
    "Based on your projects, here's my recommendation:\n\n**Top Priority: MealPrepPro**\n- It's in the premium phase with 75% progress — closest to generating revenue\n- Focus on finishing the Stripe integration and payment flows\n\n**Secondary: CodePilotAI**\n- 12 open issues need attention before your premium launch\n- Dedicate 2-3 hours to triaging and fixing critical bugs\n\n**Quick Win: VibeTracker**\n- Your marketing campaigns are showing good traction\n- Spend 30 minutes reviewing analytics and adjusting ad spend",
  "Which project has the most potential?":
    "Looking at your portfolio:\n\n**🏆 MealPrepPro** has the highest potential right now:\n- Already in premium phase (furthest along the pipeline)\n- $2,400/mo revenue with room to grow\n- 15,000 monthly visitors — solid organic traffic\n- Monetization is partially built, just needs completion\n\n**Runner-up: CodePilotAI**\n- Strong tech stack and 340 GitHub stars\n- AI-powered tools are trending — great market timing\n- But needs more work before it can generate revenue",
  "How can I increase revenue?":
    "Here are specific revenue strategies based on your projects:\n\n**1. MealPrepPro (Quick Wins)**\n- Current: $2,400/mo → Target: $5,000/mo\n- Add annual billing (typically +20% conversion)\n- Implement a referral program\n- A/B test your pricing page\n\n**2. CodePilotAI (Medium Term)**\n- Launch a $19/mo pro tier\n- Offer team/enterprise plans\n- Create a free → paid conversion funnel\n\n**3. Cross-Portfolio**\n- Total ad spend is $800/mo — consider reallocating budget to best-performing channels\n- Your Facebook campaigns have the best conversion rate, double down there",
  "Prioritize my tasks":
    "Here's your prioritized task list across all projects:\n\n**🔴 Critical (Do Today)**\n1. Fix checkout flow bug in MealPrepPro\n2. Resolve 3 high-priority issues in CodePilotAI\n\n**🟡 High Priority (This Week)**\n3. Complete Stripe webhook integration (MealPrepPro)\n4. Set up CI/CD pipeline for VibeTracker\n5. Review and merge pending PRs across projects\n\n**🟢 Normal (This Sprint)**\n6. Add unit tests to CodePilotAI core modules\n7. Create landing page for VibeTracker\n8. Plan marketing campaign for MealPrepPro premium launch",
};

export default function AIAdvisorPage() {
  const isDemo = useIsDemo();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isNearBottomRef = useRef(true);
  const savePendingRef = useRef(false);

  // Insights state
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [insightsSummary, setInsightsSummary] = useState<InsightsSummary | null>(null);
  const [analyzedProjects, setAnalyzedProjects] = useState<AnalyzedProject[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [insightsGenerated, setInsightsGenerated] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Next Money Step state
  const [moneyStep, setMoneyStep] = useState<NextMoneyStep | null>(null);
  const [moneyStepLoading, setMoneyStepLoading] = useState(false);
  const [moneyStepLoaded, setMoneyStepLoaded] = useState(false);
  const [moneyStepDone, setMoneyStepDone] = useState(false);
  const [moneyStepMarking, setMoneyStepMarking] = useState(false);

  // Revenue streak state
  const [streakRefreshTrigger, setStreakRefreshTrigger] = useState(0);

  // Load Next Money Step on mount (uses server-side 24h cache)
  const fetchNextMoneyStep = useCallback(async (force = false) => {
    if (isDemo) {
      setMoneyStep(computeNextMoneyStep(mockProjects));
      setMoneyStepLoaded(true);
      return;
    }
    setMoneyStepLoading(true);
    try {
      const res = await fetch("/api/ai-advisor/next-money-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (res.ok) {
        const data = await res.json();
        setMoneyStep(data.step || null);
        setMoneyStepDone(data.markedDone || false);
      } else {
        // Fallback: won't show anything
        setMoneyStep(null);
      }
    } catch (err) {
      console.error("Failed to load next money step:", err);
      setMoneyStep(null);
    } finally {
      setMoneyStepLoading(false);
      setMoneyStepLoaded(true);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchNextMoneyStep();
  }, [fetchNextMoneyStep]);

  // Mark Next Money Step as done → record revenue action + persist done state
  const markMoneyStepDone = useCallback(async () => {
    if (!moneyStep || moneyStepMarking || moneyStepDone) return;
    setMoneyStepMarking(true);
    if (isDemo) {
      // Simulate for demo
      await new Promise((r) => setTimeout(r, 400));
      setMoneyStepDone(true);
      setMoneyStepMarking(false);
      setStreakRefreshTrigger((n) => n + 1);
      return;
    }
    try {
      // Record streak action + persist markedDone to cache in parallel
      const [streakRes] = await Promise.all([
        fetch("/api/ai-advisor/streak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "money-step",
            label: moneyStep.action,
            projectName: moneyStep.projectName,
          }),
        }),
        fetch("/api/ai-advisor/next-money-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markDone: true }),
        }),
      ]);
      if (streakRes.ok) {
        setMoneyStepDone(true);
        setStreakRefreshTrigger((n) => n + 1);
      }
    } catch (err) {
      console.error("Failed to record revenue action:", err);
    } finally {
      setMoneyStepMarking(false);
    }
  }, [moneyStep, moneyStepMarking, moneyStepDone, isDemo]);

  // Load sessions from DB on mount
  const fetchSessions = useCallback(async () => {
    if (isDemo) {
      setSessionsLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/ai-advisor/chat/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Save session to DB (called after streaming completes)
  const saveSession = useCallback(
    async (sessionMessages: ChatMessage[], sessionId: string | null) => {
      if (isDemo || sessionMessages.length === 0) return;
      const hasContent = sessionMessages.some((m) => m.content.length > 0);
      if (!hasContent) return;

      try {
        const res = await fetch("/api/ai-advisor/chat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionId,
            messages: sessionMessages,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const saved = data.session;
          if (!sessionId) {
            // New session created — update active ID
            setActiveSessionId(saved.id);
          }
          // Refresh session list
          setSessions((prev) => {
            const exists = prev.find((s) => s.id === saved.id);
            if (exists) {
              return prev.map((s) => (s.id === saved.id ? saved : s));
            }
            return [saved, ...prev];
          });
        }
      } catch (err) {
        console.error("Failed to save session:", err);
      }
    },
    [isDemo]
  );

  const startNewChat = useCallback(() => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
    }
    setMessages([]);
    setInput("");
    setActiveSessionId(null);
    setIsStreaming(false);
    setHistoryOpen(false);
  }, [isStreaming]);

  const loadSession = useCallback(async (session: ChatSessionMeta) => {
    if (isDemo) {
      setActiveSessionId(session.id);
      setHistoryOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/ai-advisor/chat/sessions/${session.id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.session.messages || []);
        setActiveSessionId(session.id);
        setHistoryOpen(false);
        setInput("");
        setIsStreaming(false);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  }, [isDemo]);

  const deleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistically remove from UI
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setMessages([]);
      setActiveSessionId(null);
      setInput("");
    }
    if (!isDemo) {
      try {
        await fetch(`/api/ai-advisor/chat/sessions?id=${sessionId}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    }
  }, [activeSessionId, isDemo]);

  const scrollToBottom = useCallback((instant?: boolean) => {
    const container = chatContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: instant ? "instant" : "smooth",
    });
  }, []);

  // Track whether the user is scrolled near the bottom
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll only when near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom(isStreaming);
    }
  }, [messages, scrollToBottom, isStreaming]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      const userMessage: ChatMessage = { role: "user", content: content.trim() };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsStreaming(true);

      // Demo mode: use preset responses
      if (isDemo) {
        const response =
          DEMO_RESPONSES[content.trim()] ||
          "I'd be happy to help with that! In the full version, I have access to all your project data and can give you specific, actionable advice. Try connecting your projects to get personalized recommendations.";

        const assistantMessage: ChatMessage = { role: "assistant", content: "" };
        setMessages((prev) => [...prev, assistantMessage]);

        for (let i = 0; i < response.length; i++) {
          await new Promise((r) => setTimeout(r, 8));
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: response.slice(0, i + 1),
            };
            return updated;
          });
        }
        setIsStreaming(false);
        return;
      }

      // Mark that we need to save after streaming
      savePendingRef.current = true;

      // Real mode: call the API with streaming
      const assistantMessage: ChatMessage = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMessage]);

      const allMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch("/api/ai-advisor/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: allMessages }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Request failed with status ${response.status}`
          );
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: fullContent,
                  };
                  return updated;
                });
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled
        } else {
          const errorMsg =
            err instanceof Error ? err.message : "Something went wrong";
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: `Sorry, I encountered an error: ${errorMsg}. Please try again.`,
            };
            return updated;
          });
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
        // Persist to DB after streaming completes
        if (savePendingRef.current) {
          savePendingRef.current = false;
          // Use a small delay to ensure state has settled
          setTimeout(() => {
            setMessages((current) => {
              // Trigger save with the latest messages
              saveSession(current, activeSessionId);
              return current;
            });
          }, 100);
        }
      }
    },
    [isStreaming, isDemo, messages, saveSession, activeSessionId]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = useCallback(async () => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
    }
    // Remove the session from history if it exists
    if (activeSessionId) {
      setSessions((prev) => prev.filter((s) => s.id !== activeSessionId));
      if (!isDemo) {
        try {
          await fetch(`/api/ai-advisor/chat/sessions?id=${activeSessionId}`, {
            method: "DELETE",
          });
        } catch (err) {
          console.error("Failed to delete session:", err);
        }
      }
    }
    setMessages([]);
    setInput("");
    setActiveSessionId(null);
    setIsStreaming(false);
  }, [isStreaming, activeSessionId, isDemo]);

  // Generate insights from AI
  const generateInsights = useCallback(async () => {
    if (isGeneratingInsights) return;

    // Demo mode: use mock data
    if (isDemo) {
      setInsights(mockInsights);
      setInsightsSummary({
        totalInsights: mockInsights.length,
        highPriority: mockInsights.filter((i) => i.priority === "high").length,
        mediumPriority: mockInsights.filter((i) => i.priority === "medium").length,
        lowPriority: mockInsights.filter((i) => i.priority === "low").length,
        projectsAnalyzed: mockProjects.length,
        byType: {
          suggestion: mockInsights.filter((i) => i.type === "suggestion").length,
          warning: mockInsights.filter((i) => i.type === "warning").length,
          opportunity: mockInsights.filter((i) => i.type === "opportunity").length,
          milestone: mockInsights.filter((i) => i.type === "milestone").length,
        },
      });
      setAnalyzedProjects(
        mockProjects.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          currentPhase: p.currentPhase,
          insightCount: mockInsights.filter((i) => i.projectId === p.id).length,
        }))
      );
      setInsightsGenerated(true);
      return;
    }

    setIsGeneratingInsights(true);
    setInsightsError(null);

    try {
      const response = await fetch("/api/ai-advisor/insights", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      setInsights(data.insights || []);
      setInsightsSummary(data.summary || null);
      setAnalyzedProjects(data.analyzedProjects || []);
      setInsightsGenerated(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to generate insights";
      setInsightsError(errorMsg);
    } finally {
      setIsGeneratingInsights(false);
    }
  }, [isGeneratingInsights, isDemo]);

  // Computed counts from real insights (or fallback to mock for display)
  const displayInsights = insightsGenerated ? insights : mockInsights;
  const priorityCounts = insightsSummary
    ? {
        high: insightsSummary.highPriority,
        medium: insightsSummary.mediumPriority,
        low: insightsSummary.lowPriority,
      }
    : {
        high: displayInsights.filter((i) => i.priority === "high").length,
        medium: displayInsights.filter((i) => i.priority === "medium").length,
        low: displayInsights.filter((i) => i.priority === "low").length,
      };
  const displayProjects = analyzedProjects.length > 0
    ? analyzedProjects
    : mockProjects.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        currentPhase: p.currentPhase,
        insightCount: 0,
      }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">AI Advisor</h1>
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/30 text-amber-500"
            >
              <Crown className="h-3 w-3" />
              Pro Feature
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Your intelligent assistant for project management decisions
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
          onClick={generateInsights}
          disabled={isGeneratingInsights}
        >
          {isGeneratingInsights ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analyzing...
            </>
          ) : insightsGenerated ? (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Insights
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Generate Insights
            </>
          )}
        </Button>
      </div>

      {/* Next Money Step + Revenue Streak */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {(() => {
        if (!moneyStepLoaded && !moneyStepLoading) return <div />;
        if (moneyStepLoading) {
          return (
            <Card className="relative overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-amber-500/5">
              <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-500/15 to-amber-500/10 blur-2xl" />
              <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="relative">
                  <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
                  <CircleDollarSign className="absolute -right-1 -top-1 h-4 w-4 text-amber-500 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Finding your next money step...</p>
                  <p className="text-xs text-muted-foreground mt-1">Analyzing your projects for the fastest path to revenue</p>
                </div>
              </CardContent>
            </Card>
          );
        }
        if (!moneyStep) return <div />;
        const urgencyLabel = {
          now: "Do it now",
          "this-week": "This week",
          "this-month": "This month",
        };
        const urgencyColor = {
          now: "bg-red-500/10 text-red-500 border-red-500/30",
          "this-week": "bg-amber-500/10 text-amber-500 border-amber-500/30",
          "this-month": "bg-blue-500/10 text-blue-500 border-blue-500/30",
        };
        const categoryIcon = {
          monetize: CircleDollarSign,
          grow: TrendingUp,
          launch: Rocket,
          build: Target,
        };
        const CategoryIcon = categoryIcon[moneyStep.category];
        return (
          <Card className="relative overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-amber-500/5">
            <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-500/15 to-amber-500/10 blur-2xl" />
            <div className="pointer-events-none absolute -left-4 -bottom-4 h-24 w-24 rounded-full bg-gradient-to-tr from-amber-500/10 to-emerald-500/5 blur-2xl" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/25">
                    <CircleDollarSign className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      Next Money Step
                      <Badge variant="outline" className={cn("text-[10px] font-medium", urgencyColor[moneyStep.urgency])}>
                        {urgencyLabel[moneyStep.urgency]}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Your #1 action to get closer to revenue
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: moneyStep.projectColor }} />
                  <span className="text-xs font-medium">{moneyStep.projectName}</span>
                  <Badge variant="secondary" className="h-5 text-[9px] capitalize">
                    {moneyStep.currentPhase.replace("-", " ")}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <CategoryIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {moneyStep.action}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {moneyStep.reason}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-2.5">
                <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Expected Impact</p>
                  <p className="text-xs text-foreground">{moneyStep.impact}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {moneyStepDone ? (
                  <Button
                    size="sm"
                    disabled
                    className="gap-2 rounded-xl bg-green-600 text-white cursor-default"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Done!
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
                    onClick={markMoneyStepDone}
                    disabled={moneyStepMarking}
                  >
                    {moneyStepMarking ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Mark Done
                  </Button>
                )}
                <Button
                  size="sm"
                  className="gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700"
                  onClick={() => sendMessage(`How do I ${moneyStep.action.toLowerCase()} for ${moneyStep.projectName}?`)}
                  disabled={isStreaming}
                >
                  <Bot className="h-3.5 w-3.5" />
                  Ask AI How
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl text-xs"
                  onClick={() => sendMessage(`Break down the next money step for ${moneyStep.projectName} into specific tasks I can do today`)}
                  disabled={isStreaming}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Get Action Plan
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground ml-auto"
                  onClick={() => { setMoneyStepDone(false); fetchNextMoneyStep(true); }}
                  disabled={moneyStepLoading}
                >
                  {moneyStepLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Revenue Streak Widget */}
      <RevenueStreakWidget
        refreshTrigger={streakRefreshTrigger}
        onFilterRevenueTasks={() => sendMessage("Show me all my revenue-driving tasks across all projects")}
      />
      </div>

      {/* AI Chat Section */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 translate-x-12 -translate-y-12 rounded-full bg-gradient-to-br from-violet-500/10 to-indigo-500/10 blur-3xl" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Chat with AI Advisor
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Ask anything about your projects, strategy, or next steps
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <History className="h-3.5 w-3.5" />
                    History
                    {sessions.length > 0 && (
                      <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[9px]">
                        {sessions.length}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[340px] sm:w-[380px]">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <History className="h-4 w-4 text-violet-500" />
                      Chat History
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 flex flex-col gap-3 h-[calc(100%-80px)]">
                    <Button
                      size="sm"
                      onClick={startNewChat}
                      className="gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white w-full"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New Chat
                    </Button>
                    <ScrollArea className="flex-1">
                      <div className="space-y-2 pr-3">
                        {sessionsLoading ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Loader2 className="h-6 w-6 animate-spin text-violet-500 mb-2" />
                            <p className="text-sm text-muted-foreground">Loading history...</p>
                          </div>
                        ) : sessions.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                            <p className="text-sm text-muted-foreground">No previous chats</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Start a conversation and it will appear here</p>
                          </div>
                        ) : (
                          sessions
                            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                            .map((session) => {
                              const msgCount = session.messageCount;
                              const isActive = session.id === activeSessionId;
                              return (
                                <button
                                  key={session.id}
                                  onClick={() => loadSession(session)}
                                  className={cn(
                                    "w-full text-left rounded-xl border p-3 transition-all hover:shadow-sm hover:bg-accent/50 group",
                                    isActive
                                      ? "border-violet-500/30 bg-violet-500/5"
                                      : "border-border"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {session.summary}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-muted-foreground">
                                          {msgCount} message{msgCount !== 1 ? "s" : ""}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          &middot;
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          {formatRelativeTime(new Date(session.updatedAt).getTime())}
                                        </span>
                                        {isActive && (
                                          <Badge variant="secondary" className="h-3.5 px-1 text-[8px]">
                                            Active
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                      onClick={(e) => deleteSession(session.id, e)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </button>
                              );
                            })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </SheetContent>
              </Sheet>
              {messages.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={startNewChat}
                    className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    New
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearChat}
                    className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Clear
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Messages area */}
          <div ref={chatContainerRef} className="space-y-3 rounded-xl bg-muted/30 p-4 max-h-[500px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                  <Bot className="h-4 w-4 text-violet-500" />
                </div>
                <div className="flex-1 rounded-xl bg-card p-3 shadow-sm">
                  <p className="text-sm leading-relaxed">
                    Hey! 👋 I&apos;m your AI Advisor. I have access to all your
                    project data — phases, tasks, campaigns, revenue, and more.
                    Ask me anything and I&apos;ll give you specific, actionable
                    advice.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Try one of the quick prompts below, or ask your own question!
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className="flex gap-3">
                  {msg.role === "assistant" ? (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                      <Bot className="h-4 w-4 text-violet-500" />
                    </div>
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                      <User className="h-4 w-4 text-blue-500" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex-1 rounded-xl p-3 shadow-sm",
                      msg.role === "assistant"
                        ? "bg-card"
                        : "bg-blue-500/5 border border-blue-500/10"
                    )}
                  >
                    {msg.role === "assistant" && msg.content === "" ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Thinking...
                      </div>
                    ) : msg.role === "assistant" ? (
                      <div className="text-sm space-y-0.5">
                        {renderMarkdown(msg.content)}
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))
            )}
            <div className="h-px" />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              placeholder="Ask about your projects... e.g., 'What should I focus on this week?'"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[44px] resize-none rounded-xl"
              rows={1}
              disabled={isStreaming}
            />
            <Button
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white disabled:opacity-50"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-2">
            {[
              "What should I focus on this week?",
              "Which project has the most potential?",
              "How can I increase revenue?",
              "Prioritize my tasks",
            ].map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                className="h-7 rounded-full text-xs"
                onClick={() => sendMessage(prompt)}
                disabled={isStreaming}
              >
                <MessageSquare className="mr-1 h-3 w-3" />
                {prompt}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insights Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-violet-500" />
              Insight Summary
              {insightsGenerated && (
                <Badge variant="secondary" className="ml-auto h-5 text-[9px] gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Live
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isGeneratingInsights ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                <p className="text-xs text-muted-foreground">Analyzing your projects...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-red-500/10 p-3">
                    <p className="text-xl font-bold text-red-500">
                      {priorityCounts.high}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      High Priority
                    </p>
                  </div>
                  <div className="rounded-xl bg-yellow-500/10 p-3">
                    <p className="text-xl font-bold text-yellow-500">
                      {priorityCounts.medium}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Medium Priority
                    </p>
                  </div>
                  <div className="rounded-xl bg-green-500/10 p-3">
                    <p className="text-xl font-bold text-green-500">
                      {priorityCounts.low}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Low Priority
                    </p>
                  </div>
                </div>

                {insightsSummary && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="rounded-lg bg-blue-500/10 p-2">
                        <p className="text-sm font-semibold text-blue-500">{insightsSummary.byType.suggestion}</p>
                        <p className="text-[9px] text-muted-foreground">Suggestions</p>
                      </div>
                      <div className="rounded-lg bg-amber-500/10 p-2">
                        <p className="text-sm font-semibold text-amber-500">{insightsSummary.byType.warning}</p>
                        <p className="text-[9px] text-muted-foreground">Warnings</p>
                      </div>
                      <div className="rounded-lg bg-green-500/10 p-2">
                        <p className="text-sm font-semibold text-green-500">{insightsSummary.byType.opportunity}</p>
                        <p className="text-[9px] text-muted-foreground">Opportunities</p>
                      </div>
                      <div className="rounded-lg bg-violet-500/10 p-2">
                        <p className="text-sm font-semibold text-violet-500">{insightsSummary.byType.milestone}</p>
                        <p className="text-[9px] text-muted-foreground">Milestones</p>
                      </div>
                    </div>
                  </>
                )}

                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium">
                    Projects Analyzed
                    {insightsSummary && (
                      <span className="ml-1 text-muted-foreground">({insightsSummary.projectsAnalyzed})</span>
                    )}
                  </p>
                  {displayProjects.length > 0 ? (
                    displayProjects.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="text-xs">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">{p.currentPhase}</span>
                        {p.insightCount > 0 && (
                          <Badge variant="secondary" className="ml-auto h-4 min-w-4 px-1 text-[9px]">
                            {p.insightCount}
                          </Badge>
                        )}
                        <Zap className={cn("h-3 w-3", p.insightCount > 0 ? "text-violet-500" : "text-muted-foreground/30")} />
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No projects yet. Create one to get started!</p>
                  )}
                </div>

                {!insightsGenerated && (
                  <>
                    <Separator />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 rounded-xl text-xs"
                      onClick={generateInsights}
                      disabled={isGeneratingInsights}
                    >
                      <Sparkles className="h-3 w-3" />
                      Generate AI Insights
                    </Button>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* All Insights */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">All Insights</CardTitle>
                {insightsGenerated && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Sparkles className="h-3 w-3 text-violet-500" />
                    {displayInsights.length} insights
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isGeneratingInsights ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="relative">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                    <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-amber-500 animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Generating AI Insights...</p>
                    <p className="text-xs text-muted-foreground mt-1">Analyzing your projects, tasks, campaigns & metrics</p>
                  </div>
                </div>
              ) : insightsError ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Failed to generate insights</p>
                    <p className="text-xs text-muted-foreground mt-1">{insightsError}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-xl mt-2"
                    onClick={generateInsights}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Try Again
                  </Button>
                </div>
              ) : displayInsights.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Brain className="h-8 w-8 text-muted-foreground/40" />
                  <div className="text-center">
                    <p className="text-sm font-medium">No insights yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click &quot;Generate Insights&quot; to get AI-powered recommendations for your projects
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-xl mt-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-0"
                    onClick={generateInsights}
                  >
                    <Sparkles className="h-3 w-3" />
                    Generate Insights
                  </Button>
                </div>
              ) : (
                displayInsights.map((insight) => {
                  const Icon = insightIcons[insight.type];
                  const colorClass = insightColors[insight.type];
                  return (
                    <div
                      key={insight.id}
                      className={cn(
                        "rounded-xl border p-4 transition-all hover:shadow-sm",
                        colorClass
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {insight.title}
                            </span>
                            <Badge
                              variant="outline"
                              className="h-4 text-[9px] font-normal"
                            >
                              {insight.projectName}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "ml-auto h-4 text-[9px] capitalize",
                                insight.priority === "high" && "border-red-500/30 text-red-500",
                                insight.priority === "medium" && "border-yellow-500/30 text-yellow-500",
                                insight.priority === "low" && "border-green-500/30 text-green-500"
                              )}
                            >
                              {insight.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {insight.description}
                          </p>
                          {insight.actionable && insight.action && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-7 gap-1 px-2 text-xs"
                            >
                              {insight.action}
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
