# Subdermal - QR Code Domain

**LIVE:** https://max-wik.com/

A React single-page application deployed as a Cloudflare Worker, with a Hono-powered API backend running at the edge.

The page is reached via QR code (tattooed on a real arm) and is designed for **fast state switching**  change a single number in `state.ts` and Cloudflare auto-deploys a new look. Editable directly from the GitHub mobile app.

## Stack

| Layer       | Technology                                          |
| ----------- | --------------------------------------------------- |
| Frontend    | React 19 + TypeScript                               |
| Build tool  | Vite 6                                              |
| API         | Hono 4                                              |
| Database    | Cloudflare D1 (SQLite at the edge)                  |
| Deployment  | Cloudflare Workers (auto-deploy on push to `main`)  |

## Switching the page state

Open **[`state.ts`](./state.ts)** in the repo root and change the number:

```ts
export const STATE: StateKey = 8;  // ← change this
```

| Value | What is shown                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------- |
| `1`   | `glorpglorp.gif`                                                                                  |
| `2`   | `Jessi.jpg` ()                                                                |
| `3`   | `cleo.png`                                                                                        |
| `4`   | Redirects the page to `REDIRECT_URL` (also set in `state.ts`)                                     |
| `5`   | `jonte.jpg` (with romantic header)                                                                |
| `6`   | vCard "Save to Contacts" page - downloads a `.vcf`. Edit fields at the top of `State6.tsx`.       |
| `7`   | `rm -rf /` chaos cinematic - terminal cascade, glitch flashes                                     |
| `8`   | **Subdermal** — the collaborative canvas. See below.                                              |

Commit the change. Cloudflare picks it up and redeploys within ~1 minute.

> **Type safety:** `STATE` is typed against the registry, so an invalid number fails the build and Cloudflare won't deploy broken code — the live page is never silently broken.

## State 8 - Subdermal (collaborative canvas)

A 16384 × 24576 world canvas where any visitor can draw a piece next to everyone else's. Drawings are stored in D1 and served back as a feed; the canvas renders to a viewport-sized HTMLCanvas with a pan/zoom transform applied, it never instantiates an actual giant canvas element.

**Tools available in the palette**

| Tool         | Behaviour                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Pen          | Clean, hard-edged ink line.                                                                                                      |
| Watercolor   | Soft, blurred, builds up on overlap.                                                                                             |
| Calligraphy  | Width modulated by stroke direction (chisel tip at 45°).                                                                         |
| Spray        | Scattered dots within radius.                                                                                                    |
| Airbrush     | Smooth radial-gradient buildup.                                                                                                  |
| Pixel art    | Snaps to the visible 32 × 32 minor grid. Each tap fills exactly one cell.                                                        |
| Blender      | Colourless smear with a cloud-shaped tip. Samples the canvas under each step and stamps it back at low alpha to blend colours.   |
| Pick color   | Eyedropper. Tap or drag-and-release to pick a colour from any pixel on screen; auto-reverts to the previous brush after picking. |
| Eraser       | Removes parts of the user's own draft strokes (committed drawings are untouchable).                                              |

The renderer also still understands `pencil`, `marker`, `brush`, and `charcoal` so older drawings using those tools continue to display correctly even though those brushes are no longer in the toolbar.

**Other features**

