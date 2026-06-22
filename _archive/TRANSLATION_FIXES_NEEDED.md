"""
Translation System - Remaining Issues & Action Plan

Date: 2026-02-24
"""

## CRITICAL: What Still Needs Fixing

### 1. Concurrent Request Hangs (BLOCKING)

**Problem:** Flask development server deadlocks with concurrent requests

**Current Code (app.py line 2413):**
```python
app.run(host=HOST, port=PORT, debug=False, use_reloader=False, threaded=True)
```

**Why threaded=True isn't enough:**
- Flask's development server is NOT production-ready
- Python GIL (Global Interpreter Lock) causes thread contention
- Ollama HTTP calls block worker threads

**SOLUTION OPTIONS:**

#### Option A: Use Waitress WSGI Server (RECOMMENDED)
```bash
# Install
pip install waitress

# Run instead of python app.py
waitress-serve --port=5000 --threads=8 app:app
```

**Why:** Waitress is production-grade, handles concurrent requests properly

#### Option B: Increase Flask Thread Pool
```python
# app.py - Change line 2413 to:
from werkzeug.serving import run_simple
run_simple(HOST, PORT, app, threaded=True, processes=1, 
           extra_files=None, reloader_type='auto', 
           threaded_args={'thread_pool_size': 16})
```

**Why:** More threads = less contention (but still not production-ready)

#### Option C: Use Gunicorn (Linux/Mac only)
```bash
# Install
pip install gunicorn

# Run
gunicorn -w 4 -b 127.0.0.1:5000 app:app
```

**Why:** Industry standard, but doesn't work well on Windows

---

### 2. No Loading Indicator (UX)

**Problem:** User clicks EN, sees nothing, thinks it's broken

**Fix in translation.js:**
```javascript
// Line ~60, after setting is-translating class
textElement.classList.add('is-translating');
textElement.style.opacity = '0.6';  // Visual feedback
textElement.innerHTML = '<span class="spinner-small"></span>';  // Show spinner
```

**CSS to add (main.css):**
```css
.spinner-small {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid #ccc;
  border-top-color: #c99b38;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.is-translating {
  position: relative;
  pointer-events: none;  /* Prevent double-clicks */
}
```

---

### 3. No Error Feedback (UX)

**Problem:** Translation fails silently, user confused

**Fix in translation.js:**
```javascript
// Line ~85, in catch block
catch (err) {
  console.error("Translation error:", err);
  textElement.textContent = sourceText;
  
  // ADD: User feedback
  showToast("Translation unavailable - showing German text", "warning");
  
  // Re-enable DE button
  group.querySelector('.dict-toggle-btn[data-lang="de"]')?.click();
}

// ADD: Toast notification function
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 24px;
    background: ${type === 'warning' ? '#f59e0b' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
```

---

### 4. AI Timeout Too Short (RELIABILITY)

**Problem:** 15-second timeout aborts AI requests under load

**Current (translation.js line 10):**
```javascript
const timeoutId = setTimeout(() => controller.abort(), 15000);
```

**Fix:**
```javascript
// Increase to 30 seconds for complex legal texts
const timeoutId = setTimeout(() => controller.abort(), 30000);
```

**Better Fix:** Add retry logic
```javascript
async function callAIForRefinement(originalGerman, isTitle, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch("/api/ai_translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: originalGerman, is_title: isTitle }),
        keepalive: true
      });

      if (resp.ok) {
        const data = await resp.json();
        return (data.translation && data.translation !== originalGerman) 
          ? data.translation 
          : null;
      }
      
      if (attempt === retries) return null;  // Give up
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));  // Backoff
    } catch (err) {
      if (attempt === retries) return null;
      console.warn(`AI attempt ${attempt + 1} failed:`, err);
    }
  }
  return null;
}
```

---

### 5. Non-Blocking AI Updates (UX)

**Problem:** UI waits for AI before showing any translation

**Current (translation.js line ~65):**
```javascript
const [dictResp, aiPromise] = await Promise.all([...]);
// ...
const aiTranslation = await aiPromise;  // ← BLOCKS HERE
```

**Fix - Show dict immediately, update with AI later:**
```javascript
// Get dictionary translation
const dictResp = await fetch("/api/fast_translate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: sourceText, is_title: isTitle })
});

const dictData = await dictResp.json();
if (dictData.translation && dictData.translation !== sourceText) {
  textElement.textContent = dictData.translation;
  textElement.classList.add('is-translated');
}

// AI refinement happens in background (non-blocking)
callAIForRefinement(sourceText, isTitle).then(aiTranslation => {
  if (aiTranslation && aiTranslation !== dictData.translation) {
    textElement.textContent = aiTranslation;
    textElement.classList.add('ai-refined');
    console.log("AI refined:", sourceText, "→", aiTranslation);
  }
}).catch(err => {
  console.warn("AI refinement failed (non-fatal):", err);
  // Don't show error - dictionary translation already displayed
});
```

---

## ACTION PLAN - Priority Order

### IMMEDIATE (Do Now)
1. **Install Waitress** - Fixes concurrent request hangs
   ```bash
   pip install waitress
   ```

2. **Update run_dashboard.bat** - Use Waitress instead of Flask dev server
   ```batch
   :: Replace line that runs python app.py with:
   .venv\Scripts\waitress-serve --port=5000 --threads=8 app:app
   ```

3. **Add loading indicator** - User feedback
   - Add CSS spinner to main.css
   - Add opacity change during translation

### SHORT-TERM (This Week)
4. **Add error toast notifications** - User feedback on failures
5. **Increase AI timeout to 30s** - Reduce aborts
6. **Make AI non-blocking** - Show dict translation immediately

### MEDIUM-TERM (Next Week)
7. **Add retry logic for AI** - Handle transient failures
8. **Pre-translate popular laws** - Cache AI results for top 100 laws
9. **Add translation analytics** - Track which translations fail most

---

## TESTING CHECKLIST

After applying fixes:

- [ ] Single translation works (curl test)
- [ ] 10 concurrent translations don't hang
- [ ] Modal EN toggle shows loading spinner
- [ ] Failed translation shows toast message
- [ ] AI refinement completes within 30s
- [ ] Dictionary translation shows immediately
- [ ] AI updates text when it completes
- [ ] No console errors in browser

---

## FILES TO MODIFY

1. **requirements.txt** - Add `waitress==2.1.2`
2. **run_dashboard.bat** - Use waitress-serve
3. **static/js/translation.js** - Non-blocking AI, error handling
4. **static/css/main.css** - Loading spinner styles
5. **app.py** - (Optional) Increase AI timeout env var

---

## WHY THIS MATTERS

**Current State:**
- User clicks EN → waits 2 seconds → nothing happens → thinks it's broken

**After Fixes:**
- User clicks EN → sees spinner → dictionary translation appears instantly → AI refines 3 seconds later → User happy

The difference is **user feedback** and **perceived performance**.

---

*Created: 2026-02-24 18:10*
*Status: Action Plan Ready*
