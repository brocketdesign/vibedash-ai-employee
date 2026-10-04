# AI Stage Detection - Implementation Complete

## What Changed

The AI review now focuses on **automatic stage detection** rather than code quality review.

### New AI Prompt Strategy

**Old**: "Review this code for bugs and quality"
**New**: "Determine what stage this project is ACTUALLY in based on the code"

### 6-Stage Pipeline the AI Detects:

1. **💡 idea** - Just docs, planning, no working code
2. **🗂️ prototype** - Basic UI, some features working
3. **🆓 free-tier** - Auth works, error handling, user-ready
4. **💎 premium** - Payment integration, upgrade prompts
5. **🌐 deploy** - Production config, SSL, monitoring
6. **🚀 live** - Marketing active, analytics, monetization

## How the AI Determines Stage

### For Code Analysis (`/ai-review`):
- Analyzes README, source files, configs
- Looks for evidence like:
  - Auth systems → suggests "free-tier"
  - Payment code → suggests "premium"
  - Deployment configs → suggests "deploy"
  - Marketing content → suggests "live"
- Returns:
  - `actualStage`: What stage the code shows
  - `stageConfidence`: How sure the AI is (0-100%)
  - `stageEvidence`: List of specific evidence found
  - `completenessScore`: Percentage through that stage

### For Commit Analysis (`/sync-commits`):
- Analyzes recent commit messages and diffs
- Detects what was recently worked on
- Returns similar stage assessment

## Example AI Response

```json
{
  "summary": "This appears to be a prototype with basic UI and core features working. Has authentication implemented but no payment system yet. Appears to be 65% through prototype stage.",
  "completenessScore": 65,
  "actualStage": "prototype",
  "stageConfidence": 80,
  "bugsFound": ["Minor CSS issue on mobile"],
  "suggestions": ["Add error boundaries", "Implement user dashboard"],
  "recommendedStage": "prototype",
  "recommendedProgress": 65,
  "shouldUpdate": true,
  "stageEvidence": [
    "Has working UI components",
    "Authentication system present",
    "Missing: No payment integration",
    "Missing: No error handling"
  ]
}
```

## UI Integration

The AI Review modal shows:
- Detected stage with confidence percentage
- Evidence list (why AI thinks it's that stage)
- Progress percentage for that stage
- "Apply Suggestions" button updates the project:
  - Changes `currentPhase` to `recommendedStage`
  - Updates `phaseProgress[stage]` to `recommendedProgress`

## Automatic Updates

If `shouldUpdate` is true OR confidence >= 70%, clicking "Apply" will:
1. Update project stage
2. Update progress percentage
3. Add timeline event showing the AI-driven update
4. Show in project card

## Testing

1. Restart dev server
2. Go to Projects page
3. Click "AI Review" on a project
4. Wait 5-15 seconds
5. Review the stage detection results
6. Click "Apply Suggestions" to auto-update the project

The AI will now tell you: **"You're claiming to be in 'live' stage, but based on the code, you're actually in 'prototype' at 40%"**
