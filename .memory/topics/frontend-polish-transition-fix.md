# Frontend Polish Pass — transition-all Fixes + Corrupted File Recovery

## Summary

Fixed two corrupted files, replaced all `transition-all` Tailwind classes with specific property transitions across the codebase, added mobile drawer entry animation, and confirmed tests pass.

## Files Fixed

### Corrupted Files (from prior session)
- `nextjs/src/components/category-grid.tsx` — removed `Also ` prefix at line 1 (grep leak into file)
- `nextjs/src/app/page.tsx` — restored string quotes on browser AI description

### transition-all → Specific Properties
Replaced 21 instances of `transition-all` with `transition-colors`, `transition-opacity`, `transition-transform` across 12 files:

| File | Instance | Replaced With |
|------|----------|--------------|
| `nav-bar.tsx` | Nav links, mobile drawer, mode button, mode dropdown | `transition-colors` |
| `search-bar.tsx` | Input field, search button, AI button | `transition-colors` + `transition-transform` (buttons) |
| `page.tsx` | Icon in mode card | `transition-opacity` |
| `chat/[id]/page.tsx` | Input field, send button | `transition-colors` + `transition-transform` |
| `chat/page.tsx` | Input, send button, cited law links | `transition-colors` + `transition-transform` |
| `bookmarks/page.tsx` | Remove bookmark button | `transition-colors` + `transition-transform` |
| `error.tsx` (4x) | Reset buttons | `transition-colors` + `transition-transform` |
| `laws/[key]/page.tsx` | Back link, bookmark button | `transition-colors` + `transition-transform` |
| `settings/page.tsx` | Mode cards, inputs, selects, stop broker | `transition-colors` |

### Mobile Drawer
- Added `animate-fade-in` class to backdrop overlay for entry animation
- Kept existing `animate-slide-in-left` on drawer panel
- Tried `AnimatePresence`/`motion` for exit animation but reverted — incompatible with test assertions in jsdom (elements stay in DOM during exit)

## Test Results
- **479 passed**, **10 failed** (all pre-existing `law-card.test.tsx` — `useRouter()` not mocked)
- All 27 nav-bar tests pass
- TypeScript compiles cleanly (`npx tsc --noEmit` → 0 errors)

## Known Issues
- `law-card.test.tsx` 10 failures are pre-existing (missing `useRouter` mock, same as before)
- `AnimatePresence`/`motion` exit animations can't be tested with current test setup — jsdom doesn't support animation lifecycle
