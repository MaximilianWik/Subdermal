# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Draw-mode zoom floor.** When entering draw mode (or edit mode via "Mine"), the canvas snaps zoom up to the "spawn-point" level — the zoom computed by the initial `centerView()` call, which fits the intended starting viewport on screen. If the user is already zoomed in, nothing happens. Pan position is always preserved so scouting for empty space before drawing still works. While in draw mode, wheel zoom and pinch-zoom are clamped at this same floor, preventing drawing at extreme zoom-out levels that produced canvas-covering strokes. Exiting draw mode restores full `ZOOM_MIN` freedom.

### Added

- **Intro cinematic on every fresh load.** State 7's `rm -rf /` glitch sequence plays as an intro before the configured `STATE`, then auto-advances. Skipped when deep-linking via `#view=N` or when `STATE === 7` itself. Once dismissed (or once any menu navigation occurs) it never replays inside the same SPA session.
- **House-rules popup** on every entry to the canvas — four cards (no hate speech, profanity & NSFW allowed, no griefing, no spam/impersonation) and a consequences strip (artwork removal, IP+device ban, "doxxed (joking… mostly)").
- **Side menu** with a hamburger button in the canvas topbar, linking out to the artist's portfolio, the Tessera QR generator, the Cursed Echoes minigame, Instagram, plus internal `#view=N` shortcuts to states 1, 2, 5, and 6. A "Back to canvas" pill is rendered at the App level whenever a non-canonical view is showing.
- **Per-browser ownership and edit flow.** A UUID minted in `localStorage` (`state8.owner.v1`) is sent with every submit and persisted on the row as `owner_secret`. New `PATCH /api/drawings/:id` updates name + strokes + bbox + Instagram for the matching owner. New `POST /api/drawings/mine` returns the caller's owned drawings. Detail cards show an **✎ Edit** button when the drawing is owned, and the topbar gets an **✎ Mine** pill that opens a list with one Edit button per row. Editing pre-loads the drawing into the draft canvas; cancel restores it; submit writes back via PATCH.
- **Optional Instagram handle on signatures.** The sign modal accepts a handle, `@handle`, or a full `instagram.com/...` URL and normalises to a bare username (`[A-Za-z0-9._]{1,30}`). When present, the detail card renders an Instagram-gradient pill to the right of the heart that opens the artist's profile. Same sanitiser runs server-side as defence in depth.
- **Pixel-art tool.** Snaps to the visible 32 × 32 minor grid; each tap fills exactly one cell with no anti-aliasing. Stored as a normal `Stroke` whose flat points array carries cell origins, so it round-trips through the existing storage and replay paths unchanged.
- **Eyedropper tool.** Hover preview swatch + tail glyph; drag to fine-tune; release to commit. Auto-reverts to whichever brush was active before the eyedropper, Photoshop-style. Reads pixels from the rendered canvas in screen space, so it can sample any colour visible — own drawings, others' drawings, the white background, individual grid lines.
- **Blender tool.** Colourless smear with a cloud-shaped tip (single closed wavy path per stamp, radius modulated by two seeded sinusoids). Samples the canvas at every step and stores the colour into `pointColors`, which the renderer uses to paint a soft radial-gradient stamp at low alpha — boundaries between colours visibly mix without ever introducing a new colour.
- **Hover preview cursors for all shape-bearing tools** — pen / watercolor / airbrush as circles sized to each renderer's actual footprint, calligraphy as a 45°-rotated chisel rectangle, pixel art as a grid-snapped square, blender as the cloud-silhouette SVG, eraser unchanged, eyedropper unchanged.
- **Admin diagnostic endpoint** `GET /api/admin/check` returns whether the trimmed token query param matches the trimmed `ADMIN_TOKEN` secret, plus length information, so token plumbing can be verified from a phone without exposing the secret.
- **Admin Bans list.** `GET /api/admin/bans` returns the banned-IPs table newest-first; the topbar shows a `⛔ Bans` pill in admin mode that opens an overlay listing each ban (IP, reason, time-ago) with a per-row Unban button.
- **SEO foundation**: `index.html` now ships proper `<title>`, description, canonical, Open Graph, Twitter card, `Person` and `WebSite` JSON-LD with `sameAs` links to the portfolio, Instagram, and GitHub, plus a `<noscript>` fallback containing the artist name and outbound links. Added `public/robots.txt` and `public/sitemap.xml`.
- Migration `0003_owner_secret.sql` adds an `owner_secret TEXT` column to `drawings` plus an index on it.
- Migration `0004_instagram_handle.sql` adds an `instagram_handle TEXT` column to `drawings`.
- **State 8 — Collaborative canvas (real)**. Replaces the v1 D1-heartbeat placeholder with the full implementation.
  - **World canvas**: 16384×24576 px shared surface (16× linear, 256× area). All drawings live in absolute world coordinates; rendering uses a viewport-sized canvas with a pan/zoom transform applied (never instantiates a giant HTMLCanvasElement).
  - **Mode toggle**: `view` (default) → pan/zoom + tap a drawing to open detail; `draw` → tools toolbar visible, single-finger draws, two-finger pinches/pans.
  - **HSV color picker** with hue ring + S/V square + 10 preset colors + recent-colors history (localStorage).
  - **Brush size 1–50 px**, eraser size 4–50 px, opacity 5–100% slider.
  - **Pan/zoom**: two-finger pinch-zoom + drag-pan, mouse-wheel zoom, drag-to-pan in view mode. Zoom range 0.05× (whole canvas visible) → 8× (detail work). "Reset" button re-centers.
  - **Undo / redo** stacks with 50-step history.
  - **Draft auto-save** to localStorage (debounced 250ms) — survives page reloads and phone notifications. Restored automatically on next visit.
  - **Collision enforcement** ("can't draw over others"): on canvas load, all existing strokes rasterize into a 32×32-pixel occupancy grid (49 KB bitmap). Live drawing skips points landing on occupied cells, so strokes break naturally around existing pieces.
  - **Submit flow**: "Sign & Submit" → name + optional Instagram modal → POST → re-fetches feed → returns to view mode with the new piece visible. The submit modal explicitly shows the public-metadata notice so submission is informed consent.
  - **Drawing detail card**: tap any piece to open a centred floating overlay with animated stroke-by-stroke replay (~4s), full public metadata grid (country, region, city, postal, timezone, CF colo, IP, viewport, DPR, canvas size, draw time, accept-language, full UA), a heart/like button, and an Instagram pill when the artist provided a handle.
  - **Admin mode**: visit any URL with `?admin=<ADMIN_TOKEN>` matching the Workers secret. Detail card adds **Hide drawing** and **Ban IP** buttons (with optional reason prompt). All admin endpoints validate the token server-side; the comparison trims whitespace so a trailing newline pasted into the dashboard doesn't silently 403 every request.
