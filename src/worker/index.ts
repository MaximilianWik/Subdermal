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
	| "eraser";
interface IncomingStroke {
	tool: ToolType;
	color: string;
	size: number;
	opacity: number;
	points: number[]; // flat: [x0, y0, x1, y1, ...] in WORLD coords
}
interface IncomingDrawing {
	name?: string;
	strokes: IncomingStroke[];
	canvas?: { width: number; height: number };
	viewport?: { w: number; h: number };
	device_pixel_ratio?: number;
	draw_time_ms?: number;
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
function checkAdmin(c: { req: { query: (k: string) => string | undefined } }, env: Env): boolean {
	const t = c.req.query("admin");
	return !!env.ADMIN_TOKEN && !!t && t === env.ADMIN_TOKEN;
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
		for (let i = 0; i < pts.length; i += 2) {
			const x = pts[i];
			const y = pts[i + 1];
			if (x < x1) x1 = x;
			if (y < y1) y1 = y;
			if (x > x2) x2 = x;
			if (y > y2) y2 = y;
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
	"eraser",
];

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
	return {
		tool: tool as ToolType,
		color: o.color,
		size: o.size,
		opacity: o.opacity,
		points: o.points as number[],
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
				        likes, bbox_x1, bbox_y1, bbox_x2, bbox_y2
				   FROM drawings
				  WHERE hidden = 0 AND id < ?
				  ORDER BY id DESC LIMIT ?`,
			).bind(cursor, limit)
		: c.env.DB.prepare(
				`SELECT id, created_at, name, strokes, country, city, region,
				        likes, bbox_x1, bbox_y1, bbox_x2, bbox_y2
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
			bbox_x1, bbox_y1, bbox_x2, bbox_y2
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
		)
		.run();

	return c.json(
		{ id: Number(result.meta.last_row_id), created_at: now },
		201,
	);
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

export default app;
