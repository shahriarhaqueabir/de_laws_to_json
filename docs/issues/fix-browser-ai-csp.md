# Issue: Fix Browser AI WASM Loading (CSP blocks Transformers.js)

**Priority:** High
**Area:** Chat / AI, Infrastructure
**Labels:** bug, browser-ai, csp

## Description
Browser AI mode cannot load WASM binaries because the Content Security Policy blocks `blob:` script execution. Transformers.js (via onnxruntime-web) dynamically creates `blob:` URLs to load WASM files, and these are blocked by the `script-src` directive.

## Error
```
Loading the script 'blob:http://localhost:3000/...' violates the following Content Security Policy directive:
"script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net"
```

## Current State
- CSP updated to include `blob:` in both `script-src` and `script-src-elem`
- Need to verify after Vercel redeploy
- Dev server must be restarted to pick up new headers

## Acceptance Criteria
- [ ] Browser AI mode loads Transformers.js without CSP errors
- [ ] WASM binary loads successfully from `cdn.jsdelivr.net`
- [ ] Model inference works end-to-end in browser mode
- [ ] No security regression from CSP relaxation

## Investigation Needed
1. Add CSP `report-uri` or `report-to` directive to catch violations in production
2. Verify if `wasm-unsafe-eval` is needed in `script-src-elem`
3. Check if onnxruntime-web version update fixes blob: loading
