// ============================================================
// VibeDash — AI Service Client-side Stub
// ⚠️ WARNING: AI analysis must be done server-side
// Use the /api/projects/[id]/ai-review endpoint instead
// ============================================================

// Re-export types for client-side usage
export type { AIAnalysisResult, CommitAnalysisResult } from "./ai-service-server";

// Client-side stub functions that call the API
import { AIReview } from "@/types";

/**
 * Client-side function to request an AI code review via API
 * This calls the server-side AI service which has access to API keys
 */
export async function requestAIReview(projectId: string): Promise<AIReview | null> {
  try {
    const response = await fetch(`/api/projects/${projectId}/ai-review`, {
      method: "POST",
    });
    
    if (!response.ok) {
      throw new Error(`AI review failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.review;
  } catch (error) {
    console.error("Failed to request AI review:", error);
    return null;
  }
}

/**
 * Client-side function to sync and analyze commits via API
 */
export async function requestCommitAnalysis(
  projectId: string, 
  autoApply = false
): Promise<{ review: AIReview | null; stageChanged: boolean }> {
  try {
    const response = await fetch(`/api/projects/${projectId}/sync-commits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoApply }),
    });
    
    if (!response.ok) {
      throw new Error(`Commit analysis failed: ${response.status}`);
    }
    
    const data = await response.json();
    return { 
      review: data.review, 
      stageChanged: data.stageChanged 
    };
  } catch (error) {
    console.error("Failed to analyze commits:", error);
    return { review: null, stageChanged: false };
  }
}
