# TODO — German Law Search System

**Last Updated:** February 23, 2026  
**Status:** Active development

---

## 🎯 Roadmap Overview

This document tracks pending improvements, bug fixes, and feature requests for the German Law Search system. Items are prioritized based on impact and effort.

---

## ✅ Recently Completed

### Dictionary Integration (February 23, 2026)
- [x] TEI dictionary parser (100,000+ terms)
- [x] German→English dictionary database (SQLite, 29 MB)
- [x] Integration with app.py query expansion
- [x] Legal priority terms (326 curated terms)
- [x] Compound word decomposer
- [x] Dictionary lookup API endpoints

### AI Translation Enhancement (February 23, 2026)
- [x] Hybrid translation (dictionary + AI refinement)
- [x] Single-word dictionary lookup (<5ms)
- [x] AI prompt enhancement with dictionary context
- [x] Graceful fallback (dictionary if AI fails)
- [x] Translation source tracking in responses

### Documentation (February 23, 2026)
- [x] AI_GUIDE.md updated
- [x] README.md updated
- [x] AI_TRANSLATION_ENHANCEMENT.md created
- [x] DICTIONARY_INTEGRATION.md created
- [x] API_REFERENCE.md updated with new endpoints
- [x] DOCS_INDEX.md created

---

## 🟢 Low Priority (Future Public Production Migration)

### 1. Public-Facing Security Hardening

**Impact:** High (Only if public) | **Effort:** Medium | **Status:** Pending

*Note: These are only required if migrating from the current secure local team environment to a public, internet-facing domain.*

**Tasks:**
- [ ] Replace admin token auth with session-based authentication
  - Use Flask sessions with secure cookies
  - Or implement OAuth2/JWT tokens with expiration
- [ ] Add request size limits
  ```python
  app.config['MAX_CONTENT_LENGTH'] = 16 * 1024  # 16 KB
  ```
- [x] Sanitize all AI output with DOMPurify before `.innerHTML` (Done: `safeSetHTML` implemented globally)
- [ ] Implement Content Security Policy headers
  ```python
  @app.after_request
  def set_csp(response):
      response.headers['Content-Security-Policy'] = "default-src 'self'"
      return response
  ```

**References:**
- `BACKEND_FRONTEND_REVIEW.md` - Issue #1 (Admin API Key Exfiltration)
- `BACKEND_FRONTEND_REVIEW.md` - Issue #2 (XSS via DOM Manipulation)

---

### 2. Persistent Rate Limiting

**Impact:** Medium | **Effort:** Medium | **Status:** Pending

*Note: Only required for public deployment to deter automated volumetric scraping.*

**Current:** In-memory rate limiting (resets on restart)

**To Implement:**
```python
# Use Flask-Limiter with Redis backend
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    storage_uri="redis://localhost:6379",
    default_limits=["100 per hour", "10 per minute"]
)
```

**Requirements:**
- [ ] Add `flask-limiter` to `requirements.txt`
- [ ] Add Redis dependency (Docker or system package)
- [ ] Configure rate limits per endpoint
- [ ] Add rate limit headers to responses

**Endpoints to Protect:**
- `/api/search` - 30 requests/minute
- `/api/ai_chat` - 5 requests/minute
- `/api/ai_translate` - 60 requests/minute
- `/api/laws` - 60 requests/minute

---

## 🟡 Medium Priority (Performance & UX)

### 3. Frontend Performance Optimization

**Impact:** Medium | **Effort:** Low | **Status:** Pending

**Tasks:**
- [ ] Reduce modal search debounce from 200ms to 50ms
  ```javascript
  const MODAL_SEARCH_DEBOUNCE = 50;  // Faster feedback
  ```
- [ ] Implement request cancellation for vault/tab switching
  ```javascript
  let vaultFetchController = null;
  
  async function fetchVaultLaws() {
      if (vaultFetchController) {
          vaultFetchController.abort();
      }
      vaultFetchController = new AbortController();
      // ... fetch logic
  }
  ```
- [ ] Add AbortController cleanup helper
  ```javascript
  function abortAndClean(controllerRef) {
      if (controllerRef.current) {
          controllerRef.current.abort();
          controllerRef.current = null;
      }
  }
  ```

**References:**
- `BACKEND_FRONTEND_REVIEW.md` - Issue #6 (Modal Search Debounce)
- `BACKEND_FRONTEND_REVIEW.md` - Issue #7 (AbortController Cleanup)

---

### 4. Enhanced Logging & Monitoring

**Impact:** Medium | **Effort:** Low | **Status:** Pending