- Migration `0002_extend_drawings.sql` — adds 19 metadata columns (`ip`, `user_agent`, `accept_language`, `city`, `region`, `colo`, `postal_code`, `timezone`, `viewport_w/h`, `device_pixel_ratio`, `draw_time_ms`, `canvas_width/height`, `likes`, `bbox_*`) and a `banned_ips` table. Adds `idx_drawings_bbox` for future spatial queries.
- **Worker API**: `POST /api/drawings` captures and persists all the metadata above and rejects requests from banned IPs with 403; `GET /api/drawings/:id` returns one drawing's full metadata for the detail view; `POST /api/drawings/:id/like` increments the like counter; `POST /api/admin/drawings/:id/hide`, `/unhide`, `/ban`, `/unban` for moderation (token-gated). All stroke shapes are validated server-side (tool whitelist, hex color regex, point-array shape, optional `pointColors` shape).
- **`Cloudflare.Env.ADMIN_TOKEN`** — secret for moderation endpoints. Set via Cloudflare dashboard → Workers → Settings → Variables → Add secret variable.
- **D1 database integration** — `max-wik-db` bound as `Env.DB` in `wrangler.json`. Migration `0001_create_drawings.sql` creates the `drawings` table (append-only, soft-delete via `hidden` flag).
- **Hono API routes** in `src/worker/index.ts`:
  - `GET /api/drawings?cursor=&limit=` — cursor-based paginated feed (default limit 200, max 1000). Returns `{ drawings, next_cursor, total }`.
  - `POST /api/drawings` — submit a drawing. Validates JSON, enforces 200 KB max strokes payload, name max 40 chars. Returns `{ id, created_at }`.
