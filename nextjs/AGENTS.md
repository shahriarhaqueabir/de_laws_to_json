<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Architecture Guidelines

- **Local AI Connectivity**: The bridge to local Ollama (port 9000) is **client-side only**. Cloud-hosted frontends (Vercel) cannot reach `localhost` via server-side props/API routes. Use the `ChatProvider` and client-side `fetch` to `localhost:9000`.
- **Managed Inference**: Qdrant Universal Query API requires the explicit `{ query: { text: string, model: string } }` structure for managed inference. 
    - **Current Model**: `intfloat/multilingual-e5-small`
    - **Specs**: Dense vector, 384 dimensions, 512 token context window.
    - **Constraint**: Raw strings or missing model keys trigger 400 errors.
- **Persistence**: 
    - Guest users: `sessionStorage` (key: `glv_guest_chat`). Cleared upon successful sign-in.
    - Authenticated: Supabase `conversations` and `messages` tables.
- **Design System**: Strict adherence to "Cinematic Legal Authority" (Obsidian/Basalt/Gold). No em-dashes (`—`) in UI; use hyphens (`-`) only.
<!-- END:nextjs-agent-rules -->
