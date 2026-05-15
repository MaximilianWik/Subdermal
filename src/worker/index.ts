import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

// ─────────────────────────────────────────────────────────────
//  Limits + constants
// ─────────────────────────────────────────────────────────────
const MAX_STROKES_BYTES = 200_000; // 200 KB — covers chunky drawings
const MAX_NAME_LEN = 40;
const MAX_REASON_LEN = 200;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const WORLD_W = 16384;
const WORLD_H = 24576;

// ─────────────────────────────────────────────────────────────
//  Types matching the canvas client
// ─────────────────────────────────────────────────────────────
type ToolType =
	| "pen"
	| "pencil"
	| "marker"
	| "brush"
	| "charcoal"
	| "watercolor"
	| "calligraphy"
	| "spray"
	| "airbrush"
	| "pixel"
	| "eyedropper"
	| "eraser";
interface IncomingStroke {
	tool: ToolType;
	color: string;
	size: number;
	opacity: number;
	points: number[]; // flat: [x0, y0, x1, y1, ...] in WORLD coords
	pointColors?: number[]; // optional, blender only
}
interface IncomingDrawing {
	name?: string;
	strokes: IncomingStroke[];
	canvas?: { width: number; height: number };
	viewport?: { w: number; h: number };
	device_pixel_ratio?: number;
	draw_time_ms?: number;
	owner_secret?: string;
	instagram_handle?: string;
}

