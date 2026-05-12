// ─────────────────────────────────────────────────────────────
//  Manual augmentation of the Cloudflare worker Env.
//
//  `wrangler types` regenerates worker-configuration.d.ts and is
//  the canonical source for binding types. This file is a thin
//  fallback that declares the bindings explicitly so `tsc -b`
//  passes even before someone has run cf-typegen on a fresh clone.
//
//  When you run `npm run cf-typegen` the auto-generated Env will
//  declare these same fields and TypeScript merges interfaces —
//  no conflict, no double-declarations.
//
//  Add a new entry here whenever you add a binding to wrangler.json.
// ─────────────────────────────────────────────────────────────

declare namespace Cloudflare {
	interface Env {
		DB: D1Database;
	}
}

export {};
