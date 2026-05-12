// ─────────────────────────────────────────────────────────────
//  Manual augmentation of the Cloudflare worker Env.
//
//  This is an AMBIENT declaration file — no imports, no exports.
//  Adding `export {}` here would turn it into a module and the
//  `declare namespace Cloudflare` augmentation would no longer
//  merge with the global namespace in worker-configuration.d.ts.
//
//  `wrangler types` regenerates worker-configuration.d.ts and is
//  the canonical source for binding types. This file is a thin
//  fallback so `tsc -b` passes on a fresh clone before anyone has
//  run `npm run cf-typegen`. When the auto-generated Env declares
//  the same fields, TypeScript merges them — no conflict.
//
//  Add a new entry here whenever you add a binding to wrangler.json.
// ─────────────────────────────────────────────────────────────

declare namespace Cloudflare {
	interface Env {
		DB: D1Database;
	}
}