interface IncomingPatch {
	name?: string;
	strokes?: IncomingStroke[];
	owner_secret?: string;
	instagram_handle?: string;
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
function checkAdmin(c: { req: { query: (k: string) => string | undefined } }, env: Env): boolean {
	const t = c.req.query("admin")?.trim();
	const expected = env.ADMIN_TOKEN?.trim();
	return !!expected && !!t && t === expected;
}

function calcBbox(strokes: IncomingStroke[]): {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
} {
	let x1 = Infinity,
		y1 = Infinity,
		x2 = -Infinity,
		y2 = -Infinity;
	for (const s of strokes) {
		const pts = s.points;
		// Pixel strokes store cell ORIGIN (top-left); their drawn extent
		// is one PIXEL_CELL beyond x/y. All other tools draw centered
		// on the point so the raw point bbox is a fine approximation.
		const ext = s.tool === "pixel" ? PIXEL_CELL : 0;
		for (let i = 0; i < pts.length; i += 2) {
			const x = pts[i];
			const y = pts[i + 1];
			if (x < x1) x1 = x;
			if (y < y1) y1 = y;
			if (x + ext > x2) x2 = x + ext;
			if (y + ext > y2) y2 = y + ext;
		}
	}
	if (!Number.isFinite(x1)) {
		x1 = y1 = x2 = y2 = 0;
	}
	return {
		x1: Math.max(0, Math.floor(x1)),
		y1: Math.max(0, Math.floor(y1)),
		x2: Math.min(WORLD_W, Math.ceil(x2)),
		y2: Math.min(WORLD_H, Math.ceil(y2)),
	};
}

function safeParseStrokes(s: string): unknown[] {
	try {
		const v: unknown = JSON.parse(s);
		return Array.isArray(v) ? v : [];
	} catch {
		return [];
	}
}

// Same rules as the client's sanitizeInstagram — defence in depth.
const IG_HANDLE_RE = /^(?!\.)(?!.*\.\.)[A-Za-z0-9._]{1,30}(?<!\.)$/;
function sanitizeIgHandle(input: unknown): string | null {
	if (typeof input !== "string") return null;
	let s = input.trim();
	if (!s) return null;
	s = s.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, "");
	s = s.replace(/[/?#].*$/, "");
	if (s.startsWith("@")) s = s.slice(1);
	if (!IG_HANDLE_RE.test(s)) return null;
	return s;
}

const VALID_TOOLS: ReadonlyArray<ToolType> = [
	"pen",
	"pencil",
	"marker",
	"brush",
	"charcoal",
	"watercolor",
	"calligraphy",
	"spray",
	"airbrush",
	"pixel",
	"blender",
	"eyedropper",
	"eraser",
];

const PIXEL_CELL = 32;

function validateStroke(s: unknown): IncomingStroke | null {
	if (!s || typeof s !== "object") return null;
	const o = s as Record<string, unknown>;
	const tool = o.tool;
	if (typeof tool !== "string") return null;
	if (!VALID_TOOLS.includes(tool as ToolType)) return null;
	if (typeof o.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(o.color)) return null;
	if (typeof o.size !== "number" || o.size <= 0 || o.size > 200) return null;
	if (typeof o.opacity !== "number" || o.opacity < 0 || o.opacity > 1) return null;
	if (!Array.isArray(o.points)) return null;
	if (o.points.length < 2 || o.points.length % 2 !== 0) return null;
	for (const p of o.points) {
		if (typeof p !== "number" || !Number.isFinite(p)) return null;
	}
	let pointColors: number[] | undefined;
	if (o.pointColors !== undefined) {
		if (!Array.isArray(o.pointColors)) return null;
		// Length must match the number of points (one colour per (x,y) pair).
		if (o.pointColors.length * 2 !== o.points.length) return null;
		for (const c of o.pointColors) {
			if (typeof c !== "number" || !Number.isInteger(c)) return null;
			// Allow -1 as the "sample failed / skip" sentinel.
			if (c < -1 || c > 0xffffff) return null;
		}
		pointColors = o.pointColors as number[];
	}
	return {
		tool: tool as ToolType,
		color: o.color,
		size: o.size,
		opacity: o.opacity,
		points: o.points as number[],
		...(pointColors ? { pointColors } : {}),
	};
}

// ─────────────────────────────────────────────────────────────
//  Routes
// ─────────────────────────────────────────────────────────────
app.get("/api/", (c) => c.json({ name: "Cloudflare" }));

// GET /api/drawings — full feed for the world canvas
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
				`SELECT id, created_at, name, strokes, country, city, region,
				        likes, bbox_x1, bbox_y1, bbox_x2, bbox_y2,
				        instagram_handle
				   FROM drawings
				  WHERE hidden = 0 AND id < ?
				  ORDER BY id DESC LIMIT ?`,
			).bind(cursor, limit)
		: c.env.DB.prepare(
				`SELECT id, created_at, name, strokes, country, city, region,
				        likes, bbox_x1, bbox_y1, bbox_x2, bbox_y2,
				        instagram_handle
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
			city: string | null;
			region: string | null;
			likes: number;
			bbox_x1: number | null;
			bbox_y1: number | null;
			bbox_x2: number | null;
			bbox_y2: number | null;
			instagram_handle: string | null;
		}>(),
		c.env.DB.prepare(
			"SELECT COUNT(*) AS n FROM drawings WHERE hidden = 0",
		).first<{ n: number }>(),
	]);

	const drawings = (rowsRes.results ?? []).map((r) => ({
		id: r.id,
		created_at: r.created_at,
		name: r.name,
		country: r.country,
		city: r.city,
		region: r.region,
		likes: r.likes,
		bbox: {
			x1: r.bbox_x1 ?? 0,
			y1: r.bbox_y1 ?? 0,
			x2: r.bbox_x2 ?? 0,
			y2: r.bbox_y2 ?? 0,
		},
		strokes: safeParseStrokes(r.strokes),
		instagram_handle: r.instagram_handle,
	}));

	const next_cursor =
		drawings.length === limit ? drawings[drawings.length - 1].id : null;

	return c.json({ drawings, next_cursor, total: countRes?.n ?? 0 });
});

// GET /api/drawings/:id — single drawing with full metadata
app.get("/api/drawings/:id", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	if (!Number.isFinite(id)) return c.json({ error: "bad id" }, 400);

	const row = await c.env.DB.prepare(
		`SELECT * FROM drawings WHERE id = ? AND hidden = 0`,
	)
		.bind(id)
		.first<Record<string, unknown>>();
	if (!row) return c.json({ error: "not found" }, 404);

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
});

// POST /api/drawings — submit
app.post("/api/drawings", async (c) => {
	let body: IncomingDrawing;
	try {
		body = (await c.req.json()) as IncomingDrawing;
	} catch {
		return c.json({ error: "invalid json" }, 400);
	}

	const name =
		typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME_LEN) : "";
	if (!name) return c.json({ error: "name required" }, 400);

	if (!Array.isArray(body.strokes) || body.strokes.length === 0) {
		return c.json({ error: "strokes required" }, 400);
	}

	const validatedStrokes: IncomingStroke[] = [];
	for (const raw of body.strokes) {
		const s = validateStroke(raw);
		if (!s) return c.json({ error: "invalid stroke shape" }, 400);
		validatedStrokes.push(s);
	}

	const strokesJson = JSON.stringify(validatedStrokes);
	if (strokesJson.length > MAX_STROKES_BYTES) {
		return c.json(
			{ error: `too large (${strokesJson.length} > ${MAX_STROKES_BYTES})` },
			413,
		);
	}

	const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
	const banned = await c.env.DB.prepare(
		"SELECT 1 AS hit FROM banned_ips WHERE ip = ?",
	)
		.bind(ip)
		.first<{ hit: number }>();
	if (banned) return c.json({ error: "banned" }, 403);

	// Owner secret is required so the row can be edited later. We
	// don't trust user-supplied length here — clamp aggressively.
	const ownerSecret =
		typeof body.owner_secret === "string" && body.owner_secret.length >= 16
			? body.owner_secret.slice(0, 128)
			: null;
	if (!ownerSecret) return c.json({ error: "owner_secret required" }, 400);

	const igHandle = sanitizeIgHandle(body.instagram_handle);

	const cf = c.req.raw.cf as
		| {
				country?: string;
				city?: string;
				region?: string;
				colo?: string;
				postalCode?: string;
				timezone?: string;
		  }
		| undefined;
	const bbox = calcBbox(validatedStrokes);
	const now = Date.now();

	const result = await c.env.DB.prepare(
		`INSERT INTO drawings (
			created_at, name, strokes, country,
			ip, user_agent, accept_language,
			city, region, colo, postal_code, timezone,
			viewport_w, viewport_h, device_pixel_ratio,
			draw_time_ms, canvas_width, canvas_height,
			bbox_x1, bbox_y1, bbox_x2, bbox_y2,
			owner_secret, instagram_handle
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			now,
			name,
			strokesJson,
			cf?.country ?? null,
			ip,
			c.req.header("User-Agent") ?? null,
			c.req.header("Accept-Language") ?? null,
			cf?.city ?? null,
			cf?.region ?? null,
			cf?.colo ?? null,
			cf?.postalCode ?? null,
			cf?.timezone ?? null,
			body.viewport?.w ?? null,
			body.viewport?.h ?? null,
			body.device_pixel_ratio ?? null,
			body.draw_time_ms ?? null,
			body.canvas?.width ?? null,
			body.canvas?.height ?? null,
			bbox.x1,
			bbox.y1,
			bbox.x2,
			bbox.y2,
			ownerSecret,
			igHandle,
		)
		.run();

	return c.json(
		{ id: Number(result.meta.last_row_id), created_at: now },
		201,
	);
});

