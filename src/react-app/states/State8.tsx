import { useCallback, useEffect, useRef, useState } from "react";
import "./State8.css";
import type { CanvasViewHandle } from "./state8/CanvasView";
import CanvasView from "./state8/CanvasView";
import Toolbar from "./state8/Toolbar";
import SignModal from "./state8/SignModal";
import Detail from "./state8/Detail";
import {
	fetchFeed,
	fetchOne,
	isAdminMode,
	submitDrawing,
} from "./state8/api";
import { clearDraft, loadDraft, saveDraft, type Draft } from "./state8/draft";
import type {
	FeedDrawing,
	FullDrawing,
	Stroke,
	ToolType,
} from "./state8/types";
import {
	BRUSH_SIZE_MAX,
	BRUSH_SIZE_MIN,
	WORLD_H,
	WORLD_W,
} from "./state8/types";

// ─────────────────────────────────────────────────────────────
//  State 8 — Collaborative canvas.
//
//  One huge shared world canvas (16384×24576). Everyone draws on
//  the same surface in empty space. New strokes can't be drawn
//  on cells already covered by other people's strokes.
//
//  Modes:
//    "view"  — pan/zoom, tap a drawing to open its detail card
//    "draw"  — tools toolbar visible, taps draw, two-finger pinch/pan
//
//  Submitting requires a name. After submit, the canvas re-fetches
//  so the new piece appears on the world canvas.
//
//  Admin mode: append ?admin=<token> matching the Workers secret —
//  detail card gets Hide / Ban IP buttons.
// ─────────────────────────────────────────────────────────────

type Mode = "view" | "draw";

const MAX_HISTORY = 50;