- `src/worker/env.d.ts` — manual augmentation of `Cloudflare.Env` declaring `DB: D1Database` so `tsc -b` always sees the binding even before `npm run cf-typegen` has been run on a fresh clone.
- **State 7 — `rm -rf /` chaos cinematic.** Three-phase sequence: black terminal types `sudo rm -rf / --no-preserve-root` and floods deletion output across realistic Linux paths → ~1.4s glitch transition flashing 14 images from `public/glitch/` → black-screen reveal that types `…just kidding.` with a `— m` signature. CRT scanlines and subtle flicker overlay throughout. Optional `onComplete` prop lets the App use it as a one-shot intro.
- **State 6 — vCard "Save to Contacts" page.** Downloads a vCard 3.0 `.vcf` when the visitor taps the button; works on iOS Safari (native contact preview), Android Chrome, and desktop. Contact fields live in an editable constant at the top of `State6.tsx`.
- **State 5 — `jonte.jpg`** with romantic stylized header *"CHECK OUT MY HOT BOYFRIEND STROKE STROKE VACUUM VACUUM"*.
- Shared `RomanticPoster` component (header + image with the Cinzel + pink-gradient + glow look) — State 2 and State 5 both render through it.
- **State 4 — redirect state.** Set `STATE = 4` and edit `REDIRECT_URL` in `state.ts` to forward visitors to any URL. Useful for repointing the QR code without reprinting it.
- **State 3 —** displays `cleo.png`.
- Romantic stylized header on State 2 — *"I LOVE MY SMOKING HOT GF"* in Cinzel Decorative with a pink-red gradient and a soft pink glow on `Jessi.jpg`.
- **State-switching architecture** — single-number page state control via root-level `state.ts`, registry maps numbers to React components, type-safe so invalid values fail the build.
- `State1` (`glorpglorp.gif`) and `State2` (`Jessi.jpg`) as initial states.
- Initial project setup: React 19 + Vite 6 + Hono 4 + Cloudflare Workers.

### Changed

- **Topbar wordmark renamed** "Maxsonny" → **Subdermal**. Subtitle reads `N artwork(s)` instead of `N drawing(s)`.
- **Initial canvas zoom** is now 2× more zoomed-out on first load and on Reset View (doubled `INITIAL_VIEW_W` / `INITIAL_VIEW_H`).
- **Detail card replay** slowed from 2.2 s to 4 s.
- **Eraser** now hit-tests against each stroke's visible width (`size / 2`, or the half-diagonal for pixel cells), so dragging across a thick brush stroke or pixel cell actually erases it. Splitting a blender stroke also slices its `pointColors` array in lockstep with the points so the surviving pieces still render with the right colours. Switching tools clamps the size into the new tool's allowed range so going from a 1-px pen to the eraser doesn't leave it at sub-minimum radius.
- **Pinch-zoom mid-stroke no longer leaves a phantom dot/line.** When the second finger lands, the in-progress stroke is removed from the live render list (not just nulled) so the visual artefact disappears the instant the gesture begins.
- **Brush palette trimmed** to Pen, Watercolor, Calligraphy, Spray, Airbrush, Pixel art, Blender, Pick color, Eraser. Pencil, Marker, Brush, and Charcoal are no longer selectable; their renderers are kept so existing drawings using those tools still display.
- **Tool icons** are now monochrome inline SVGs (no colored emojis); they pick up `currentColor` so they brighten when the tool is active.

### Removed

- `handover.md` (legacy onboarding doc) and the unused `src/react-app/assets/` folder.
- The unused `TOOL_LIST` export from `src/react-app/states/state8/render.ts`.
- The legacy "rules accepted" `localStorage` gate — the house-rules modal now appears on every load.

[Unreleased]: https://github.com/MaximilianWik/vite-react-template/commits/main
