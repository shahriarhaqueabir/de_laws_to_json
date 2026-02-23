# Task: Fix Translation Buttons (DE/EN Toggles)

## Status: IN_PROGRESS
## Priority: HIGH

### Description
The DE/EN translation toggles in the law modal are periodically failing to translate or causing unwanted UI side effects (like collapsing/expanding the norm header). This task involves fixing the event handling, refining the translation feedback loop, and ensuring the UI states (colors/styles) are correctly managed during and after translation.

### Related Files
- `static/js/translation.js`
- `static/js/modal.js`
- `static/css/main.css`
- `app.py`

### TODO
- [x] Prevent norm expansion when clicking translation toggles in `modal.js`.
- [ ] Fix the UI reset logic in `translation.js` (text stays yellow/italic after translation).
- [ ] Add loading spinner/indicator for individual translations instead of just "Translating..." text if possible, or at least improve the feedback.
- [ ] Verify delegated event listener coverage for all dynamically loaded content (Search results, Saved tab, Modal).
- [ ] Handle Ollama connection issues gracefully in the UI.
