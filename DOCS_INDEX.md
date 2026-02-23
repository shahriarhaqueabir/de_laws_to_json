# Documentation Index

**German Law Search System**  
**Last Updated:** February 23, 2026

---

## 📚 Documentation Overview

This directory contains comprehensive documentation for the German Law Search System. Use this index to find the right documentation for your needs.

---

## 🎯 Quick Navigation

| Document | Purpose | Audience | Priority |
|----------|---------|----------|----------|
| [README.md](README.md) | Getting started, setup, usage | All users | 🔴 Essential |
| [AI_GUIDE.md](AI_GUIDE.md) | AI agent handover guide | AI agents, developers | 🔴 Essential |
| [API_REFERENCE.md](API_REFERENCE.md) | Complete API documentation | Developers | 🔴 Essential |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design & architecture | Developers, architects | 🟡 Important |
| [BACKEND_FRONTEND_REVIEW.md](BACKEND_FRONTEND_REVIEW.md) | Code review status report | Developers, reviewers | 🟡 Important |
| [TODO.md](TODO.md) | Pending tasks & roadmap | Developers, contributors | 🟡 Important |

---

## 📖 Document Descriptions

### [README.md](README.md) — User Guide

**Purpose:** Getting started, setup instructions, basic usage  
**Audience:** All users (technical and non-technical)  
**Size:** ~400 lines

**Contents:**
- Quick start guide (one-click setup)
- Manual installation steps
- Project structure overview
- Configuration options
- Basic usage examples
- Troubleshooting

**When to use:**
- First time setup
- Quick reference for commands
- Sharing with new team members

---

### [AI_GUIDE.md](AI_GUIDE.md) — AI Agent Handover

**Purpose:** Comprehensive guide for AI agents taking over development  
**Audience:** AI agents, LLMs, new developers  
**Size:** ~600 lines

**Contents:**
- Quick start for AI agents
- System architecture overview
- Search engine details (TF-IDF, query expansion)
- AI integration (Ollama configuration)
- Data schemas
- Development guidelines
- Common tasks and modifications
- Troubleshooting

**When to use:**
- Handing over to AI agent
- Understanding internal workings
- Making code modifications
- Debugging complex issues

---

### [API_REFERENCE.md](API_REFERENCE.md) — API Documentation

**Purpose:** Complete API endpoint reference  
**Audience:** Developers, API consumers  
**Size:** ~700 lines

**Contents:**
- All public endpoints
- Request/response schemas
- Error codes and handling
- Rate limiting details
- cURL, JavaScript, Python examples
- Response time benchmarks

**Endpoints Documented:**
- `GET /api/status` — System status
- `POST /api/search` — Search laws
- `GET /api/laws` — List laws
- `GET /api/law/:key` — Get law details
- `POST /api/ai_translate` — Translate text
- `POST /api/ai_chat` — AI legal chat
- `GET/POST /api/admin/*` — Admin endpoints

**When to use:**
- Building integrations
- Understanding API behavior
- Testing endpoints
- Writing client code

---

### [ARCHITECTURE.md](ARCHITECTURE.md) — System Design

**Purpose:** Detailed system architecture and design decisions  
**Audience:** Developers, architects, technical reviewers  
**Size:** ~900 lines

**Contents:**
- High-level architecture diagrams
- Architectural patterns (Layered, CQRS, Repository)
- Data flow diagrams
- Component breakdown
- Data models and schemas
- Security architecture
- Performance metrics
- Deployment patterns
- Design decisions and trade-offs

**Diagrams:**
- System overview
- Search query flow
- Law processing pipeline
- AI translation flow

**When to use:**
- Understanding system design
- Planning major changes
- Technical reviews
- Onboarding architects

---

### [BACKEND_FRONTEND_REVIEW.md](BACKEND_FRONTEND_REVIEW.md) — Code Review

**Purpose:** Status report of code review findings  
**Audience:** Developers, security reviewers, QA  
**Size:** ~550 lines

**Contents:**
- Executive summary
- Critical issues (security)
- High-priority issues (bugs, performance)
- Medium-priority issues (maintainability)
- Low-priority issues (cleanup)
- Status tracking (Resolved, Mitigated, Pending)
- Testing checklist

**Issues Tracked:**
- Security vulnerabilities (XSS, auth)
- Performance bottlenecks
- Race conditions
- Code quality issues

**When to use:**
- Security audits
- Code quality reviews
- Planning fixes
- Compliance checks

---

### [TODO.md](TODO.md) — Roadmap & Tasks

**Purpose:** Pending improvements and feature requests  
**Audience:** Developers, contributors, project managers  
**Size:** ~400 lines

**Contents:**
- High priority tasks (production readiness)
- Medium priority tasks (performance, UX)
- Low priority tasks (cleanup, quality of life)
- Feature requests
- Known bugs
- Completed items
- Priority matrix

**Task Categories:**
- 🔴 High Priority (2 items) — Security, rate limiting
- 🟡 Medium Priority (3 items) — Performance, logging
- 🟢 Low Priority (3 items) — Cleanup, UX
- 📋 Feature Requests (4 items) — Advanced search, export
- 🐛 Known Bugs (3 items) — Minor issues

