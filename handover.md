# Handover — Cloudflare-Domain (QR tattoo project)

> Read this first if you're a fresh assistant picking up where the previous one left off.

## What this project is

A React/Vite app deployed as a Cloudflare Worker, serving a single page that's the **target of a QR code tattooed on the user's arm**. The page picks which "state" (= React component) to render based on a single number in `state.ts`. Edit the number, push to `main`, Cloudflare auto-deploys in ~60s, the tattoo's destination changes — without re-inking.

Sister project: **Tessera** at `C:\Users\AD17661\OneDrive - DNB Bank ASA\Desktop\Tessera` — the QR code generator. We don't usually touch it; we just inherit the URL it produced.

User is **Maximilian Wikström** (`+46707360515`, `max.wik@icloud.com`, GitHub `MaximilianWik`, homepage `https://maximilian-wikstrom.vercel.app/`). DNB Bank ASA employee but this is a personal project.

## Working directory

**`C:\Cloudflare-Domain`** — recently moved out of OneDrive after multiple file-revert race conditions caused by OneDrive sync clobbering edits between an `edit` call and a `git commit`. **Do not work in OneDrive paths for this project.** If you ever see the path `C:\Users\AD17661\OneDrive - DNB Bank ASA\Desktop\Cloudflare-Domain`, that's the OLD path and is now stale.

## Toolchain quirks (Windows + GitHub Desktop, no shell)

- The user has **no PowerShell command access** they can invoke. They only have GitHub Desktop's UI for commit/push.
- `npm`, `node`, `git` are **not on the system PATH**. You can find git bundled with GitHub Desktop at:
  ```
  C:\Users\AD17661\AppData\Local\GitHubDesktop\app-3.5.8\resources\app\git\cmd\git.exe
  ```
  Use this for `git status`, `git log`, `git show HEAD:<path>`, `git diff` etc. via PowerShell.
- The Linux sandbox VM was unstable in the previous session (read tool returned stale/cached content for files in OneDrive paths while edits went through to disk fine). Now that the project is at `C:\Cloudflare-Domain` the VM mount issue is irrelevant — but if you hit `read` returning stale content, **always cross-check with `Get-Content` via `bash sandbox=false`**.
- You **cannot run `tsc -b` or `npm run build` locally** — no node accessible from PowerShell. Verification must be done via:
  1. Read the files via PowerShell `Get-Content` to confirm content is correct on disk.
  2. Use the GitHub Desktop bundled git to verify the state of HEAD vs working tree.
  3. After push, watch the Cloudflare Pages CI build log for actual TypeScript errors.

## Architecture

```
state.ts                       ← THE state switch (one number)
src/react-app/
  App.tsx                      ← reads STATE, renders states[STATE]
  states/
    index.ts                   ← registry: { 1: State1, 2: State2, ..., 8: State8 }
    State1.tsx ... State8.tsx
    state8/                    ← collaborative canvas split into modules
      types.ts
      api.ts
      occupancy.ts
      render.ts
      draft.ts
      CanvasView.tsx + .css
      Toolbar.tsx + .css
      ColorPicker.tsx + .css
      SignModal.tsx + .css
      Detail.tsx + .css        ← THE FILE INVOLVED IN THE OPEN BUG
src/worker/
  index.ts                     ← Hono worker (API routes)
  env.d.ts                     ← Cloudflare.Env augmentation (DB, ADMIN_TOKEN)
migrations/
  0001_create_drawings.sql
  0002_extend_drawings.sql
public/
  glitch/glitch01..14          ← images for State 7 glitch phase
  maximilian.png               ← square avatar
  maximilianPoster.png         ← portrait poster (used in vCard embed)
  Jessi.jpg / cleo.png / jonte.jpg / glorpglorp.gif
```

## State registry (live state is set in `state.ts`)

