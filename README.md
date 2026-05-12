# QR Code Domain

A React single-page application deployed as a Cloudflare Worker, with a Hono-powered API backend running at the edge.

The page is reached via QR code and is designed for **fast state switching** — change a single number in `state.ts` and Cloudflare auto-deploys a new look. Editable directly from the GitHub mobile app.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript |
| Build tool | Vite 6 |
| API | Hono 4 |
| Deployment | Cloudflare Workers (auto-deploy on push to `main`) |

## Switching the page state

Open **[`state.ts`](./state.ts)** in the repo root and change the number:

```ts
export const STATE: StateKey = 1;  // ← change this
```

| Value | What is shown |
|-------|---------------|
| `1` | `glorpglorp.gif` |
| `2` | `Jessi.jpg` (with romantic header) |
| `3` | `cleo.png` |
| `4` | Redirects the page to `REDIRECT_URL` (also set in `state.ts`) |
| `5` | `jonte.jpg` (with romantic header) |
| `6` | vCard "Save to Contacts" page — downloads a `.vcf` (edit fields at the top of `State6.tsx`) |
| `7` | `rm -rf /` chaos cinematic — typewritten `sudo rm -rf / --no-preserve-root` followed by a flood of deletion output, glitch transition, then a "…just kidding." reveal |

Commit the change. Cloudflare picks it up and redeploys within ~1 minute.

> **Type safety:** `STATE` is typed against the registry, so an invalid number fails the build and Cloudflare won't deploy broken code — the live page is never silently broken.

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
├── state.ts                       ← THE state switch (edit this)
├── public/                        ← Static assets (served from /)
│   ├── glorpglorp.gif
│   └── Jessi.jpg
├── src/
│   ├── react-app/                 ← React frontend
│   │   ├── App.tsx                ← Reads STATE, renders the matching component
│   │   ├── main.tsx
│   │   ├── index.css
│   │   └── states/                ← One file per page state
│   │       ├── index.ts           ← Registry: number → component
│   │       ├── State1.tsx
│   │       └── State2.tsx
│   └── worker/                    ← Hono API (Cloudflare Worker)
│       └── index.ts
├── index.html
├── vite.config.ts
└── wrangler.json                  ← Cloudflare Workers config
```

## Development

```bash
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Build then preview locally |
| `npm run lint` | Run ESLint |
| `npm run deploy` | Deploy to Cloudflare Workers manually |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` |
| `npm run check` | Full type-check + build + deploy dry-run |

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