// POST /api/drawings/mine — list drawings owned by this owner_secret.
// Sent over POST so the secret isn't logged as a query param.
app.post("/api/drawings/mine", async (c) => {
	let body: { owner_secret?: string };
	try {
		body = (await c.req.json()) as { owner_secret?: string };
	} catch {
		return c.json({ error: "invalid json" }, 400);
	}
	const ownerSecret =
		typeof body.owner_secret === "string" && body.owner_secret.length >= 16
			? body.owner_secret.slice(0, 128)
			: null;
	if (!ownerSecret) return c.json({ error: "owner_secret required" }, 400);

	const res = await c.env.DB.prepare(
		`SELECT id, created_at, name, country, city, region, likes,
		        bbox_x1, bbox_y1, bbox_x2, bbox_y2, strokes,
		        instagram_handle
		   FROM drawings
		  WHERE owner_secret = ? AND hidden = 0
		  ORDER BY created_at DESC
		  LIMIT 200`,
	)
		.bind(ownerSecret)
		.all<Record<string, unknown>>();

	const drawings = (res.results ?? []).map((r) => ({
		id: r.id,
		created_at: r.created_at,
		name: r.name,
		country: r.country,
		city: r.city,
		region: r.region,
		likes: r.likes,
		bbox: {
			x1: r.bbox_x1 ?? 0,
			y1: r.bbox_y1 ?? 0,
			x2: r.bbox_x2 ?? 0,
			y2: r.bbox_y2 ?? 0,
		},
		strokes: safeParseStrokes(r.strokes as string),
		instagram_handle: r.instagram_handle,
	}));
	return c.json({ drawings });
});

