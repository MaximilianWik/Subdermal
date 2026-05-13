import type { FeedDrawing, FullDrawing, Stroke } from "./types";
import { getOwnerSecret } from "./owner";

// ─────────────────────────────────────────────────────────────
//  API helpers — thin wrappers around fetch().
// ─────────────────────────────────────────────────────────────

const API_BASE = "/api/drawings";

interface FeedResponse {
	drawings: FeedDrawing[];
	next_cursor: number | null;
	total: number;
}

export async function fetchFeed(opts?: {
	cursor?: number;
	limit?: number;
}): Promise<FeedResponse> {
	const params = new URLSearchParams();
	if (opts?.cursor !== undefined) params.set("cursor", String(opts.cursor));
	if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
	const r = await fetch(`${API_BASE}?${params.toString()}`);
	if (!r.ok) throw new Error(`feed ${r.status}`);
	return (await r.json()) as FeedResponse;
}

export async function fetchOne(id: number): Promise<FullDrawing> {
	const r = await fetch(`${API_BASE}/${id}`);
	if (!r.ok) throw new Error(`drawing ${r.status}`);
	return (await r.json()) as FullDrawing;
}

export async function submitDrawing(payload: {
	name: string;
	strokes: Stroke[];
	canvas: { width: number; height: number };
	viewport: { w: number; h: number };
	device_pixel_ratio: number;
	draw_time_ms: number;
}): Promise<{ id: number; created_at: number }> {
	const r = await fetch(API_BASE, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ...payload, owner_secret: getOwnerSecret() }),
	});
	if (!r.ok) {
		const t = await r.text();
		throw new Error(`POST ${r.status}: ${t}`);
	}
	return (await r.json()) as { id: number; created_at: number };
}

export async function updateDrawing(
	id: number,
	payload: { name: string; strokes: Stroke[] },
): Promise<void> {
	const r = await fetch(`${API_BASE}/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ...payload, owner_secret: getOwnerSecret() }),
	});
	if (!r.ok) {
		const t = await r.text();
		throw new Error(`PATCH ${r.status}: ${t}`);
	}
}

export async function fetchMine(): Promise<FeedDrawing[]> {
	const r = await fetch(`${API_BASE}/mine`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ owner_secret: getOwnerSecret() }),
	});
	if (!r.ok) throw new Error(`mine ${r.status}`);
	const j = (await r.json()) as { drawings: FeedDrawing[] };
	return j.drawings;
}

export async function likeDrawing(id: number): Promise<{ likes: number }> {
	const r = await fetch(`${API_BASE}/${id}/like`, { method: "POST" });
	if (!r.ok) throw new Error(`like ${r.status}`);
	return (await r.json()) as { likes: number };
}

// ─── Admin (only works when ?admin=<token> matches the Workers secret) ──

function adminQs(): string {
	const t = new URLSearchParams(location.search).get("admin");
	return t ? `?admin=${encodeURIComponent(t)}` : "";
}

export function isAdminMode(): boolean {
	return new URLSearchParams(location.search).has("admin");
}

export async function adminHide(id: number): Promise<void> {
	const r = await fetch(`/api/admin/drawings/${id}/hide${adminQs()}`, {
		method: "POST",
	});
	if (!r.ok) throw new Error(`hide ${r.status}`);
}

export async function adminBan(ip: string, reason: string): Promise<void> {
	const r = await fetch(`/api/admin/ban${adminQs()}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ip, reason }),
	});
	if (!r.ok) throw new Error(`ban ${r.status}`);
}

export interface BanRow {
	ip: string;
	reason: string | null;
	banned_at: number;
}

export async function fetchBans(): Promise<BanRow[]> {
	const r = await fetch(`/api/admin/bans${adminQs()}`);
	if (!r.ok) throw new Error(`bans ${r.status}`);
	const j = (await r.json()) as { bans: BanRow[] };
	return j.bans;
}

export async function adminUnban(ip: string): Promise<void> {
	const r = await fetch(`/api/admin/unban${adminQs()}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ip }),
	});
	if (!r.ok) throw new Error(`unban ${r.status}`);
}
