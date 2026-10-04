// ============================================================
// VibeDash — AI Service (Grok + OpenAI Integration)
// ============================================================

import { AIReview, Project, ProjectPhase, CampaignAIAnalysis, CampaignPlatform, Top3Action } from "@/types";

// AI Provider configuration (server-side only - no NEXT_PUBLIC prefix)
// These env vars are only available server-side in API routes
const GROK_API_KEY = process.env.GROK_API_KEY || process.env.NEXT_PUBLIC_GROK_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || "";

// Check if keys are configured
export function getAIConfigStatus() {
  return {
    grokConfigured: !!GROK_API_KEY,
    openaiConfigured: !!OPENAI_API_KEY,
    provider: GROK_API_KEY ? "grok" : OPENAI_API_KEY ? "openai" : null,
  };
}

export interface AIAnalysisResult {
  summary: string;
  completenessScore: number;
  bugsFound: string[];
  suggestions: string[];
  suggestedTasks: Array<{ title: string; description: string; phase: ProjectPhase; priority: "low" | "medium" | "high" }>;
  recommendedStage: ProjectPhase;
  recommendedProgress: number;
  stageProgressMap: Record<ProjectPhase, number>;
  shouldUpdate: boolean;
}

export interface CommitAnalysisResult {
  summary: string;
  featuresAdded: string[];
  bugsFixed: string[];
  progressIndicators: string[];
  recommendedStage: ProjectPhase;
  recommendedProgress: number;
  shouldUpdate: boolean;
}

// Helper to determine which AI provider to use
function getAIProvider(): "grok" | "openai" {
  return GROK_API_KEY ? "grok" : OPENAI_API_KEY ? "openai" : "openai";
}