- Two-finger pinch/zoom + drag-pan; mouse-wheel zoom on desktop.
- Undo / redo with 50-step history.
- Draft auto-save to `localStorage` (debounced) — survives page reloads.
- Live hover preview cursor that reflects each tool's actual footprint (cloud silhouette for blender, grid-snapped square for pixel art, angled chisel for calligraphy, etc.).
- Proximity rule: while drawing, any point that lands on a cell occupied by an existing committed drawing is silently dropped, so strokes break naturally around other people's work.
- Submit flow: the sign modal collects a required name plus an optional Instagram handle (URLs and `@` prefixes are stripped). The detail card shows a stroke-by-stroke replay, full public metadata grid, a heart button, and an Instagram pill when the handle is present.
- Per-browser ownership: a UUID is minted in `localStorage` and sent with every submit, persisted server-side as `owner_secret`. The artist can later revisit the canvas, open the **My drawings** list, and edit a piece's name, Instagram, or strokes through `PATCH /api/drawings/:id`.
- A house-rules modal appears on every load, gating entry to the canvas.
- The intro to State 8 plays the State 7 cinematic on every fresh page load (skipped when deep-linking via `#view=N`).
- Side menu links out to the artist's portfolio, Instagram, the Tessera QR generator, and the Cursed Echoes minigame, plus internal `#view=N` shortcuts.
- Admin mode: append `?admin=<ADMIN_TOKEN>` to gain Hide / Ban IP buttons in the detail card and a Bans list pill in the topbar. The token is a Cloudflare Workers secret; all admin endpoints validate server-side.

## Adding a new state

1. **Drop your asset** into [`public/`](./public). It will be served from `/<filename>`.
2. **Create the state component** at `src/react-app/states/StateN.tsx`:
   ```tsx
   export default function StateN() {
       return <img src="/your-asset.png" alt="..." />;
   }
   ```
   A state can be any React component — image, video, animated canvas, full layout, anything.
3. **Register it** in [`src/react-app/states/index.ts`](./src/react-app/states/index.ts):
   ```ts
   import StateN from "./StateN";

   export const states = {
       1: State1,
       2: State2,
       N: StateN,   // ← add this line
   } as const;
   ```
4. **Activate it** by setting `STATE = N` in `state.ts`.

## Project structure

```
state.ts                               ← the state switch
public/                                ← static assets served from /
src/
  react-app/                           ← React frontend
    App.tsx                            ← reads STATE / hash, renders the state
    main.tsx
    index.css / App.css
    states/
      index.ts                         ← registry: number → component
      State1.tsx … State7.tsx          ← simple states (image / redirect / vCard / cinematic)
      RomanticPoster.{tsx,css}         ← shared header for State2 + State5
      State8.tsx + State8.css          ← canvas orchestrator
      state8/                          ← canvas internals
        api.ts                         ← REST helpers
        CanvasView.{tsx,css}           ← world canvas + pan/zoom + input
        Toolbar.{tsx,css}              ← tool palette + sliders
        ColorPicker.{tsx,css}          ← HSV picker
        SignModal.{tsx,css}            ← sign + Instagram modal
        Detail.{tsx,css}               ← drawing detail card with replay
        BanList.{tsx,css}              ← admin: list / unban IPs
        MyDrawings.{tsx,css}           ← list of artist's own pieces
        Menu.{tsx,css}                 ← slide-out side menu
        Rules.{tsx,css}                ← house-rules popup
        types.ts                       ← shared types + world constants
        render.ts                      ← per-tool stroke renderers
        occupancy.ts                   ← bitmap for "can't draw over others"
        draft.ts                       ← localStorage draft persistence
        owner.ts                       ← per-browser owner_secret + my-drawings list
        instagram.ts                   ← handle sanitiser + URL builder
  worker/
    index.ts                           ← Hono API
    env.d.ts                           ← Env augmentation (DB, ADMIN_TOKEN)
migrations/                            ← D1 SQL migrations
  0001_create_drawings.sql
  0002_extend_drawings.sql
  0003_owner_secret.sql
  0004_instagram_handle.sql
index.html
vite.config.ts
wrangler.json
```

## Development

```bash
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Command              | Description                                      |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Start Vite dev server with HMR                   |
| `npm run build`      | Type-check and build for production              |
| `npm run preview`    | Build then preview locally                       |
| `npm run lint`       | Run ESLint                                       |
| `npm run deploy`     | Deploy to Cloudflare Workers manually            |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts`           |
| `npm run check`      | Full type-check + build + deploy dry-run         |

## Deployment

`main` branch auto-deploys to Cloudflare. Manual deploy:

```bash
npm run deploy
```

Live logs:

```bash
npx wrangler tail
```

## License

MIT