// PATCH /api/drawings/:id — owner-authenticated edit
app.patch("/api/drawings/:id", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	if (!Number.isFinite(id)) return c.json({ error: "bad id" }, 400);

	let body: IncomingPatch;
	try {
		body = (await c.req.json()) as IncomingPatch;
	} catch {
		return c.json({ error: "invalid json" }, 400);
	}

	const ownerSecret =
		typeof body.owner_secret === "string" && body.owner_secret.length >= 16
			? body.owner_secret.slice(0, 128)
			: null;
	if (!ownerSecret) return c.json({ error: "owner_secret required" }, 400);

	const row = await c.env.DB.prepare(
		`SELECT owner_secret, hidden FROM drawings WHERE id = ?`,
	)
		.bind(id)
		.first<{ owner_secret: string | null; hidden: number }>();
	if (!row) return c.json({ error: "not found" }, 404);
	if (row.hidden) return c.json({ error: "hidden" }, 403);
	if (!row.owner_secret || row.owner_secret !== ownerSecret) {
		return c.json({ error: "forbidden" }, 403);
	}

	const name =
		typeof body.name === "string"
			? body.name.trim().slice(0, MAX_NAME_LEN)
			: "";
	if (!name) return c.json({ error: "name required" }, 400);

	if (!Array.isArray(body.strokes) || body.strokes.length === 0) {
		return c.json({ error: "strokes required" }, 400);
	}
	const validatedStrokes: IncomingStroke[] = [];
	for (const raw of body.strokes) {
		const s = validateStroke(raw);
		if (!s) return c.json({ error: "invalid stroke shape" }, 400);
		validatedStrokes.push(s);
	}

	const strokesJson = JSON.stringify(validatedStrokes);
	if (strokesJson.length > MAX_STROKES_BYTES) {
		return c.json(
			{ error: `too large (${strokesJson.length} > ${MAX_STROKES_BYTES})` },
			413,
		);
	}

	const bbox = calcBbox(validatedStrokes);
	const igHandle = sanitizeIgHandle(body.instagram_handle);
	await c.env.DB.prepare(
		`UPDATE drawings
		    SET name = ?, strokes = ?,
		        bbox_x1 = ?, bbox_y1 = ?, bbox_x2 = ?, bbox_y2 = ?,
		        instagram_handle = ?
		  WHERE id = ?`,
	)
		.bind(
			name,
			strokesJson,
			bbox.x1,
			bbox.y1,
			bbox.x2,
			bbox.y2,
			igHandle,
			id,
		)
		.run();

	return c.json({ ok: true });
});

// POST /api/drawings/:id/like — heart button
app.post("/api/drawings/:id/like", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	if (!Number.isFinite(id)) return c.json({ error: "bad id" }, 400);
	await c.env.DB.prepare(
		`UPDATE drawings SET likes = likes + 1 WHERE id = ? AND hidden = 0`,
	)
		.bind(id)
		.run();
	const row = await c.env.DB.prepare(
		`SELECT likes FROM drawings WHERE id = ?`,
	)
		.bind(id)
		.first<{ likes: number }>();
	return c.json({ likes: row?.likes ?? 0 });
});

