import { useEffect, useRef, useState } from "react";
import type { FullDrawing } from "./types";
import { drawStrokesProgressive, totalPoints } from "./render";
import { adminBan, adminHide, isAdminMode, likeDrawing } from "./api";
import { isMyDrawing } from "./owner";
import { instagramUrl } from "./instagram";
import "./Detail.css";

interface Props {
	drawing: FullDrawing;
	onClose: () => void;
	onHidden?: (id: number) => void;
	onEdit?: (drawing: FullDrawing) => void;
}

const REPLAY_DURATION_MS = 2200;
const REPLAY_MIN_POINTS_PER_FRAME = 1;

export default function Detail({ drawing, onClose, onHidden, onEdit }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [likes, setLikes] = useState(drawing.likes ?? 0);
	const [liking, setLiking] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [replayDone, setReplayDone] = useState(false);
	const admin = isAdminMode();
	const owned = isMyDrawing(drawing.id);

	// Compute the bounding box for the canvas to fit the drawing
	const bbox = drawing.bbox;
	const dWidth = Math.max(1, bbox.x2 - bbox.x1);
	const dHeight = Math.max(1, bbox.y2 - bbox.y1);

	// ─── Replay animation ───────────────────────────────────
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const dpr = window.devicePixelRatio || 1;

		// Fit drawing into canvas with margin
		const cw = canvas.clientWidth;
		const ch = canvas.clientHeight;
		canvas.width = Math.floor(cw * dpr);
		canvas.height = Math.floor(ch * dpr);
		const margin = 24;
		const fitZoom = Math.min(
			(cw - margin * 2) / dWidth,
			(ch - margin * 2) / dHeight,
		);
		const offsetX = (cw - dWidth * fitZoom) / 2 - bbox.x1 * fitZoom;
		const offsetY = (ch - dHeight * fitZoom) / 2 - bbox.y1 * fitZoom;

		const total = totalPoints(drawing.strokes);
		const start = performance.now();
		let raf = 0;

		const render = () => {
			const elapsed = performance.now() - start;
			const t = Math.min(1, elapsed / REPLAY_DURATION_MS);
			const points = Math.max(
				REPLAY_MIN_POINTS_PER_FRAME,
				Math.floor(t * total),
			);

			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.setTransform(
				dpr * fitZoom,
				0,
				0,
				dpr * fitZoom,
				dpr * offsetX,
				dpr * offsetY,
			);
			drawStrokesProgressive(ctx, drawing.strokes, points);

			if (t < 1) {
				raf = requestAnimationFrame(render);
			} else {
				setReplayDone(true);
			}
		};
		raf = requestAnimationFrame(render);
		return () => cancelAnimationFrame(raf);
	}, [drawing, dWidth, dHeight, bbox.x1, bbox.y1]);

	const handleLike = async () => {
		if (liking) return;
		setLiking(true);
		try {
			const r = await likeDrawing(drawing.id);
			setLikes(r.likes);
		} catch (e) {
			setError(e instanceof Error ? e.message : "like failed");
		} finally {
			setLiking(false);
		}
	};

	const handleHide = async () => {
		if (!confirm(`Hide drawing #${drawing.id}? It will be removed from the public canvas.`)) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await adminHide(drawing.id);
			onHidden?.(drawing.id);
			onClose();
		} catch (e) {
			setError(e instanceof Error ? e.message : "hide failed");
			setBusy(false);
		}
	};

	const handleBan = async () => {
		if (!drawing.ip) return;
		const reason = prompt(`Ban IP ${drawing.ip}? Optional reason:`, "") ?? "";
		if (reason === null) return;
		setBusy(true);
		setError(null);
		try {
			await adminBan(drawing.ip, reason);
			alert(`Banned ${drawing.ip}.`);
		} catch (e) {
			setError(e instanceof Error ? e.message : "ban failed");
		} finally {
			setBusy(false);
		}
	};

	const drawTime =
		drawing.draw_time_ms !== null && drawing.draw_time_ms !== undefined
			? formatDrawTime(drawing.draw_time_ms)
			: "—";

	return (
		<div className="dm" onClick={onClose}>
			<div className="dm__card" onClick={(e) => e.stopPropagation()}>
				<button className="dm__close" onClick={onClose} aria-label="Close">
					×
				</button>

				<div className="dm__canvas">
					<canvas ref={canvasRef} />
					{!replayDone && <div className="dm__replayHint">replaying…</div>}
				</div>

				<div className="dm__name">{drawing.name ?? "anonymous"}</div>
				<div className="dm__when">{relTime(drawing.created_at)}</div>

				<div className="dm__likeRow">
					<button
						className="dm__like"
						onClick={handleLike}
						disabled={liking}
					>
						♥ {likes}
					</button>
					{drawing.instagram_handle && (
						<a
							className="dm__ig"
							href={instagramUrl(drawing.instagram_handle)}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={`Instagram: @${drawing.instagram_handle}`}
							title={`@${drawing.instagram_handle}`}
						>
							<InstagramIcon />
							<span className="dm__igHandle">
								@{drawing.instagram_handle}
							</span>
						</a>
					)}
					{owned && onEdit && (
						<button
							className="dm__edit"
							onClick={() => onEdit(drawing)}
						>
							✎ Edit
						</button>
					)}
				</div>

				<div className="dm__metaGrid">
					<MetaRow label="Country" value={drawing.country} />
					<MetaRow label="Region" value={drawing.region} />
					<MetaRow label="City" value={drawing.city} />
					<MetaRow label="Postal" value={drawing.postal_code} />
					<MetaRow label="Timezone" value={drawing.timezone} />
					<MetaRow label="CF colo" value={drawing.colo} />
					<MetaRow label="IP" value={drawing.ip} mono />
					<MetaRow
						label="Viewport"
						value={
							drawing.viewport_w && drawing.viewport_h
								? `${drawing.viewport_w}×${drawing.viewport_h}`
								: null
						}
					/>
					<MetaRow
						label="DPR"
						value={
							drawing.device_pixel_ratio !== null &&
							drawing.device_pixel_ratio !== undefined
								? drawing.device_pixel_ratio.toFixed(2)
								: null
						}
					/>
					<MetaRow
						label="Canvas"
						value={
							drawing.canvas_width && drawing.canvas_height
								? `${drawing.canvas_width}×${drawing.canvas_height}`
								: null
						}
					/>
					<MetaRow label="Time spent" value={drawTime} />
					<MetaRow label="Lang" value={drawing.accept_language} mono />
					<MetaRow
						label="UA"
						value={drawing.user_agent}
						mono
						long
					/>
				</div>

				{error && <div className="dm__error">{error}</div>}

				{admin && (
					<div className="dm__adminRow">
						<button
							className="dm__adminBtn"
							onClick={handleHide}
							disabled={busy}
						>
							🚫 Hide drawing
						</button>
						<button
							className="dm__adminBtn dm__adminBtn--danger"
							onClick={handleBan}
							disabled={busy || !drawing.ip}
						>
							⛔ Ban IP
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

function MetaRow({
	label,
	value,
	mono,
	long,
}: {
	label: string;
	value: string | null | undefined;
	mono?: boolean;
	long?: boolean;
}) {
	if (!value) return null;
	return (
		<div className={`dm__metaRow ${long ? "dm__metaRow--long" : ""}`}>
			<div className="dm__metaLabel">{label}</div>
			<div className={`dm__metaValue ${mono ? "dm__metaValue--mono" : ""}`}>
				{value}
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

function formatDrawTime(ms: number): string {
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	const m = Math.floor(ms / 60000);
	const s = Math.floor((ms % 60000) / 1000);
	return `${m}m ${s}s`;
}

function InstagramIcon() {
	// Simple monochrome glyph — colour comes from the parent's gradient bg.
	return (
		<svg
			className="dm__igIcon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect x="3" y="3" width="18" height="18" rx="5" />
			<circle cx="12" cy="12" r="4" />
			<circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
		</svg>
	);
}