// Call Grok API
async function callGrok(prompt: string): Promise<string> {
  // Validate API key format
  if (!GROK_API_KEY) {
    throw new Error("GROK_API_KEY is not configured");
  }
  
  if (!GROK_API_KEY.startsWith("xai-")) {
    console.warn("⚠️  Warning: Grok API key should start with 'xai-'");
  }
  
  console.log("🔑 Using Grok API key:", GROK_API_KEY.substring(0, 10) + "...");
  
  const requestBody = {
    model: "grok-4-1-fast-reasoning",
    messages: [
      {
        role: "system",
        content: "You are an expert code reviewer and project progress analyzer for vibe coding projects. Analyze code and commits to assess completeness, identify bugs, and suggest status updates. Always respond with valid JSON.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  };
  
  console.log("📤 Request to Grok API:", JSON.stringify(requestBody, null, 2).substring(0, 500));
  
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROK_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Grok API error response:", errorText);
    console.error("❌ Response status:", response.status);
    console.error("❌ Response headers:", Object.fromEntries(response.headers.entries()));
    throw new Error(`Grok API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Call OpenAI API as fallback
async function callOpenAI(prompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert code reviewer and project progress analyzer for vibe coding projects. Analyze code and commits to assess completeness, identify bugs, and suggest status updates. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

// Generic AI call wrapper
async function callAI(prompt: string): Promise<string> {
  const provider = getAIProvider();
  
  try {
    if (provider === "grok" && GROK_API_KEY) {
      return await callGrok(prompt);
    }
    return await callOpenAI(prompt);
  } catch (error) {
    console.error("AI API call failed:", error);
    throw error;
  }
}

// Analyze code for completeness, bugs, and progress
export async function analyzeCode(
  code: string,
  project: Project,
  readmeContent?: string | null
): Promise<AIAnalysisResult> {
  const currentPhase = project.currentPhase;
  
  // Build existing tasks summary so AI knows what's already done/in-progress
  const existingTasks = (project.tasks || []);
  const tasksByStatus = {
    done: existingTasks.filter(t => t.status === "done"),
    inProgress: existingTasks.filter(t => t.status === "in-progress"),
    todo: existingTasks.filter(t => t.status === "todo"),
  };
  
  const existingTasksSummary = existingTasks.length > 0 ? `
EXISTING PROJECT TASKS (${existingTasks.length} total):
- COMPLETED (${tasksByStatus.done.length}): ${tasksByStatus.done.map(t => `"${t.title.replace(/^🤖 /, '')}" [${t.phase}]`).join(", ") || "none"}
- IN PROGRESS (${tasksByStatus.inProgress.length}): ${tasksByStatus.inProgress.map(t => `"${t.title.replace(/^🤖 /, '')}" [${t.phase}]`).join(", ") || "none"}
- TODO/SCHEDULED (${tasksByStatus.todo.length}): ${tasksByStatus.todo.map(t => `"${t.title.replace(/^🤖 /, '')}" [${t.phase}]`).join(", ") || "none"}
` : "\nEXISTING PROJECT TASKS: None yet\n";

  // Build README section - this is the primary source of truth
  const readmeSection = readmeContent ? `
=== PROJECT README (PRIMARY SOURCE OF TRUTH) ===
The README below is maintained by the developer and describes the project's actual state,
features, architecture, and progress. Use this as your PRIMARY reference when assessing
the project stage and pipeline progress. Cross-reference with the code to verify claims.

${readmeContent.substring(0, 8000)}
=== END README ===
` : "\nNOTE: No README.md found in the repository.\n";

  const prompt = `
You are a project stage analyzer. You are given COMPREHENSIVE repository data including:
- Repository overview and stats
- Full directory structure and file counts
- File type breakdown (how many .tsx, .js, .css, etc.)
- Recent commit activity and messages
- Configuration files (package.json, dependencies, scripts)
- Sample source code from different directories
- README content

IMPORTANT: The project's README.md is provided separately below and should be treated as the
PRIMARY SOURCE OF TRUTH for understanding the project's purpose, features, architecture, and
current state. The developer keeps it up to date. Use the README to understand what the project
is and what has been built, then verify against the actual code.

Based on ALL this data (with README as primary reference), determine the ACTUAL stage of the project in the 6-stage pipeline.

PROJECT: "${project.name}"
CURRENT CLAIMED STAGE: ${currentPhase}
TECH STACK: ${project.techStack.join(", ") || "Analyze from package.json"}
${existingTasksSummary}
${readmeSection}

COMPREHENSIVE REPOSITORY ANALYSIS:
\`\`\`
${code.substring(0, 20000)}
\`\`

THE 6-STAGE VIBE CODING PIPELINE:
1. 💡 idea - Just planning docs, README, no working code yet
2. 🗂️ prototype - Basic UI exists, core features working, MVP assembled
3. 🆓 free-tier - Auth system, user flows, error handling, onboarding complete
4. 💎 premium - Payment integration, feature gating, upgrade prompts, Stripe/etc
5. 🌐 deploy - Environment variables, deployment platform (Vercel/Heroku), monitoring, performance tuning (CI/CD & SSL are auto-handled)
6. 🚀 live - Analytics tracking, marketing campaigns, user acquisition active

ANALYSIS INSTRUCTIONS:
Look at the FULL repository data provided above:
1. Check directory structure - is there a src/ folder? components? pages?
2. Check file counts - lots of .tsx files suggests React app, .py suggests backend
3. Check package.json - what dependencies are installed? (auth libraries? payment?)
4. Check recent commits - are they adding features or fixing bugs?
5. Check for auth files (Login.tsx, auth.ts, etc.)
6. Check for payment/stripe integration
7. Check for deployment configs (vercel.json, Procfile, deployment platform setup)
8. Check for tests, error boundaries, analytics

Be HONEST about what stage you see based on ALL the data, not just the samples.

Return JSON with COMPLETE PIPELINE ASSESSMENT:
{
  "summary": "Based on X files in Y directories with Z dependencies...",
  "completenessScore": 72,
  "actualStage": "premium",
  "stageConfidence": 85,
  "bugsFound": ["List any bugs or missing critical features"],
  "suggestions": ["3-5 specific actions to improve"],
  "suggestedTasks": [
    {"title": "Add unit tests for auth module", "description": "Write Jest/Vitest tests covering login, signup, and session flows.", "phase": "free-tier", "priority": "high"},
    {"title": "Configure deployment platform", "description": "Set up Vercel/Heroku project with environment variables and production settings.", "phase": "deploy", "priority": "medium"},
    {"title": "Add error boundary components", "description": "Wrap key routes with React error boundaries for graceful failure handling.", "phase": "free-tier", "priority": "medium"}
  ],
  "recommendedStage": "premium",
  "recommendedProgress": 72,
  "stageProgressMap": {
    "idea": 100,
    "prototype": 100,
    "free-tier": 100,
    "premium": 72,
    "deploy": 30,
    "live": 10
  },
  "shouldUpdate": true,
  "stageEvidence": [
    "EVIDENCE: Found 15 React components in src/components",
    "EVIDENCE: package.json shows auth library installed",
    "EVIDENCE: Recent commits adding user dashboard features",
    "MISSING: No Stripe/payment imports found",
    "MISSING: No deployment configs (Dockerfile, etc.)"
  ],
  "keyFindings": [
    "File structure: 45 .tsx files, 12 components",
    "Dependencies: React, Next.js, auth library present",
    "Recent activity: 8 commits adding UI features",
    "Architecture: Standard React app structure"
  ]
}

IMPORTANT - stageProgressMap RULES:
- If project is in "live" stage, then idea/prototype/free-tier/premium/deploy should ALL be 100% (they're done)
- Only the CURRENT stage gets the actual percentage (e.g., live: 65%)
- Future stages get 0% or partial if work has started
- Be LOGICAL: you can't be in "live" if "prototype" is only 50%!

Example assessments:
- Early prototype: idea:100, prototype:40, free-tier:0, premium:0, deploy:0, live:0
- Ready for users: idea:100, prototype:100, free-tier:85, premium:0, deploy:0, live:0  
- Live app: idea:100, prototype:100, free-tier:100, premium:100, deploy:100, live:70
- Adding payments: idea:100, prototype:100, free-tier:100, premium:60, deploy:0, live:0

IMPORTANT - suggestedTasks RULES:
- Provide 2-4 concrete, actionable tasks the developer should work on next
- Each task must have a title, description, phase (one of: idea, prototype, free-tier, premium, deploy, live), and priority (low, medium, high)
- Tasks should be specific to what you see in the codebase — not generic advice
- Focus on the CURRENT stage and the NEXT stage the project needs to reach
- Prioritize tasks that would move the project forward the most
- CRITICAL: Do NOT suggest tasks that are already COMPLETED or IN PROGRESS (see EXISTING PROJECT TASKS above)
- Do NOT suggest tasks that are similar to existing TODO/SCHEDULED tasks — they are already tracked
- Only suggest NEW tasks that cover gaps not already addressed by existing tasks

IMPORTANT: Reference SPECIFIC data from the repository analysis:
- "Found X files in Y directories"
- "package.json shows Z dependencies"
- "Recent commits indicate..."
- "File structure suggests..."

Be realistic - don't inflate the stage. Focus on what ACTUALLY exists in the code.

Respond with ONLY valid JSON. No markdown code blocks.
`;

  try {
    const response = await callAI(prompt);
    // Clean up the response - remove markdown code blocks if present
    const cleanResponse = response.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(cleanResponse);
    
    // Extract the AI's assessment
    const actualStage = result.actualStage || result.recommendedStage || currentPhase;
    const stageConfidence = result.stageConfidence || 70;
    const completenessScore = Math.min(100, Math.max(0, result.completenessScore || result.recommendedProgress || 0));
    
    // Determine if we should update based on confidence
    const shouldUpdate = result.shouldUpdate === true || stageConfidence >= 70;
    
    // Build enhanced summary with evidence and key findings
    let enhancedSummary = result.summary || "No summary provided";
    
    // Add key findings if available
    if (result.keyFindings && result.keyFindings.length > 0) {
      const findings = result.keyFindings.slice(0, 2).join(". ");
      enhancedSummary = `${enhancedSummary}\n\nKey Findings: ${findings}`;
    }
    
    // Add stage evidence
    if (result.stageEvidence && result.stageEvidence.length > 0) {
      const evidence = result.stageEvidence.slice(0, 3).join("; ");
      enhancedSummary = `${enhancedSummary}\n\nEvidence: ${evidence}`;
    }
    
    // Build stage progress map - use AI's assessment or create logical fallback
    const stageProgressMap: Record<ProjectPhase, number> = result.stageProgressMap || {
      idea: 0,
      prototype: 0,
      "free-tier": 0,
      premium: 0,
      deploy: 0,
      live: 0,
    };
    
    // If AI didn't provide full map, create logical progression
    if (!result.stageProgressMap) {
      const stageOrder: ProjectPhase[] = ["idea", "prototype", "free-tier", "premium", "deploy", "live"];
      const currentIndex = stageOrder.indexOf(actualStage);
      
      stageOrder.forEach((stage, index) => {
        if (index < currentIndex) {
          // Previous stages are complete
          stageProgressMap[stage] = 100;
        } else if (index === currentIndex) {
          // Current stage gets the assessed progress
          stageProgressMap[stage] = completenessScore;
        } else {
          // Future stages are 0 or minimal
          stageProgressMap[stage] = 0;
        }
      });
    }
    
    return {
      summary: enhancedSummary,
      completenessScore,
      bugsFound: result.bugsFound || [],
      suggestions: result.suggestions || [],
      suggestedTasks: (result.suggestedTasks || []).map((t: { title?: string; description?: string; phase?: string; priority?: string }) => ({
        title: t.title || "Untitled task",
        description: t.description || "",
        phase: (["idea", "prototype", "free-tier", "premium", "deploy", "live"].includes(t.phase || "") ? t.phase : actualStage) as ProjectPhase,
        priority: (["low", "medium", "high"].includes(t.priority || "") ? t.priority : "medium") as "low" | "medium" | "high",
      })),
      recommendedStage: actualStage,
      recommendedProgress: completenessScore,
      stageProgressMap,
      shouldUpdate,
    };
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    // Return a safe default with current phase progress
    return {
      summary: "Unable to analyze code due to API error",
      completenessScore: 0,
      bugsFound: [],
      suggestions: ["Please try again later"],
      suggestedTasks: [],
      recommendedStage: currentPhase,
      recommendedProgress: project.phaseProgress[currentPhase] || 0,
      stageProgressMap: {
        idea: currentPhase === "idea" ? (project.phaseProgress.idea || 0) : (currentPhase === "prototype" || currentPhase === "free-tier" || currentPhase === "premium" || currentPhase === "deploy" || currentPhase === "live" ? 100 : 0),
        prototype: currentPhase === "prototype" ? (project.phaseProgress.prototype || 0) : (currentPhase === "free-tier" || currentPhase === "premium" || currentPhase === "deploy" || currentPhase === "live" ? 100 : 0),
        "free-tier": currentPhase === "free-tier" ? (project.phaseProgress["free-tier"] || 0) : (currentPhase === "premium" || currentPhase === "deploy" || currentPhase === "live" ? 100 : 0),
        premium: currentPhase === "premium" ? (project.phaseProgress.premium || 0) : (currentPhase === "deploy" || currentPhase === "live" ? 100 : 0),
        deploy: currentPhase === "deploy" ? (project.phaseProgress.deploy || 0) : (currentPhase === "live" ? 100 : 0),
        live: currentPhase === "live" ? (project.phaseProgress.live || 0) : 0,
      },
      shouldUpdate: false,
    };
  }
}

// Analyze commits for progress
export async function analyzeCommits(
  commits: Array<{ message: string; author: string; date: string; diff?: string }>,
  project: Project
): Promise<CommitAnalysisResult> {
  const currentPhase = project.currentPhase;
  
  const commitsText = commits.map((c, i) => `
Commit ${i + 1}:
- Message: ${c.message}
- Author: ${c.author}
- Date: ${c.date}
${c.diff ? `- Diff:\n${c.diff}` : ""}
`).join("\n");

  const prompt = `
You are a project stage analyzer. Based on recent Git commits, determine what stage this project is in and how much progress has been made.

PROJECT: "${project.name}"
CURRENT CLAIMED STAGE: ${currentPhase}

RECENT COMMITS TO ANALYZE:
${commitsText}

THE 6-STAGE VIBE CODING PIPELINE:
1. 💡 idea - Planning, docs, research
2. 🗂️ prototype - MVP built, core features working
3. 🆓 free-tier - User auth, error handling, onboarding ready
4. 💎 premium - Payment integration, feature gating
5. 🌐 deploy - Production config, SSL, monitoring
6. 🚀 live - Marketing, analytics, active monetization

Analyze these commits and determine:
1. What stage do these commits suggest the project is in?
2. What's the progress percentage (0-100%) based on recent work?
3. What evidence from commits supports this?

Return JSON:
{
  "summary": "Brief analysis (e.g., 'Recent commits show auth system and payment integration being built. Appears to be moving from free-tier to premium stage at ~40%')",
  "featuresAdded": ["Features from commit messages"],
  "bugsFixed": ["Bugs from commit messages"],
  "progressIndicators": ["Evidence of progress"],
  "recommendedStage": "premium",
  "recommendedProgress": 40,
  "shouldUpdate": true,
  "stageEvidence": ["Has auth commits", "Payment integration started", "UI polish commits"]
}

Focus on WHERE the project is in the pipeline based on what was recently committed.

Respond with ONLY valid JSON.
`;

  try {
    const response = await callAI(prompt);
    const cleanResponse = response.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(cleanResponse);
    
    // Build enhanced summary with stage evidence
    let enhancedSummary = result.summary || "No summary provided";
    if (result.stageEvidence && result.stageEvidence.length > 0) {
      const evidence = result.stageEvidence.slice(0, 3).join("; ");
      enhancedSummary = `${enhancedSummary} (${evidence})`;
    }
    
    const recommendedProgress = Math.min(100, Math.max(0, result.recommendedProgress || 0));
    const shouldUpdate = result.shouldUpdate === true || recommendedProgress >= 70;
    
    return {
      summary: enhancedSummary,
      featuresAdded: result.featuresAdded || [],
      bugsFixed: result.bugsFixed || [],
      progressIndicators: result.progressIndicators || [],
      recommendedStage: result.recommendedStage || currentPhase,
      recommendedProgress,
      shouldUpdate,
    };
  } catch (error) {
    console.error("Failed to parse AI commit analysis:", error);
    return {
      summary: "Unable to analyze commits due to API error",
      featuresAdded: [],
      bugsFixed: [],
      progressIndicators: [],
      recommendedStage: currentPhase,
      recommendedProgress: project.phaseProgress[currentPhase],
      shouldUpdate: false,
    };
  }
}

// Generate AI review object from analysis
export function createAIReview(
  projectId: string,
  type: "code-review" | "commit-analysis",
  analysis: AIAnalysisResult | CommitAnalysisResult,
  commitsAnalyzed?: string[]
): AIReview {
  const isCodeReview = "completenessScore" in analysis;
  
  // Create stage progress map for commit analysis (if not already present)
  let stageProgressMap: Record<ProjectPhase, number> | undefined;
  if (isCodeReview) {
    stageProgressMap = (analysis as AIAnalysisResult).stageProgressMap;
  } else {
    // For commit analysis, create a simple progression
    const recommendedStage = analysis.recommendedStage;
    stageProgressMap = {
      idea: recommendedStage === "idea" ? analysis.recommendedProgress : (recommendedStage === "prototype" || recommendedStage === "free-tier" || recommendedStage === "premium" || recommendedStage === "deploy" || recommendedStage === "live" ? 100 : 0),
      prototype: recommendedStage === "prototype" ? analysis.recommendedProgress : (recommendedStage === "free-tier" || recommendedStage === "premium" || recommendedStage === "deploy" || recommendedStage === "live" ? 100 : 0),
      "free-tier": recommendedStage === "free-tier" ? analysis.recommendedProgress : (recommendedStage === "premium" || recommendedStage === "deploy" || recommendedStage === "live" ? 100 : 0),
      premium: recommendedStage === "premium" ? analysis.recommendedProgress : (recommendedStage === "deploy" || recommendedStage === "live" ? 100 : 0),
      deploy: recommendedStage === "deploy" ? analysis.recommendedProgress : (recommendedStage === "live" ? 100 : 0),
      live: recommendedStage === "live" ? analysis.recommendedProgress : 0,
    };
  }
  
  return {
    id: `review-${Date.now()}`,
    projectId,
    type,
    summary: analysis.summary,
    stageProgressMap,
    completenessScore: isCodeReview ? (analysis as AIAnalysisResult).completenessScore : 0,
    bugsFound: isCodeReview ? (analysis as AIAnalysisResult).bugsFound : (analysis as CommitAnalysisResult).bugsFixed,
    suggestions: isCodeReview 
      ? (analysis as AIAnalysisResult).suggestions 
      : (analysis as CommitAnalysisResult).progressIndicators,
    suggestedTasks: isCodeReview ? (analysis as AIAnalysisResult).suggestedTasks : [],
    recommendedStage: analysis.recommendedStage,
    recommendedProgress: analysis.recommendedProgress,
    shouldUpdate: analysis.shouldUpdate,
    createdAt: new Date().toISOString(),
    commitsAnalyzed,
  };
}

// ============================================================
// Grok Vision — Analyze marketing campaign screenshots
// ============================================================

export async function analyzeMarketingScreenshots(
  imageDataUrls: string[],
  platform: CampaignPlatform,
  campaignName: string,
): Promise<CampaignAIAnalysis> {
  if (!GROK_API_KEY) {
    throw new Error("GROK_API_KEY is not configured — vision analysis requires Grok");
  }

  // Build the messages array with images for Grok vision
  const imageContent = imageDataUrls.map((dataUrl) => {
    // dataUrl is like "data:image/png;base64,iVBOR..."
    const base64 = dataUrl.split(",")[1];
    const mimeMatch = dataUrl.match(/data:(image\/[^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
    return {
      type: "image_url" as const,
      image_url: {
        url: `data:${mimeType};base64,${base64}`,
      },
    };
  });

  const requestBody = {
    model: "grok-2-vision-latest",
    messages: [
      {
        role: "system",
        content:
          "You are an expert digital marketing analyst. Analyze marketing campaign screenshots and provide detailed performance insights. Always respond with valid JSON only, no markdown.",
      },
      {
        role: "user",
        content: [
          {
            type: "text" as const,
            text: `Analyze these marketing campaign screenshots for a campaign called "${campaignName}" on the ${platform} platform.

Look at the screenshots and extract/estimate:
1. Overall engagement and performance quality
2. Visual quality and brand consistency
3. Estimated reach/impressions potential
4. Any visible metrics (likes, shares, comments, views, clicks)
5. Sentiment of audience reactions if visible
6. Recommendations for improvement

Return ONLY valid JSON (no markdown):
{
  "summary": "2-3 sentence overview of the campaign based on screenshots",
  "engagementScore": 75,
  "sentiment": "positive",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "suggestedBudget": 500,
  "estimatedImpressions": 15000,
  "estimatedClicks": 450,
  "estimatedConversions": 23,
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
}

Be realistic with estimated numbers based on the platform (${platform}) and what you see.
If you cannot read specific metrics, provide educated estimates based on the visual quality and platform norms.`,
          },
          ...imageContent,
        ],
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  };

  console.log("📸 Analyzing marketing screenshots with Grok Vision...");
  console.log(`   Platform: ${platform}, Campaign: ${campaignName}, Images: ${imageDataUrls.length}`);

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROK_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Grok Vision API error:", errorText);
    throw new Error(`Grok Vision API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const cleanResponse = content.replace(/```json\n?|\n?```/g, "").trim();

  try {
    const result = JSON.parse(cleanResponse);
    return {
      summary: result.summary || "Analysis complete",
      engagementScore: Math.min(100, Math.max(0, result.engagementScore || 50)),
      sentiment: result.sentiment || "neutral",
      keyFindings: result.keyFindings || [],
      suggestedBudget: result.suggestedBudget || 0,
      estimatedImpressions: result.estimatedImpressions || 0,
      estimatedClicks: result.estimatedClicks || 0,
      estimatedConversions: result.estimatedConversions || 0,
      recommendations: result.recommendations || [],
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to parse Grok Vision response:", error, content);
    return {
      summary: "Unable to parse vision analysis — raw response logged",
      engagementScore: 50,
      sentiment: "neutral",
      keyFindings: ["Analysis completed but response could not be parsed"],
      suggestedBudget: 0,
      estimatedImpressions: 0,
      estimatedClicks: 0,
      estimatedConversions: 0,
      recommendations: ["Try re-analyzing with clearer screenshots"],
      createdAt: new Date().toISOString(),
    };
  }
}

// ============================================================
// Today's Top 3 — AI-powered daily priority actions
// ============================================================

export async function generateTop3Actions(
  projects: Project[],
): Promise<Top3Action[]> {
  const activeProjects = projects.filter((p) => p.status === "active");
  if (activeProjects.length === 0) return [];

  const projectSummaries = activeProjects.map((p) => {
    const tasks = p.tasks || [];
    const blockerTasks = tasks.filter((t) => t.priority === "high" && t.status !== "done");
    const todoTasks = tasks.filter((t) => t.status === "todo");
    return `
PROJECT: "${p.name}" (id: ${p.id})
  Stage: ${p.currentPhase}
  Progress in stage: ${p.phaseProgress[p.currentPhase] || 0}%
  Revenue: $${p.revenue || 0}
  Priority: ${p.priority}
  Deadline: ${p.deadline || "none"}
  Open issues: ${p.openIssues || 0}
  High-priority blockers: ${blockerTasks.map((t) => t.title).join(", ") || "none"}
  Outstanding tasks: ${todoTasks.slice(0, 5).map((t) => `${t.title} [${t.phase}]`).join(", ") || "none"}
  Last commit: ${p.lastCommit?.message || "none"} (${p.lastCommit?.date || ""})
`;
  }).join("\n");

  const prompt = `
You are a strategic advisor for a solo developer / indie hacker managing multiple SaaS projects.
Analyze these projects and identify the TOP 3 highest-impact actions the user should take TODAY.

Prioritization criteria (in order):
1. Actions that directly move a project closer to REVENUE (payments, pricing, launch)
2. Actions that UNBLOCK a stalled project (fix a blocker, resolve a dependency)
3. Actions that drive significant PROGRESS (complete a stage, reach a milestone)

Consider:
- Time sensitivity (deadlines, market windows)
- Revenue potential (projects in premium/deploy/live stage are closest to money)
- Blockers that prevent progress on high-value projects
- Quick wins vs long tasks (prefer tasks doable in 1-2 hours)

PROJECTS:
${projectSummaries}

Return EXACTLY 3 actions as JSON array (no markdown, no code blocks):
[
  {
    "projectId": "proj-1",
    "projectName": "Project Name",
    "pipelineStage": "premium",
    "nextStep": "A single, specific, executable task (not vague)",
    "expectedOutcome": "What completing this achieves (e.g., unblock payment flow, send beta invites, close first sale)",
    "impactTag": "revenue"
  },
  ...
]

impactTag must be one of: "revenue", "progress", "unblock"
pipelineStage must be one of: "idea", "prototype", "free-tier", "premium", "deploy", "live"

If fewer than 3 projects exist, you may suggest multiple actions for the same project but with DIFFERENT stages/aspects.

Respond with ONLY the JSON array.
`;

  try {
    const response = await callAI(prompt);
    const cleanResponse = response.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleanResponse);

    if (!Array.isArray(parsed)) throw new Error("Expected array");

    const validTags = ["revenue", "progress", "unblock"];
    const validStages = ["idea", "prototype", "free-tier", "premium", "deploy", "live"];

    return parsed.slice(0, 3).map((a: Record<string, string>, i: number) => ({
      id: `top3-${Date.now()}-${i}`,
      projectId: a.projectId || activeProjects[0]?.id || "",
      projectName: a.projectName || activeProjects[0]?.name || "Unknown",
      pipelineStage: (validStages.includes(a.pipelineStage) ? a.pipelineStage : "prototype") as ProjectPhase,
      nextStep: a.nextStep || "Review project status",
      expectedOutcome: a.expectedOutcome || "Move project forward",
      impactTag: (validTags.includes(a.impactTag) ? a.impactTag : "progress") as Top3Action["impactTag"],
      pinned: false,
    }));
  } catch (error) {
    console.error("Failed to generate Top 3 actions:", error);
    // Fallback: generate simple actions from project data
    return activeProjects.slice(0, 3).map((p, i) => ({
      id: `top3-fallback-${Date.now()}-${i}`,
      projectId: p.id,
      projectName: p.name,
      pipelineStage: p.currentPhase,
      nextStep: `Review and advance ${p.name} in the ${p.currentPhase} stage`,
      expectedOutcome: "Move project to next milestone",
      impactTag: (p.currentPhase === "premium" || p.currentPhase === "live" ? "revenue" : "progress") as Top3Action["impactTag"],
      pinned: false,
    }));
  }
}
