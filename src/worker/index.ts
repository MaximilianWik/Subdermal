import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

// ─────────────────────────────────────────────────────────────
//  Limits
//
//  Enforced server-side regardless of what the client sends.
//  Strokes JSON over MAX_STROKES_BYTES is rejected with 413; the
//  canvas UI will keep its own (smaller) limit so users see the
//  problem before they hit the wire.
// ─────────────────────────────────────────────────────────────
const MAX_STROKES_BYTES = 80_000; // ~80 KB of stroke JSON per drawing
const MAX_NAME_LEN = 40;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));

// ─── GET /api/drawings ───────────────────────────────────────
//  Paginated gallery feed. Cursor = last seen id (descending order),
//  so "next page" is `id < cursor`. No OFFSET — stays fast at scale.
//
//  Query params:
//    cursor  optional integer. Omit for the first page.
//    limit   optional integer, capped at MAX_LIMIT. Default 20.
//
//  Response:
//    { drawings: [...], next_cursor: number | null, total: number }
// ─────────────────────────────────────────────────────────────
app.get("/api/drawings", async (c) => {
	const limitRaw = parseInt(c.req.query("limit") ?? "", 10);
	const limit =
		Number.isFinite(limitRaw) && limitRaw > 0
			? Math.min(limitRaw, MAX_LIMIT)
			: DEFAULT_LIMIT;
	const cursorRaw = c.req.query("cursor");
	const cursor = cursorRaw !== undefined ? parseInt(cursorRaw, 10) : NaN;

	const stmt = Number.isFinite(cursor)
		? c.env.DB.prepare(
				`SELECT id, created_at, name, strokes, country
				 FROM drawings
				 WHERE hidden = 0 AND id < ?
				 ORDER BY id DESC LIMIT ?`,
			).bind(cursor, limit)
		: c.env.DB.prepare(
				`SELECT id, created_at, name, strokes, country
				 FROM drawings
				 WHERE hidden = 0
				 ORDER BY id DESC LIMIT ?`,
			).bind(limit);

	const [rowsRes, countRes] = await Promise.all([
		stmt.all<{
			id: number;
			created_at: number;
			name: string | null;
			strokes: string;
			country: string | null;
		}>(),
		c.env.DB.prepare(
			"SELECT COUNT(*) AS n FROM drawings WHERE hidden = 0",
		).first<{ n: number }>(),
	]);

	const rows = rowsRes.results ?? [];
	const drawings = rows.map((r) => ({
		id: r.id,
		created_at: r.created_at,
		name: r.name,
		country: r.country,
		// Parse strokes server-side so the client gets ready-to-use objects.
		// If a row's JSON is somehow corrupted (shouldn't happen — we validate
		// on insert), fall back to an empty array rather than 500-ing the
		// whole gallery.
		strokes: safeParseArray(r.strokes),
	}));

	const next_cursor =
		drawings.length === limit ? drawings[drawings.length - 1].id : null;

	return c.json({
		drawings,
		next_cursor,
		total: countRes?.n ?? 0,
	});
});

// ─── POST /api/drawings ──────────────────────────────────────
//  Submit a new drawing.
//
//  Body (JSON):
//    { name?: string, strokes: any[] }
//
//  Returns 201:
//    { id: number, created_at: number }
// ─────────────────────────────────────────────────────────────
app.post("/api/drawings", async (c) => {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: "invalid json" }, 400);
	}

	const obj = (body ?? {}) as { name?: unknown; strokes?: unknown };

	if (!Array.isArray(obj.strokes) || obj.strokes.length === 0) {
		return c.json({ error: "strokes required (non-empty array)" }, 400);
	}

	const strokesJson = JSON.stringify(obj.strokes);
	if (strokesJson.length > MAX_STROKES_BYTES) {
		return c.json(
			{
				error: `strokes too large (${strokesJson.length} bytes, max ${MAX_STROKES_BYTES})`,
			},
			413,
		);
	}

	const cleanName =
		typeof obj.name === "string"
			? obj.name.trim().slice(0, MAX_NAME_LEN) || null
			: null;

	// Cloudflare populates request.cf with edge metadata. country is a 2-letter
	// ISO code like "NO" / "US" / "T1" (Tor) / "XX" (unknown).
	const cf = c.req.raw.cf as { country?: string } | undefined;
	const country = cf?.country ? cf.country.slice(0, 2).toUpperCase() : null;

	const now = Date.now();
	const result = await c.env.DB.prepare(
		`INSERT INTO drawings (created_at, name, strokes, country)
		 VALUES (?, ?, ?, ?)`,
	)
		.bind(now, cleanName, strokesJson, country)
		.run();

	return c.json(
		{
			id: Number(result.meta.last_row_id),
			created_at: now,
		},
		201,
	);
});

function safeParseArray(s: string): unknown[] {
	try {
		const v: unknown = JSON.parse(s);
		return Array.isArray(v) ? v : [];
	} catch {
		return [];
	}
}

export default app;
