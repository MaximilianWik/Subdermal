import { useCallback, useEffect, useState } from "react";
import "./State8.css";

// ─────────────────────────────────────────────────────────────
//  State 8 — Canvas (placeholder).
//
//  Stand-in UI for the collaborative canvas while we build it
//  out. Verifies end-to-end DB connectivity by hitting the
//  /api/drawings endpoints:
//    GET   — total count + last few entries
//    POST  — submits a tiny placeholder drawing so we can see
//            writes land in D1 from the live page.
//
//  This whole component will be replaced by the real canvas
//  UI in the next iteration.
// ─────────────────────────────────────────────────────────────

type Drawing = {
	id: number;
	created_at: number;
	name: string | null;
	country: string | null;
	strokes: unknown[];
};

type Feed = {
	drawings: Drawing[];
	next_cursor: number | null;
	total: number;
};

const PREVIEW_LIMIT = 5;

export default function State8() {
	const [feed, setFeed] = useState<Feed | null>(null);
	const [loading, setLoading] = useState(false);
	const [posting, setPosting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const r = await fetch(`/api/drawings?limit=${PREVIEW_LIMIT}`);
			if (!r.ok) throw new Error(`GET ${r.status}`);
			const data = (await r.json()) as Feed;
			setFeed(data);
		} catch (e) {
			setError(e instanceof Error ? e.message : "fetch failed");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const submitTest = useCallback(async () => {
		setPosting(true);
		setError(null);
		try {
			// Single horizontal "stroke" — placeholder until the real canvas
			// UI defines its stroke schema.
			const r = await fetch("/api/drawings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "test",
					strokes: [
						{
							tool: "pen",
							color: "#ffffff",
							width: 4,
							points: [
								[0.1, 0.5],
								[0.9, 0.5],
							],
						},
					],
				}),
			});
			if (!r.ok) {
				const txt = await r.text();
				throw new Error(`POST ${r.status}: ${txt}`);
			}
			await refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "submit failed");
		} finally {
			setPosting(false);
		}
	}, [refresh]);

	return (
		<div className="s8">
			<div className="s8__card">
				<div className="s8__title">Canvas — placeholder</div>
				<div className="s8__count">
					{feed === null && !error ? "…" : feed?.total ?? "—"}
				</div>
				<div className="s8__label">drawings in the database</div>

				<div className="s8__actions">
					<button
						className="s8__btn s8__btn--primary"
						onClick={submitTest}
						disabled={posting}
					>
						{posting ? "submitting…" : "submit test drawing"}
					</button>
					<button
						className="s8__btn"
						onClick={() => void refresh()}
						disabled={loading}
					>
						{loading ? "loading…" : "refresh"}
					</button>
				</div>

				{error && <div className="s8__error">{error}</div>}

				<div className="s8__sectionLabel">last {PREVIEW_LIMIT}</div>
				<div className="s8__list">
					{feed?.drawings.length === 0 && (
						<div className="s8__empty">no drawings yet</div>
					)}
					{feed?.drawings.map((d) => (
						<div key={d.id} className="s8__row">
							<span className="s8__id">#{d.id}</span>
							<span className="s8__name">{d.name ?? "anonymous"}</span>
							<span className="s8__country">{d.country ?? "—"}</span>
							<span className="s8__when">{relTime(d.created_at)}</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function relTime(ms: number): string {
	const diff = Date.now() - ms;
	const s = Math.max(0, Math.round(diff / 1000));
	if (s < 60) return `${s}s ago`;
	const m = Math.round(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.round(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.round(h / 24);
	return `${d}d ago`;
}
