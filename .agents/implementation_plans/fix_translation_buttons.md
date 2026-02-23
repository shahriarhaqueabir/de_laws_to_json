# Implementation Plan - Fix Translation Buttons

Fix the DE/EN toggle functionality across the application, focusing on the law modal, search results, and saved items.

## Phase 1: Robust Event Handling (Completed/Verify)
- [x] **Event Bubbling Fix**: Ensure `.dict-toggle-btn` clicks do not trigger parent element listeners (e.g., expanding/collapsing norm headers).
- [ ] **Delegation Audit**: Verify that `document.body.addEventListener('click', ...)` correctly captures clicks on all `.dict-toggle-btn` elements, including those in the shadow DOM or `<dialog>` if applicable (currently standard elements).

## Phase 2: UI/UX Refinement in `translation.js`
- [ ] **State Restoration**: After `translateWithAI` completes, reset `fontStyle` and `color` of the `textElement` to normal, or a specific "translated" style that is legible and doesn't look like a loading state.
- [ ] **Error Messaging**: If translation fails or returns the same text, provide subtle feedback to the user and revert the loading state.
- [ ] **Button Visuals**: Ensure the `.active` class toggle is reliable and that multiple rapid clicks are ignored or handled (already has `active` check).

## Phase 3: Backend & Integration
- [x] **Ollama connectivity**: Verify the backend handles Ollama downtime by falling back to the dictionary or returning the original text without crashing.
- [ ] **Cache check**: Ensure the translation cache is being utilized to speed up repeated requests.

## Phase 4: Verification
- [ ] Run browser-based tests to simulate user interaction in Search, Browse, and Saved tabs.
- [ ] Check console for silent errors during translation.