**Tasks:**
- [ ] Add file logging with rotation
  ```python
  from logging.handlers import RotatingFileHandler
  
  file_handler = RotatingFileHandler('app.log', maxBytes=10*1024*1024, backupCount=5)
  file_handler.setLevel(logging.INFO)
  app.logger.addHandler(file_handler)
  ```
- [ ] Add request/response logging
  ```python
  @app.before_request
  def log_request():
      app.logger.info(f"{request.method} {request.path} from {request.remote_addr}")
  
  @app.after_request
  def log_response(response):
      app.logger.info(f"Response {response.status_code} for {request.path}")
      return response
  ```
- [ ] Add search analytics (optional, privacy-compliant)
  - Track popular queries
  - Track zero-result queries
  - Track search latency

**Configuration:**
```bash
# Environment variables
LOG_FILE=app.log
LOG_MAX_SIZE=10485760  # 10 MB
LOG_BACKUP_COUNT=5
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR
```

---

### 5. Citation Search Enhancement

**Impact:** Medium | **Effort:** Low | **Status:** Partially Implemented

**Current:** Query truncation to 300 chars for citation detection

**To Improve:**
- [ ] Add explicit request size validation
  ```python
  @app.route("/api/search", methods=["POST"])
  def api_search():
      data = request.get_json(force=True, silent=True) or {}
      query = (data.get("query") or "").strip()
      
      if len(query) > 500:
          return jsonify({"error": "Query too long (max 500 chars)"}), 400
  ```
- [ ] Improve citation regex for edge cases
  - Support "Artikel" vs "Art."
  - Support paragraph symbols in multiple encodings
  - Handle case-insensitive law abbreviations

---

## 🟢 Low Priority (Quality of Life)

### 6. Code Cleanup

**Impact:** Low | **Effort:** Low | **Status:** Pending

**Tasks:**
- [ ] Remove unused CSS classes (audit with CSS tools)
- [ ] Fix TODO.md items from frontend review:
  - [ ] History JS half-present - Add missing HTML elements
  - [ ] `searchTimeout` unused - Wire up debounce for main search input
  - [ ] `typeof aiAbortController` unnecessary - Simplify condition
  - [ ] `sidebarAdminAction` implicit event - Pass event explicitly
- [ ] Remove dead code in `rebindModalToggles` (empty if block)
- [ ] Simplify `renderResults` async (remove unnecessary async/await)

**References:**
- `TODO.md` (original file) - Frontend Issues Fixes
- `BACKEND_FRONTEND_REVIEW.md` - Issue #14 (TODO Items)

---

### 7. UI/UX Improvements

**Impact:** Low | **Effort:** Medium | **Status:** Pending

**Tasks:**
- [ ] Add skeleton loaders for all async operations
  - Search results loading
  - Law detail loading
  - AI response streaming
- [ ] Improve error messages
  - User-friendly error for Ollama timeout
  - Clear message for no search results
  - Helpful error for network failures
- [ ] Add keyboard shortcuts
  - `Ctrl+K` or `/` to focus search
  - `Esc` to close modal
  - Arrow keys to navigate results
- [ ] Add result count to search results
  - "Showing 1-20 of 150 results"
- [ ] Improve mobile responsiveness
  - Test on various screen sizes
  - Optimize touch targets

---

### 8. Testing Infrastructure

**Impact:** Low | **Effort:** Medium | **Status:** Pending

**Tasks:**
- [ ] Add unit tests for backend
  ```python
  # tests/test_search.py
  def test_tokenize():
      assert tokenize("Hello World!") == ["hello", "world"]
  
  def test_expand_query():
      tokens, german = expand_query("tenant rights")
      assert "mieter" in german
  ```
- [ ] Add integration tests
  ```python
  # tests/test_api.py
  def test_search_api():
      response = client.post("/api/search", json={"query": "miete"})
      assert response.status_code == 200
      assert "results" in response.json()
  ```
- [ ] Add frontend tests (vanilla JS)
  - Test search input handling
  - Test modal rendering
  - Test bookmark functionality
- [ ] Add performance tests
  - Measure search latency
  - Measure index build time
  - Track memory usage

**Requirements:**
- Add `pytest` to `requirements.txt`
- Create `tests/` directory
- Set up test fixtures (sample JSON files)

---

## 📋 Feature Requests

### 9. Advanced Search Features

**Impact:** Medium | **Effort:** High | **Status:** Proposed

**Features:**
- [ ] Boolean search operators (AND, OR, NOT)
- [ ] Phrase search with quotes ("exact phrase")
- [ ] Field-specific search (title:, norm_id:, category:)
- [ ] Date range filtering
- [ ] Sort by relevance, date, or alphabetically

