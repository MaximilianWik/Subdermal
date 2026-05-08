# QR Code Domain

A React single-page application deployed as a Cloudflare Worker, with a Hono-powered API backend running at the edge.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript |
| Build tool | Vite 6 |
| API | Hono 4 |
| Deployment | Cloudflare Workers |

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (for deployment)

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Build then preview locally |
| `npm run lint` | Run ESLint |
| `npm run deploy` | Deploy to Cloudflare Workers |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` |
| `npm run check` | Full type-check + build + deploy dry-run |

## Project Structure

```
├── public/             # Static assets served as-is
├── src/
│   ├── react-app/      # React frontend
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   └── worker/         # Hono API (Cloudflare Worker)
│       └── index.ts
├── index.html
├── vite.config.ts
└── wrangler.json       # Cloudflare Workers config
```

## Deployment

Build and deploy to Cloudflare Workers:

```bash
npm run deploy
```

Monitor live logs:

```bash
npx wrangler tail
```

## License

MIT