| # | What it does |
|---|---|
| 1 | `glorpglorp.gif` |
| 2 | `Jessi.jpg` + romantic header *"I LOVE MY SMOKING HOT GF"* |
| 3 | `cleo.png` |
| 4 | Redirects to `REDIRECT_URL` (also in `state.ts`) |
| 5 | `jonte.jpg` + romantic header *"CHECK OUT MY HOT BOYFRIEND STROKE STROKE VACUUM VACUUM"* |
| 6 | vCard "Save to Contacts" page (real contact details, embedded JPEG photo) |
| 7 | `rm -rf /` chaos cinematic — terminal types `sudo rm -rf / --no-preserve-root`, deletion cascade, glitch phase flashing 14 images from `public/glitch/`, then "...just kidding." reveal |
| 8 | **Collaborative canvas** — huge shared world canvas (16384×24576) where anyone can draw with 10 brush types, pinch-zoom, two-finger pan, undo/redo, draft auto-save, "can't draw over others" enforcement, and tap-to-open-detail with full public metadata |

**Always flip `STATE` in `state.ts` to whatever state you're currently working on**, so the user can preview live changes by scanning the tattoo. (User's standing preference — saved to memory.)

## Current open bug

> *"Clicking on the drawing does not display the information I wanted with signature, data and ability to like/heart, it just takes me to a black page."*

This is the bug to fix in the new chat.

### Root cause (already diagnosed)

`GET /api/drawings/:id` in `src/worker/index.ts` (lines ~206–221 at HEAD) returns the row with `...row` spread, so the response has `bbox_x1`, `bbox_y1`, `bbox_x2`, `bbox_y2` as **flat fields**. But `Detail.tsx` (lines ~26–28) does:

```ts
const bbox = drawing.bbox;
const dWidth = Math.max(1, bbox.x2 - bbox.x1);
const dHeight = Math.max(1, bbox.y2 - bbox.y1);
```

`drawing.bbox` is `undefined` → `bbox.x2` throws → the `Detail` component never renders its content → user sees the dark `.dm` overlay (looks like a "black page").

### Fix

In `src/worker/index.ts`, the `GET /api/drawings/:id` handler ends with:

```ts
return c.json({
    ...row,
    strokes: safeParseStrokes(row.strokes as string),
});
```

Change to:

```ts
return c.json({
    ...row,
    strokes: safeParseStrokes(row.strokes as string),
    bbox: {
        x1: (row.bbox_x1 as number | null) ?? 0,
        y1: (row.bbox_y1 as number | null) ?? 0,
        x2: (row.bbox_x2 as number | null) ?? 0,
        y2: (row.bbox_y2 as number | null) ?? 0,
    },
});
```

(The feed endpoint `GET /api/drawings` already does this reshape correctly — the bug is only in the per-id endpoint.)

### Verification path

1. Apply the edit.
2. Cross-check with `git show HEAD:src/worker/index.ts | Select-Object -Skip 217 -First 18` to confirm the `bbox: { … }` block is in the file.
3. Push.
4. Wait for Cloudflare CI to deploy (~60s).
5. User scans the tattoo, taps any drawing on the canvas → detail card should render with the replay animation and metadata grid (name, country, IP, UA, draw time, etc.) plus the heart button. Admin URL `?admin=<token>` should additionally show Hide / Ban-IP buttons.

### What "should work" looks like

The detail modal in `Detail.tsx`:
- Top: full-width `<canvas>` with the drawing replayed stroke-by-stroke (~2.2s animation) using `drawStrokesProgressive` from `render.ts`.
- Below: name (large), relative timestamp, heart-like button.
- Below that: a metadata grid with rows for Country, Region, City, Postal, Timezone, CF colo, **IP** (mono), Viewport, DPR, Canvas, Time spent, Lang, **UA** (mono, long).
- Admin only (`?admin=<token>`): two destructive buttons — **🚫 Hide drawing** and **⛔ Ban IP**.

## Database state

