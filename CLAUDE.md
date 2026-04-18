# CLAUDE.md - Instructions for Claude Code

## Project Overview

IT Incident Assistant - An AI-powered incident management tool for IT support teams.

## Key Commands

```bash
npm run dev     # Start development server
npm run build   # Build for production
```

## Architecture

- React 18 with Vite
- Single-page app with tab navigation
- Claude API for AI features
- Optional Ollama integration for local model routing

## Code Style

- Functional components with hooks
- Single-file components (CSS-in-JS with inline styles)
- Vietnamese UI, English code/comments
- Minimal dependencies

## AI Features to Implement

1. **Triage Module**: Input incident description → Output P1-P4 priority, category, suggested team
2. **Root Cause Module**: Input symptoms/logs → Output root cause analysis, fix steps
3. **Resolution Module**: Input actions taken → Output professional resolution summary
4. **Escalation Module**: Input incident details → Output escalation email draft

## API Integration

- Primary: Claude API (claude-sonnet-4-20250514)
- Fallback: Ollama local (llama3) for sensitive data
- Retry with exponential backoff (max 3 attempts)
- Token counting for cost estimation

## Important Patterns

```javascript
// Retry pattern
const fetchWithRetry = async (url, options, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 429) await sleep(Math.pow(2, i) * 1000);
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
};

// Moderation pattern
const moderateInput = (text) => {
  const sensitivePatterns = [/\d{3}-\d{2}-\d{4}/, /password\s*[:=]/i];
  return sensitivePatterns.some(p => p.test(text));
};
```

## Don't

- Don't commit .env files
- Don't use class components
- Don't add unnecessary dependencies
- Don't hardcode API keys