**Example:**
```
category:housing "eigenbedarf" AND kündigung
```

---

### 10. Export Functionality

**Impact:** Low | **Effort:** Medium | **Status:** Proposed

**Features:**
- [ ] Export search results to PDF
- [ ] Export law to JSON/XML
- [ ] Export paragraph citations to clipboard
- [ ] Print-friendly view

**API Endpoint:**
```python
@app.route("/api/law/<path:key>/export")
def api_export_law(key: str):
    format = request.args.get("format", "json")
    # Return PDF, JSON, or XML
```

---

### 11. User Bookmarks Sync

**Impact:** Low | **Effort:** High | **Status:** Proposed

**Current:** Bookmarks stored in localStorage (browser-specific)

**To Implement:**
- [ ] Optional user accounts (email/password or OAuth)
- [ ] Sync bookmarks across devices
- [ ] Share bookmark collections
- [ ] Export/import bookmarks

**Note:** This would require significant backend changes and database integration.

---

### 12. Multi-Language Support

**Impact:** Medium | **Effort:** High | **Status:** Partially Implemented

**Current:** English UI with German law text + optional AI translation

**To Enhance:**
- [ ] Full UI localization (i18n)
  - German UI
  - Other languages (French, Spanish, etc.)
- [ ] Professional translations for common law titles
- [ ] Community-contributed translations

**Requirements:**
- Add i18n library (e.g., Flask-Babel)
- Create translation files (`.po` files)
- Add language switcher in UI

---

## 🐛 Known Bugs

### 13. Modal Scroll Position Lost

**Severity:** Low | **Status:** Confirmed

**Issue:** When clicking a norm in modal, scroll position resets

**Reproduction:**
1. Open law with 100+ norms
2. Scroll to norm #50
3. Click to expand
4. Scroll position lost

**Fix:** Save/restore scroll position on norm toggle

---

### 14. Translation Cache Race Condition

**Severity:** Low | **Status:** Theoretical

**Issue:** Multiple simultaneous translation requests for same text could cause duplicate API calls

**Fix:** Add request deduplication for in-flight translation requests

---

### 15. Search Index Stale After Updates

**Severity:** Low | **Status:** By Design

**Issue:** If JSON files are modified while app is running, index becomes stale

**Current Workaround:**
- Restart app to rebuild index
- Or use admin endpoint: `POST /api/admin/rebuild_index`

**To Fix:** Add file watcher to auto-rebuild index on changes

---

## ✅ Completed (Recent)

### ✅ Thread-Safe Index Building
- **Date:** Completed
- **Description:** Implemented atomic index swap with locks
- **Reference:** `app.py` lines 1025-1030

### ✅ LRU Query Expansion Cache
- **Date:** Completed
- **Description:** OrderedDict-based LRU eviction for query cache
- **Reference:** `app.py` lines 754-760

### ✅ Atomic Translation Cache Saves
- **Date:** Completed
- **Description:** Background thread saves translations every 30s
- **Reference:** `app.py` lines 1245-1255

### ✅ Ollama Retry Logic
- **Date:** Completed
- **Description:** Exponential backoff with configurable retries
- **Reference:** `app.py` lines 1353-1375

### ✅ Rate Limiting (In-Memory)
- **Date:** Completed
- **Description:** Per-IP rate limiting with sliding window
- **Reference:** `app.py` lines 73-111

---

## 📊 Priority Matrix

| Priority | Items | Total Effort |
|----------|-------|--------------|
| 🔴 High | 2 | ~3 days |
| 🟡 Medium | 3 | ~2 days |
| 🟢 Low | 3 | ~1 day |
| 📋 Features | 4 | ~2 weeks |
| 🐛 Bugs | 3 | ~4 hours |

---

## 🎯 Next Sprint (Recommended)

**Focus:** Production Readiness

1. **Security Hardening** (Item #1) - 1 day
2. **Persistent Rate Limiting** (Item #2) - 1 day
3. **Enhanced Logging** (Item #4) - 0.5 days
4. **Frontend Performance** (Item #3) - 0.5 days

**Total:** 3 days

---

## 📝 Contributing

To contribute to this project:

1. Pick an item from this TODO list
2. Create a feature branch
3. Implement the change
4. Test thoroughly
5. Submit a pull request

For major changes, open an issue first to discuss.

---

**Maintained by:** Development Team  
**Last Review:** February 23, 2026  
**Next Review:** After completing High Priority items