- D1 database: **`max-wik-db`**, ID `6da82e5a-d8b0-449f-8b1c-a53c8f93a768`, bound as `Env.DB` in `wrangler.json`.
- Both migrations applied to remote (run via the Cloudflare D1 Console — user has no wrangler access). Schema:
  - Drawings table with: `id`, `created_at`, `name`, `strokes`, `country`, `hidden`, plus 19 metadata columns (`ip`, `user_agent`, `accept_language`, `city`, `region`, `colo`, `postal_code`, `timezone`, `viewport_w/h`, `device_pixel_ratio`, `draw_time_ms`, `canvas_width/height`, `likes`, `bbox_x1/y1/x2/y2`).
  - `banned_ips` table for IP-level moderation.
- Index `idx_drawings_bbox` on `(bbox_x1, bbox_x2, bbox_y1, bbox_y2)` for future spatial culling.

To moderate via SQL (Cloudflare Dashboard → D1 → max-wik-db → Console):
```sql
-- hide a drawing
UPDATE drawings SET hidden = 1 WHERE id = N;
-- ban an IP
INSERT OR REPLACE INTO banned_ips (ip, reason, banned_at) VALUES ('1.2.3.4', 'reason', strftime('%s','now')*1000);
```

## Admin mode

- Admin token is a Cloudflare Workers secret named **`ADMIN_TOKEN`**, set in the dashboard (Workers → vite-react-template → Settings → Variables and Secrets).
- Admin URL: `https://max-wik.com/?admin=<ADMIN_TOKEN>` — bookmarked on user's phone.
- The token controls the four admin endpoints: `/api/admin/drawings/:id/hide`, `/unhide`, `/api/admin/ban`, `/unban`. Server validates `?admin=` query param against the secret before honoring the request. Without a valid token: 403.
- `isAdminMode()` (in `state8/api.ts`) just checks if `?admin=` exists in the URL — it doesn't validate the value. The server is the real gate.
- **Scanning the QR (no query param) never shows admin mode.** This is correct and intentional.

## Workflow rules saved to memory

- **Always end responses that include code/file changes with a copy-pasteable commit message in a single fenced block** (no extra commentary inside the block). Style: short imperative subject, optional body bullets if multiple things changed.
- **Always flip `STATE` in `state.ts` to the state currently being worked on** so the user can preview live by scanning the tattoo.
- **Never assume edits persisted** — verify with `Get-Content` (Windows path, `sandbox=false`) or `git show HEAD:<path>` after every batch.
- **After deletion-style edits in TS files, run `tsc -b --force`** (or in this Windows-no-node setup, manually grep for any references to deleted symbols) — incremental builds can mask "Cannot find name X" errors that CI catches on a fresh checkout.
- The user is in concise mode — match it. Skip preamble. Lead with action or answer.

## Recent commit history (for context)

```
7d3dc3f fix(state8): repair partial edits left over from prior cleanup
f848ded fix(state8): 7 canvas bugs + brush rewrite
12b7141 fix(state8): stale closure in scheduleDraw caused canvas to render empty `existing` array forever
3b05cff fix(state8): drop now-unused useState import in CanvasView
5a1145a fix(state8): drop dead `requestRedraw` + `void drawStroke` blocking CI
```

The previous chat hit a long string of CI failures because of the OneDrive sync race condition. Project is now at `C:\Cloudflare-Domain` and that class of failure is gone.

## Things NOT to do

- Don't add `void <name>;` statements as "lint silencers" — they get stuck in the codebase and block CI later when names disappear. If an import is unused, remove it cleanly.
- Don't store secrets in `wrangler.json` (Cloudflare's UI suggests this; ignore). Secrets go via the dashboard's Variables and Secrets panel.
- Don't display visitor IPs/UAs publicly without informed-consent surfacing — but in this project the user has explicitly opted into full public metadata display, including a notice on the SignModal that submitting will publish your name/country/IP/device. That's documented and intentional.
- Don't suggest features beyond what the user asks for unless explicitly asked. "Avoid over-engineering" is in their AGENTS rules.

---

**TL;DR for the new chat: open `src/worker/index.ts`, find the `GET /api/drawings/:id` handler, add the `bbox: {x1, y1, x2, y2}` reshape to the response, verify with `git show HEAD:src/worker/index.ts`, commit, push.**