**When to use:**
- Planning sprints
- Contributing to project
- Tracking progress
- Roadmap planning

---

## 🔍 Finding Information

### By Topic

#### Setup & Installation
- [README.md](README.md) — Quick start, manual setup
- [AI_GUIDE.md](AI_GUIDE.md) — Environment configuration

#### API Usage
- [API_REFERENCE.md](API_REFERENCE.md) — All endpoints
- [README.md](README.md) — Basic examples

#### Architecture
- [ARCHITECTURE.md](ARCHITECTURE.md) — System design
- [AI_GUIDE.md](AI_GUIDE.md) — Component overview

#### Security
- [BACKEND_FRONTEND_REVIEW.md](BACKEND_FRONTEND_REVIEW.md) — Security issues
- [ARCHITECTURE.md](ARCHITECTURE.md) — Security architecture

#### Development
- [AI_GUIDE.md](AI_GUIDE.md) — Modification guidelines
- [TODO.md](TODO.md) — Pending tasks
- [API_REFERENCE.md](API_REFERENCE.md) — Testing examples

#### Troubleshooting
- [README.md](README.md) — Common issues
- [AI_GUIDE.md](AI_GUIDE.md) — Debugging guide

---

### By Role

#### End Users
Start with: [README.md](README.md)

#### Developers
Start with: [AI_GUIDE.md](AI_GUIDE.md) → [API_REFERENCE.md](API_REFERENCE.md) → [ARCHITECTURE.md](ARCHITECTURE.md)

#### AI Agents
Start with: [AI_GUIDE.md](AI_GUIDE.md)

#### Architects
Start with: [ARCHITECTURE.md](ARCHITECTURE.md) → [BACKEND_FRONTEND_REVIEW.md](BACKEND_FRONTEND_REVIEW.md)

#### Security Reviewers
Start with: [BACKEND_FRONTEND_REVIEW.md](BACKEND_FRONTEND_REVIEW.md) → [ARCHITECTURE.md](ARCHITECTURE.md)

#### Contributors
Start with: [TODO.md](TODO.md) → [AI_GUIDE.md](AI_GUIDE.md)

---

## 📊 Documentation Metrics

| Metric | Value |
|--------|-------|
| Total documentation files | 6 |
| Total lines | ~3,550 |
| Total size | ~112 KB |
| Last updated | February 23, 2026 |
| Coverage | Setup, API, Architecture, Security, Roadmap |

---

## 🔄 Update Process

### When to Update Documentation

1. **After major code changes:**
   - Update [AI_GUIDE.md](ARCHITECTURE.md) if architecture changes
   - Update [API_REFERENCE.md](API_REFERENCE.md) if API changes
   - Update [TODO.md](TODO.md) if new tasks identified

2. **After bug fixes:**
   - Update [BACKEND_FRONTEND_REVIEW.md](BACKEND_FRONTEND_REVIEW.md) with status

3. **After feature completion:**
   - Move item from [TODO.md](TODO.md) to "Completed" section
   - Update [README.md](README.md) with new feature usage

4. **Regular reviews:**
   - Review all docs monthly for accuracy
   - Update version numbers and dates

### Documentation Standards

1. **Code blocks:** Use language-specific syntax highlighting
2. **Tables:** Use for structured data (parameters, responses)
3. **Links:** Use relative links for internal docs
4. **Headers:** Follow hierarchy (H1 → H2 → H3)
5. **Examples:** Provide real, testable examples

---

## 📝 Quick Reference

### Most Common Commands

```bash
# Full setup (Windows)
.\run_dashboard.bat

# Manual pipeline
python download_de_laws.py
python process_de_laws.py
python app.py

# Test API
curl http://localhost:5000/api/status
curl -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "tenant rights"}'
```

### Key URLs

| URL | Purpose |
|-----|---------|
| http://localhost:5000 | Dashboard |
| http://localhost:5000/api/status | System status |
| https://www.gesetze-im-internet.de/ | Source data |

### Key Files

| File | Purpose |
|------|---------|
| `app.py` | Flask backend (1,870+ lines) |
| `templates/index.html` | Frontend (3,230+ lines) |
| `de_federal_json/` | Processed laws (6,500+ files) |
| `search_index.json` | Search index cache |

---

## 🔗 External Resources

- **Source Data:** https://www.gesetze-im-internet.de/
- **Ollama:** https://ollama.ai/
- **Flask:** https://flask.palletsprojects.com/
- **BeautifulSoup:** https://www.crummy.com/software/BeautifulSoup/

---

## 📞 Support

For questions or issues:

1. Check relevant documentation file
2. Review [TODO.md](TODO.md) for known issues
3. Inspect [BACKEND_FRONTEND_REVIEW.md](BACKEND_FRONTEND_REVIEW.md) for security concerns
4. Use admin endpoint: `GET /api/admin/info`

---

**Maintained by:** Development Team  
**Last Review:** February 23, 2026  
**Next Review:** After major changes or monthly
