# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

Only the latest deployment on Vercel receives security updates. We do not maintain backport releases.

## Reporting a Vulnerability

German Law Vault handles user data including encrypted AI provider API keys, authentication tokens, and bookmark content. We take security seriously.

**Please do not report vulnerabilities via public GitHub issues.**

Instead, report them privately using one of the following methods:

1. **GitHub Private Vulnerability Reporting** (preferred):
   Go to https://github.com/shahriarhaqueabir/AI-Assisted-German-Law/security/advisories/new

2. **Email**: [shahriarhaqueabir@gmail.com](mailto:shahriarhaqueabir@gmail.com)

You can expect an acknowledgement within 48 hours and a detailed response within 5 business days, including next steps and a target timeline for a fix.

## Scope

The following areas are in scope for security reports:

- **API endpoints** — authentication bypass, data leakage, injection
- **AI provider key storage** — AES-256-GCM encryption mechanism (`lib/encryption.ts`)
- **Supabase** — Row Level Security policies, auth flows
- **Qdrant** — vector search access control
- **Client-side** — XSS, CSRF, localStorage data exposure
- **CI/CD** — secret exposure in build logs, artifact leakage
- **Dependencies** — supply chain vulnerabilities (npm packages, GitHub Actions)

## Out of Scope

- Reports about the underlying German federal law texts (BGB, StGB, etc.) — these are public domain documents from gesetze-im-internet.de
- Feature requests disguised as security issues
- Issues requiring physical access, social engineering, or denial of service

## Hall of Fame

We thank the following reporters for their contributions to improving the security of German Law Vault:

_(No reports yet — be the first!)_

## Security Measures

This project employs:

- **Gitleaks** pre-commit hook and CI scanning to prevent hardcoded secrets
- **Supabase RLS** on all user-owned tables (`bookmarks`, `bookmark_folders`, `conversations`, `case_files`, `guidance_paths`, `user_api_keys`)
- **AES-256-GCM encryption** for stored API provider keys
- **Graceful degradation** — external service failures never expose internal state
- **Strict TypeScript** — no `any` or `@ts-ignore` to prevent type-safety bypasses