export default function State8() {
	const [mode, setMode] = useState<Mode>("view");
	const [existing, setExisting] = useState<FeedDrawing[]>([]);
	const [feedError, setFeedError] = useState<string | null>(null);

	// Draft state — strokes are kept in a state array so undo/redo work
	const [draftStrokes, setDraftStrokes] = useState<Stroke[]>([]);
	const [tool, setTool] = useState<ToolType>("pen");
	const [color, setColor] = useState<string>("#000000");
	const [size, setSize] = useState<number>(6);
	const [opacity, setOpacity] = useState<number>(1);
	const [draftName, setDraftName] = useState<string>("");
	const drawStartedAtRef = useRef<number>(0);

	// Undo / redo stacks
	const [history, setHistory] = useState<Stroke[][]>([]);
	const [future, setFuture] = useState<Stroke[][]>([]);

	// Modals
	const [signOpen, setSignOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [detail, setDetail] = useState<FullDrawing | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);

	const canvasHandleRef = useRef<CanvasViewHandle>(null);

	// ─── Initial load: existing drawings + draft restore ────
	useEffect(() => {
		void loadFeed();
		const d = loadDraft();
		if (d && d.strokes.length > 0) {
			setDraftStrokes(d.strokes);
			setTool(d.tool);
			setColor(d.color);
			setSize(d.size);
			setOpacity(d.opacity);
			setDraftName(d.name);
			drawStartedAtRef.current = d.startedAt;
		} else {
			drawStartedAtRef.current = Date.now();
		}
	}, []);

	const loadFeed = useCallback(async () => {
		try {
			const r = await fetchFeed({ limit: 1000 });
			setExisting(r.drawings);
			setFeedError(null);
		} catch (e) {
			setFeedError(e instanceof Error ? e.message : "feed failed");
		}
	}, []);

	// ─── Persist draft on every change ──────────────────────
	useEffect(() => {
		if (draftStrokes.length === 0 && draftName === "") return;
		const d: Draft = {
			strokes: draftStrokes,
			tool,
			color,
			size,
			opacity,
			name: draftName,
			startedAt: drawStartedAtRef.current || Date.now(),
		};
		saveDraft(d);
	}, [draftStrokes, tool, color, size, opacity, draftName]);

	// ─── Add / undo / redo / erase ──────────────────────────
	const pushHistory = (next: Stroke[]) => {
		setHistory((h) => [...h, draftStrokes].slice(-MAX_HISTORY));
		setFuture([]);
		setDraftStrokes(next);
	};

	const handleStrokeAdded = (s: Stroke) => {
		// Clamp brush size into legal range as a safety net
		s.size = Math.max(
			BRUSH_SIZE_MIN,
			Math.min(BRUSH_SIZE_MAX, s.size),
		);
		pushHistory([...draftStrokes, s]);
	};

	const handleErased = (idxs: number[]) => {
		const set = new Set(idxs);
		const next = draftStrokes.filter((_, i) => !set.has(i));
		pushHistory(next);
	};

	const handleUndo = () => {
		if (history.length === 0) return;
		const prev = history[history.length - 1];
		setHistory((h) => h.slice(0, -1));
		setFuture((f) => [draftStrokes, ...f]);
		setDraftStrokes(prev);
	};

	const handleRedo = () => {
		if (future.length === 0) return;
		const next = future[0];
		setFuture((f) => f.slice(1));
		setHistory((h) => [...h, draftStrokes].slice(-MAX_HISTORY));
		setDraftStrokes(next);
	};

	// ─── Mode toggle ────────────────────────────────────────
	const enterDraw = () => {
		setMode("draw");
		if (drawStartedAtRef.current === 0) drawStartedAtRef.current = Date.now();
	};

	const cancelDraft = () => {
		if (
			draftStrokes.length > 0 &&
			!confirm("Discard your drawing? This cannot be undone.")
		) {
			return;
		}
		setDraftStrokes([]);
		setHistory([]);
		setFuture([]);
		setDraftName("");
		drawStartedAtRef.current = Date.now();
		clearDraft();
		setMode("view");
	};

	// ─── Submit ─────────────────────────────────────────────
	const handleSubmit = async (name: string) => {
		setSubmitting(true);
		setSubmitError(null);
		try {
			await submitDrawing({
				name,
				strokes: draftStrokes,
				canvas: { width: WORLD_W, height: WORLD_H },
				viewport: { w: window.innerWidth, h: window.innerHeight },
				device_pixel_ratio: window.devicePixelRatio || 1,
				draw_time_ms: Math.max(
					0,
					Date.now() - (drawStartedAtRef.current || Date.now()),
				),
			});
			// Clear local state, reload feed
			setDraftStrokes([]);
			setHistory([]);
			setFuture([]);
			setDraftName("");
			drawStartedAtRef.current = Date.now();
			clearDraft();
			setSignOpen(false);
			setMode("view");
			await loadFeed();
		} catch (e) {
			setSubmitError(e instanceof Error ? e.message : "submit failed");
		} finally {
			setSubmitting(false);
		}
	};

	// ─── Tap on a drawing → load full + open detail ─────────
	const handleTapDrawing = async (d: FeedDrawing) => {
		setDetailLoading(true);
		try {
			const full = await fetchOne(d.id);
			setDetail(full);
		} catch (e) {
			alert(`failed: ${e instanceof Error ? e.message : "unknown"}`);
		} finally {
			setDetailLoading(false);
		}
	};

	const removeFromCanvas = (id: number) => {
		setExisting((arr) => arr.filter((d) => d.id !== id));
	};

	const hasStrokes = draftStrokes.length > 0;
	const admin = isAdminMode();

	return (
		<div className="s8">
			<CanvasView
				canvasRef={canvasHandleRef}
				mode={mode}
				tool={tool}
				color={color}
				size={size}
				opacity={opacity}
				existing={existing}
				draftStrokes={draftStrokes}
				onStrokeAdded={handleStrokeAdded}
				onStrokeErased={handleErased}
				onTapDrawing={handleTapDrawing}
			/>

			{/* Top-bar info / mode toggle */}
			<div className="s8__topbar">
				<div className="s8__brand">
					<div className="s8__brandTitle">Maxsonny</div>
					<div className="s8__brandSub">
						{existing.length} drawing{existing.length === 1 ? "" : "s"}
						{admin && " · admin"}
						{feedError && " · feed error"}
					</div>
				</div>
				{mode === "view" && (
					<button
						className="s8__drawFab"
						onClick={enterDraw}
						aria-label="Draw"
					>
						✏︎ Draw
					</button>
				)}
			</div>

			{mode === "draw" && (
				<Toolbar
					tool={tool}
					color={color}
					size={size}
					opacity={opacity}
					canUndo={history.length > 0}
					canRedo={future.length > 0}
					onTool={setTool}
					onColor={setColor}
					onSize={setSize}
					onOpacity={setOpacity}
					onUndo={handleUndo}
					onRedo={handleRedo}
					onSubmit={() => setSignOpen(true)}
					onCancel={cancelDraft}
					onResetView={() => canvasHandleRef.current?.resetView()}
					hasStrokes={hasStrokes}
				/>
			)}

			{signOpen && (
				<SignModal
					defaultName={draftName}
					pending={submitting}
					error={submitError}
					onCancel={() => {
						if (!submitting) setSignOpen(false);
					}}
					onSubmit={(name) => {
						setDraftName(name);
						void handleSubmit(name);
					}}
				/>
			)}

			{detail && (
				<Detail
					drawing={detail}
					onClose={() => setDetail(null)}
					onHidden={removeFromCanvas}
				/>
			)}

			{detailLoading && (
				<div className="s8__loadingPill">opening drawing…</div>
			)}
		</div>
	);
}
