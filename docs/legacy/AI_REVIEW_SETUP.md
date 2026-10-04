# AI Review Implementation Summary

## Overview
The AI-powered code review feature is now fully implemented with **Grok as the primary provider** and OpenAI as a fallback.

## Environment Variables

Add these to your `.env.local` file:

```bash
# AI API Keys (Grok is primary, OpenAI is fallback)
# Get Grok API key from: https://x.ai/api
GROK_API_KEY=your_grok_api_key_here
# Get OpenAI API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here
```

⚠️ **Important**: Use `GROK_API_KEY` (without NEXT_PUBLIC_) for server-side security. The code also accepts `NEXT_PUBLIC_GROK_API_KEY` for backward compatibility.

## How It Works

### 1. AI Service Architecture
- **Server-side only**: `src/lib/ai-service-server.ts` handles all AI API calls
- **Client-side stub**: `src/lib/ai-service.ts` provides client-side helper functions
- **API Routes**: 
  - `POST /api/projects/[id]/ai-review` - Analyze code
  - `POST /api/projects/[id]/sync-commits` - Analyze commits

### 2. Provider Priority
1. **Grok (Primary)**: Used if `GROK_API_KEY` is set
2. **OpenAI (Fallback)**: Used if Grok fails or if only `OPENAI_API_KEY` is set
3. **Error**: Returns 503 if no API keys are configured

### 3. What Gets Analyzed

#### Code Review (`/ai-review`)
- Fetches key files from GitHub repo (README, source files, configs)
- Sends to AI with project context (name, stage, tech stack)
- Returns:
  - `completenessScore`: 0-100% code completion
  - `bugsFound`: Array of potential issues
  - `suggestions`: Improvement recommendations
  - `recommendedStage`: Suggested pipeline stage
  - `recommendedProgress`: Suggested progress percentage
  - `shouldUpdate`: Whether to auto-update the project

#### Commit Analysis (`/sync-commits`)
- Fetches recent commits from GitHub
- AI analyzes commit messages and diffs
- Returns:
  - `featuresAdded`: List of features from commits
  - `bugsFixed`: Bugs that were fixed
  - `progressIndicators`: Signs of progress
  - Stage and progress recommendations

### 4. UI Integration

**Project Card** (`ProjectCard` component):
- Shows "AI Review" button
- Displays latest AI analysis score
- Shows staleness warning (red if no activity >7 days)
- Click button to open AI Review modal

**AI Review Modal** (`AIReviewModal` component):
- Lists all past AI reviews
- Shows analysis details (completeness, bugs, suggestions)
- "Apply Suggestions" button updates project stage/progress
- "Run AI Review" button to request new analysis

**Project Detail Page** (Overview tab):
- Shows checklist for current phase sub-tasks
- Phase progress bars with completion indicators
- AI Reviews tab shows all historical reviews

## Testing the AI Review

1. **Configure API Keys**:
   ```bash
   # Add to .env.local
   GROK_API_KEY=xai-xxxxxxxxxxxxxxxxxxxxxxxx
   ```

2. **Restart Next.js dev server**:
   ```bash
   npm run dev
   ```

3. **Test with a project**:
   - Go to Projects page
   - Click on a project with a GitHub repo linked
   - Click "AI Review" button in the card
   - Wait for analysis (takes 5-15 seconds)
   - Review results in the modal

4. **Check Server Logs**:
   The API route logs helpful debug info:
   ```
   🤖 Using AI provider: grok (Grok: true, OpenAI: false)
   🔍 Analyzing code for project: MyProject (idea stage)
   📄 Code length: 5423 characters
   ✅ Grok API responded in 3200ms (status: 200)
   📊 Grok used 1456 tokens
   📝 Raw AI response: {"summary": "...", ...}
   ✅ Successfully parsed AI response
   📊 Completeness Score: 78
   🐛 Bugs Found: 1
   💡 Suggestions: 2
   ```

## Troubleshooting

### 503 Error: "AI service not configured"
- Check that `GROK_API_KEY` or `OPENAI_API_KEY` is set in `.env.local`
- Restart the dev server after adding env vars

### 400 Error from Grok API
The 400 error usually means:
1. **Invalid API Key**: Grok keys should start with `xai-`. Check your key at https://x.ai/api
2. **Wrong Model Name**: The code uses `grok-beta` which is the current production model
3. **Rate Limiting**: You may have hit rate limits
4. **Billing Issue**: Your x.ai account may need billing setup

**To debug**:
1. Check server logs for the full error message
2. Verify your API key format: `GROK_API_KEY=xai-xxxxxxxx`
3. Try testing with curl:
   ```bash
   curl https://api.x.ai/v1/chat/completions \
     -H "Authorization: Bearer $GROK_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"grok-beta","messages":[{"role":"user","content":"Hello"}]}'
   ```

### 500 Error: "Failed to perform AI code review"
- Check server console logs for specific error
- Verify GitHub repo URL is valid and accessible
- Try with a public repo first to rule out auth issues

### AI Returns No Results
- Ensure project has a GitHub repo linked
- Code should be at least 100 characters
- Check that repo has readable source files

## API Response Format

The AI always returns JSON in this format:

```json
{
  "summary": "Brief analysis summary",
  "completenessScore": 85,
  "bugsFound": ["Potential bug 1", "Bug 2"],
  "suggestions": ["Add error handling", "Write tests"],
  "recommendedStage": "prototype",
  "recommendedProgress": 75,
  "shouldUpdate": true
}
```

## Cost Considerations

- **Grok**: Check x.ai pricing (currently has free tier)
- **OpenAI**: gpt-4o-mini is very cost-effective (~$0.15 per 1M tokens)
- Each code review uses ~1000-2000 tokens
- 100 reviews ≈ $0.30-0.60 with OpenAI

## Security Notes

- API keys are server-side only (not exposed to browser)
- Code is sent directly from server to AI provider
- No code is stored permanently (only analysis results)
- Users can only analyze their own linked repos
