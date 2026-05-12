# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **State 8 — Collaborative canvas (real)**. Replaces the v1 D1-heartbeat placeholder with the full implementation.
  - **World canvas**: 16384×24576 px shared surface (16× linear, 256× area). All drawings live in absolute world coordinates; rendering uses a viewport-sized canvas with a pan/zoom transform applied (never instantiates a giant HTMLCanvasElement).
  - **Mode toggle**: `view` (default) → pan/zoom + tap a drawing to open detail; `draw` → tools toolbar visible, single-finger draws, two-finger pinches/pans.
  - **6 brush types** (pen, pencil, marker, brush, spray, eraser). Each visually distinct via combinations of composite mode, opacity, jitter, and texture. Eraser only removes from the user's own draft strokes — committed drawings can never be erased.
  - **HSV color picker** with hue ring + S/V square + 10 preset colors + recent-colors history (localStorage).
  - **Brush size 1–80 px**, eraser size 4–80 px, opacity 5–100% slider.
  - **Pan/zoom**: two-finger pinch-zoom + drag-pan, mouse-wheel zoom, drag-to-pan in view mode. Zoom range 0.05× (whole canvas visible) → 8× (detail work). "Reset" button re-centers.
  - **Undo / redo** stacks with 50-step history.
  - **Draft auto-save** to localStorage (debounced 250ms) — survives page reloads and phone notifications. Restored automatically on next visit.
  - **Collision enforcement** ("can't draw over others"): on canvas load, all existing strokes rasterize into a 32×32-pixel occupancy grid (49 KB bitmap). Live drawing skips points landing on occupied cells, so your stroke breaks naturally around existing pieces.
  - **Submit flow**: "Sign & Submit" → name modal (required, max 40 chars) → POST → re-fetches feed → returns to view mode with the new piece visible. The submit modal explicitly shows the public-metadata notice so submission is informed consent.
  - **Drawing detail card**: tap any piece to open a modal with animated stroke-by-stroke replay (~2.2s), full public metadata grid (country, region, city, postal, timezone, CF colo, IP, viewport, DPR, canvas size, draw time, accept-language, full UA), and a heart/like button.
  - **Admin mode**: visit any URL with `?admin=<ADMIN_TOKEN>` matching the Workers secret. Detail card adds **Hide drawing** and **Ban IP** buttons (with optional reason prompt). All admin endpoints validate the token server-side.
- **Migration `0002_extend_drawings.sql`** — adds 19 metadata columns (`ip`, `user_agent`, `accept_language`, `city`, `region`, `colo`, `postal_code`, `timezone`, `viewport_w/h`, `device_pixel_ratio`, `draw_time_ms`, `canvas_width/height`, `likes`, `bbox_*`) and a new `banned_ips` table. Adds `idx_drawings_bbox` for future spatial queries.
- **Worker API**: `POST /api/drawings` now captures + persists all the metadata above and rejects requests from banned IPs with 403; `GET /api/drawings/:id` returns one drawing's full metadata for the detail view; `POST /api/drawings/:id/like` increments the like counter; `POST /api/admin/drawings/:id/hide`, `/unhide`, `/ban`, `/unban` for moderation (token-gated). All stroke shapes are validated server-side (tool whitelist, hex color regex, point-array shape).
- **`Cloudflare.Env.ADMIN_TOKEN`** — secret for moderation endpoints. Set via Cloudflare dashboard → Workers → Settings → Variables → Add secret variable.
- **D1 database integration** — `max-wik-db` (id `6da82e5a-d8b0-449f-8b1c-a53c8f93a768`) bound as `Env.DB` in `wrangler.json`. New `migrations/0001_create_drawings.sql` creates the `drawings` table (append-only, soft-delete via `hidden` flag) for the upcoming collaborative canvas.
- **Hono API routes** in `src/worker/index.ts`:
  - `GET /api/drawings?cursor=&limit=` — cursor-based paginated feed (default limit 20, max 100). Returns `{ drawings, next_cursor, total }`.
  - `POST /api/drawings` — submit a drawing. Validates JSON, enforces 80 KB max strokes payload, name max 40 chars. Logs `cf.country` automatically (no IP stored). Returns `{ id, created_at }`.
- **State 8 — Canvas (placeholder)**. D1 heartbeat page that GETs `/api/drawings` to show the running total + last 5 entries, with a "submit test drawing" button that POSTs a minimal stroke payload. Will be replaced by the real collaborative canvas UI in the next iteration.
- `src/worker/env.d.ts` — manual augmentation of `Cloudflare.Env` declaring `DB: D1Database` so `tsc -b` always sees the binding even before `npm run cf-typegen` has been run on a fresh clone.
- **State 7 — `rm -rf /` chaos cinematic.** Three-phase sequence: black terminal types `sudo rm -rf / --no-preserve-root` and floods deletion output across realistic Linux paths → 500ms RGB-tear glitch transition → black-screen reveal that types `…just kidding.` with a `— m` signature. CRT scanlines and subtle flicker overlay throughout.
- **State 6 — vCard "Save to Contacts" page.** Downloads a vCard 3.0 `.vcf` when the visitor taps the button; works on iOS Safari (native contact preview), Android Chrome, and desktop. Contact fields live in an editable constant at the top of `State6.tsx`. The page only renders name + organization — phone, email, etc. stay private inside the `.vcf` so the page is safe to display in public.
- State 5 — `jonte.jpg` with romantic stylized header *"CHECK OUT MY HOT BOYFRIEND STROKE STROKE VACUUM VACUUM"*
- Shared `RomanticPoster` component (header + image with the Cinzel + pink-gradient + glow look) — State 2 and State 5 both render through it
- **State 4 — redirect state.** Set `STATE = 4` and edit `REDIRECT_URL` in `state.ts` to forward visitors to any URL. Useful for repointing the QR code without reprinting it.
- State 3 — displays `cleo.png`
- Romantic stylized header on State 2 — *"I LOVE MY SMOKING HOT GF"* in Cinzel Decorative with a pink-red gradient and a soft pink glow on Jessi.jpg
- Co-located `State2.css` so each state can own its own styling
- **State-switching architecture** — single-number page state control via root-level `state.ts`
  - `src/react-app/states/` registry maps numbers to React components
  - Type-safe: `STATE` is constrained to registered keys, invalid values fail the build
  - Designed for mobile editing via GitHub app + Cloudflare auto-deploy
- `State1` (glorpglorp.gif) and `State2` (Jessi.jpg) as initial states
- `Jessi.jpg` moved into `public/`
- Image sizing rules in `index.css` so assets fit the viewport
- README section documenting state-switching workflow and how to add new states
- Initial project setup: React 19 + Vite 6 + Hono 4 + Cloudflare Workers
- Clean `.gitignore` with Node, Windows, macOS, and Wrangler entries

### Changed
- Refactored State 2's romantic styling into a reusable `RomanticPoster` component so all "header + image" states share one source of truth. `State2.css` removed (replaced by `RomanticPoster.css`).

### Removed
- Duplicate asset folders `Assets/` and `GIF/` at repo root (consolidated into `public/`)
- Empty `src/react-app/assets/` folder

[Unreleased]: https://github.com/MaximilianWik/vite-react-template/commits/main