// ─── Admin endpoints ─────────────────────────────────────────
// All require ?admin=<ADMIN_TOKEN> query param matching the Workers secret.

// GET /api/admin/check — diagnostic: confirm token plumbing without
// leaking the actual values. Visit /api/admin/check?admin=<token> to
// see if the comparison succeeds and check both lengths.
app.get("/api/admin/check", async (c) => {
	const raw = c.req.query("admin");
	const env = c.env.ADMIN_TOKEN;
	const t = raw?.trim();
	const e = env?.trim();
	return c.json({
		ok: !!e && !!t && t === e,
		envHasToken: !!env,
		envLen: env ? env.length : 0,
		envTrimmedLen: e ? e.length : 0,
		queryHasToken: !!raw,
		queryLen: raw ? raw.length : 0,
		queryTrimmedLen: t ? t.length : 0,
	});
});

app.post("/api/admin/drawings/:id/hide", async (c) => {
	if (!checkAdmin(c, c.env)) return c.json({ error: "forbidden" }, 403);
	const id = parseInt(c.req.param("id"), 10);
	if (!Number.isFinite(id)) return c.json({ error: "bad id" }, 400);
	await c.env.DB.prepare(`UPDATE drawings SET hidden = 1 WHERE id = ?`)
		.bind(id)
		.run();
	return c.json({ ok: true });
});

app.post("/api/admin/drawings/:id/unhide", async (c) => {
	if (!checkAdmin(c, c.env)) return c.json({ error: "forbidden" }, 403);
	const id = parseInt(c.req.param("id"), 10);
	if (!Number.isFinite(id)) return c.json({ error: "bad id" }, 400);
	await c.env.DB.prepare(`UPDATE drawings SET hidden = 0 WHERE id = ?`)
		.bind(id)
		.run();
	return c.json({ ok: true });
});

app.post("/api/admin/ban", async (c) => {
	if (!checkAdmin(c, c.env)) return c.json({ error: "forbidden" }, 403);
	let body: { ip?: string; reason?: string };
	try {
		body = (await c.req.json()) as { ip?: string; reason?: string };
	} catch {
		return c.json({ error: "invalid json" }, 400);
	}
	const ip = (body.ip ?? "").trim();
	if (!ip) return c.json({ error: "ip required" }, 400);
	const reason = (body.reason ?? "").slice(0, MAX_REASON_LEN);
	await c.env.DB.prepare(
		`INSERT OR REPLACE INTO banned_ips (ip, reason, banned_at) VALUES (?, ?, ?)`,
	)
		.bind(ip, reason, Date.now())
		.run();
	return c.json({ ok: true });
});

app.post("/api/admin/unban", async (c) => {
	if (!checkAdmin(c, c.env)) return c.json({ error: "forbidden" }, 403);
	let body: { ip?: string };
	try {
		body = (await c.req.json()) as { ip?: string };
	} catch {
		return c.json({ error: "invalid json" }, 400);
	}
	const ip = (body.ip ?? "").trim();
	if (!ip) return c.json({ error: "ip required" }, 400);
	await c.env.DB.prepare(`DELETE FROM banned_ips WHERE ip = ?`).bind(ip).run();
	return c.json({ ok: true });
});

// GET /api/admin/bans — list banned IPs, newest first.
app.get("/api/admin/bans", async (c) => {
	if (!checkAdmin(c, c.env)) return c.json({ error: "forbidden" }, 403);
	const res = await c.env.DB.prepare(
		`SELECT ip, reason, banned_at FROM banned_ips ORDER BY banned_at DESC LIMIT 500`,
	).all<{ ip: string; reason: string | null; banned_at: number }>();
	return c.json({ bans: res.results ?? [] });
});

export default app;
