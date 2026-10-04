# Quick Grok API Test

## 1. Test Your API Key

Run this curl command to verify your Grok API key works:

```bash
curl https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_GROK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-beta",
    "messages": [{"role": "user", "content": "Say hello"}]
  }'
```

Expected response:
```json
{
  "choices": [{
    "message": {
      "content": "Hello! How can I help you today?"
    }
  }]
}
```

## 2. Common Issues

### Issue: 401 Unauthorized
**Cause**: Invalid API key
**Fix**: 
- Get a new key from https://x.ai/api
- Ensure it starts with `xai-`
- Verify no extra spaces in the env variable

### Issue: 400 Bad Request
**Cause**: Invalid model name or request format
**Fix**:
- Currently using: `grok-4-1-fast-reasoning`
- Other options: `grok-beta`, `grok-2-latest`, `grok-2-vision-1212`

### Issue: 429 Rate Limited
**Cause**: Too many requests
**Fix**: Wait a minute and try again

## 3. Alternative: Use OpenAI

If Grok isn't working, OpenAI is already configured as fallback:

```bash
# .env.local
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

The app will automatically use OpenAI if Grok fails.

## 4. Debug Mode

To see what's happening, check the server console. The code now logs:
- API key prefix (for verification)
- Full request body
- Response status and error messages
- Token usage

Look for lines starting with:
- `🔑 Using Grok API key`
- `📤 Request to Grok API`
- `❌ Grok API error`
