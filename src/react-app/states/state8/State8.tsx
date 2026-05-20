import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./State8.css";
import type { CanvasViewHandle } from "./CanvasView";
import CanvasView from "./CanvasView";
import Toolbar from "./Toolbar";
import SignModal from "./SignModal";
import Detail from "./Detail";
import BanList from "./BanList";
import MyDrawings from "./MyDrawings";
import Menu from "./Menu";
import Rules from "./Rules";
import {
	fetchFeed,
	fetchOne,
	isAdminMode,
	submitDrawing,
	updateDrawing,
} from "./api";
import { rememberMyDrawing } from "./owner";
import { clearDraft, loadDraft, saveDraft, type Draft } from "./draft";
import type {
	FeedDrawing,
	FullDrawing,
	Stroke,
	ToolType,
} from "./types";
import {
	BRUSH_SIZE_MAX,
	BRUSH_SIZE_MIN,
	ERASER_SIZE_MAX,
	ERASER_SIZE_MIN,
	WORLD_H,
	WORLD_W,
} from "./types";

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
//  Submitting requires a name (Instagram handle is optional). After
//  submit the canvas re-fetches so the new piece appears on the world
//  canvas. The browser also remembers the drawing's id locally so the
//  artist can come back later and edit it.
//
//  Admin mode: append ?admin=<token> matching the Workers secret.
//  Detail card gets Hide / Ban IP buttons; the topbar gets a Bans
//  pill that opens the live banned-IPs list.
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
	// Tracks the brush the user was on before activating the eyedropper,
	// so we can auto-revert after one pick (Photoshop-style).
	const prevToolRef = useRef<ToolType>("pen");

	const handleSetTool = (next: ToolType) => {
		if (next === "eyedropper" && tool !== "eyedropper") {
			prevToolRef.current = tool;
		}
		// Clamp size into the new tool's allowed range so e.g. switching
		// from a 1-px pen to the eraser doesn't leave the eraser at a
		// sub-minimum radius (which silently makes it look broken).
		if (next === "eraser") {
			setSize((s) =>
				Math.max(ERASER_SIZE_MIN, Math.min(ERASER_SIZE_MAX, s)),
			);
		} else if (next !== "pixel" && next !== "eyedropper") {
			setSize((s) =>
				Math.max(BRUSH_SIZE_MIN, Math.min(BRUSH_SIZE_MAX, s)),
			);
		}
		setTool(next);
	};

	const handleColorPicked = (hex: string) => {
		setColor(hex);
		// Auto-revert to the previous brush so the user can keep drawing
		const prev = prevToolRef.current;
		setTool(prev === "eyedropper" ? "pen" : prev);
	};
	const [size, setSize] = useState<number>(10);
	const [opacity, setOpacity] = useState<number>(1);
	const [draftName, setDraftName] = useState<string>("");
	const [draftInstagram, setDraftInstagram] = useState<string>("");
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
	const [bansOpen, setBansOpen] = useState(false);
	const [mineOpen, setMineOpen] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	// Rules show on every page load — no localStorage gate.
	const [rulesOpen, setRulesOpen] = useState(true);
	// editingId !== null → draft is editing an existing drawing.
	// We stash the original copy so Cancel restores it to the canvas.
	const [editingId, setEditingId] = useState<number | null>(null);
	const editingOriginalRef = useRef<FeedDrawing | null>(null);

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
			setDraftInstagram(d.instagram);
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
		if (draftStrokes.length === 0 && draftName === "" && draftInstagram === "")
			return;
		const d: Draft = {
			strokes: draftStrokes,
			tool,
			color,
			size,
			opacity,
			name: draftName,
			instagram: draftInstagram,
			startedAt: drawStartedAtRef.current || Date.now(),
		};
		saveDraft(d);
	}, [draftStrokes, tool, color, size, opacity, draftName, draftInstagram]);

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

	const handleDraftReplaced = (next: Stroke[]) => {
		// Eraser path emits a fresh strokes array — push the previous state
		// onto undo so users can recover from a mis-erase.
		setHistory((h) => [...h, draftStrokes].slice(-MAX_HISTORY));
		setFuture([]);
		setDraftStrokes(next);
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

	// ─── Keyboard shortcuts (Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z
	//     or Ctrl+Y = redo) ──────────────────────────────────
	//
	// Refs hold the latest handlers + gating state so the listener
	// can be registered exactly once without going stale.
	const undoRef = useRef(handleUndo);
	const redoRef = useRef(handleRedo);
	undoRef.current = handleUndo;
	redoRef.current = handleRedo;

	const shortcutBlockedRef = useRef(false);
	shortcutBlockedRef.current =
		mode !== "draw" ||
		signOpen ||
		detail !== null ||
		bansOpen ||
		mineOpen ||
		menuOpen ||
		rulesOpen;

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey)) return;
			const key = e.key.toLowerCase();
			if (key !== "z" && key !== "y") return;
			if (shortcutBlockedRef.current) return;

			// Don't hijack native undo/redo from text fields
			const t = e.target as HTMLElement | null;
			const tag = t?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) {
				return;
			}

			const isRedo = key === "y" || (key === "z" && e.shiftKey);
			e.preventDefault();
			if (isRedo) redoRef.current();
			else undoRef.current();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// ─── Mode toggle ────────────────────────────────────────
	const enterDraw = () => {
		setMode("draw");
		if (drawStartedAtRef.current === 0) drawStartedAtRef.current = Date.now();
	};

	const cancelDraft = () => {
		const isEditing = editingId !== null;
		if (
			draftStrokes.length > 0 &&
			!confirm(
				isEditing
					? "Discard your edits? The drawing will be restored to its previous version."
					: "Discard your drawing? This cannot be undone.",
			)
		) {
			return;
		}
		// If editing, put the original drawing back on the canvas.
		if (isEditing && editingOriginalRef.current) {
			const orig = editingOriginalRef.current;
			setExisting((arr) =>
				arr.some((d) => d.id === orig.id) ? arr : [orig, ...arr],
			);
		}
		setEditingId(null);
		editingOriginalRef.current = null;
		setDraftStrokes([]);
		setHistory([]);
		setFuture([]);
		setDraftName("");
		setDraftInstagram("");
		drawStartedAtRef.current = Date.now();
		clearDraft();
		setMode("view");
	};

	const handleClear = () => {
		if (draftStrokes.length === 0) return;
		if (!confirm("Clear all your strokes? This cannot be undone.")) return;
		// Push current state onto undo so a misclick is still recoverable
		setHistory((h) => [...h, draftStrokes].slice(-MAX_HISTORY));
		setFuture([]);
		setDraftStrokes([]);
	};

	// ─── Submit ─────────────────────────────────────────────
	const handleSubmit = async (name: string, instagram: string | null) => {
		setSubmitting(true);
		setSubmitError(null);
		try {
			if (editingId !== null) {
				await updateDrawing(editingId, {
					name,
					strokes: draftStrokes,
					instagram_handle: instagram,
				});
			} else {
				const res = await submitDrawing({
					name,
					strokes: draftStrokes,
					canvas: { width: WORLD_W, height: WORLD_H },
					viewport: { w: window.innerWidth, h: window.innerHeight },
					device_pixel_ratio: window.devicePixelRatio || 1,
					draw_time_ms: Math.max(
						0,
						Date.now() - (drawStartedAtRef.current || Date.now()),
					),
					instagram_handle: instagram,
				});
				rememberMyDrawing(res.id);
			}
			// Clear local state, reload feed
			setEditingId(null);
			editingOriginalRef.current = null;
			setDraftStrokes([]);
			setHistory([]);
			setFuture([]);
			setDraftName("");
			setDraftInstagram("");
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

	// ─── Enter edit mode for an owned drawing ───────────────
	const enterEdit = (target: FeedDrawing) => {
		// If there's an unsaved draft, give the user a chance to bail.
		if (
			draftStrokes.length > 0 &&
			editingId === null &&
			!confirm(
				"You have an unsaved drawing. Loading this one will discard it. Continue?",
			)
		) {
			return;
		}
		// Stash the original so Cancel can restore it. Pull the up-to-date
		// version from `existing` if available — it includes the strokes.
		const fromFeed = existing.find((d) => d.id === target.id) ?? target;
		editingOriginalRef.current = fromFeed;
		setExisting((arr) => arr.filter((d) => d.id !== target.id));
		setEditingId(target.id);
		setDraftStrokes([...fromFeed.strokes]);
		setDraftName(fromFeed.name ?? "");
		setDraftInstagram(fromFeed.instagram_handle ?? "");
		setHistory([]);
		setFuture([]);
		drawStartedAtRef.current = Date.now();
		setDetail(null);
		setMineOpen(false);
		setMode("draw");
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

	// Estimate the on-wire payload size so the toolbar can show a
	// budget bar against the worker's MAX_STROKES_BYTES cap. Uses the
	// same integer-rounded points api.ts compactStrokes() will use,
	// so the number matches what actually gets POSTed. Recomputes on
	// every stroke commit (cheap; only runs when draftStrokes change).
	const payloadBytes = useMemo(() => {
		const compact = draftStrokes.map((s) => ({
			...s,
			points: s.points.map((p) => Math.round(p)),
		}));
		return JSON.stringify(compact).length;
	}, [draftStrokes]);
	const PAYLOAD_CAP = 950_000;

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
				onDraftReplaced={handleDraftReplaced}
				onTapDrawing={handleTapDrawing}
				onColorPicked={handleColorPicked}
			/>

			{/* Top-bar info / mode toggle */}
			<div className="s8__topbar">
				<div className="s8__topbarLeft">
					<button
						className="s8__menuFab"
						onClick={() => setMenuOpen(true)}
						aria-label="Open menu"
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<line x1="4" y1="7" x2="20" y2="7" />
							<line x1="4" y1="12" x2="20" y2="12" />
							<line x1="4" y1="17" x2="20" y2="17" />
						</svg>
					</button>
					<div className="s8__brand">
						<div className="s8__brandTitle">Subdermal</div>
						<div className="s8__brandSub">
							{editingId !== null
								? "editing your drawing"
								: `${existing.length} artwork${existing.length === 1 ? "" : "s"}`}
							{admin && " · admin"}
							{feedError && " · feed error"}
						</div>
					</div>
				</div>
				{mode === "view" && (
					<div className="s8__topbarRight">
						{admin && (
							<button
								className="s8__bansFab"
								onClick={() => setBansOpen(true)}
								aria-label="Banned IPs"
							>
								⛔ Bans
							</button>
						)}
						<button
							className="s8__mineFab"
							onClick={() => setMineOpen(true)}
							aria-label="My drawings"
						>
							✎ Mine
						</button>
						<button
							className="s8__drawFab"
							onClick={enterDraw}
							aria-label="Draw"
						>
							✏︎ Draw
						</button>
					</div>
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
					onTool={handleSetTool}
					onColor={setColor}
					onSize={setSize}
					onOpacity={setOpacity}
					onUndo={handleUndo}
					onRedo={handleRedo}
					onSubmit={() => setSignOpen(true)}
					onCancel={cancelDraft}
					onResetView={() => canvasHandleRef.current?.resetView()}
					onClear={handleClear}
					hasStrokes={hasStrokes}
					payloadBytes={payloadBytes}
					payloadCap={PAYLOAD_CAP}
				/>
			)}

			{signOpen && (
				<SignModal
					defaultName={draftName}
					defaultInstagram={draftInstagram}
					pending={submitting}
					error={submitError}
					editing={editingId !== null}
					onCancel={() => {
						if (!submitting) setSignOpen(false);
					}}
					onSubmit={(name, instagram) => {
						setDraftName(name);
						setDraftInstagram(instagram ?? "");
						void handleSubmit(name, instagram);
					}}
				/>
			)}

			{detail && (
				<Detail
					drawing={detail}
					onClose={() => setDetail(null)}
					onHidden={removeFromCanvas}
					onEdit={enterEdit}
				/>
			)}

			{bansOpen && <BanList onClose={() => setBansOpen(false)} />}

			{mineOpen && (
				<MyDrawings
					onClose={() => setMineOpen(false)}
					onEdit={enterEdit}
				/>
			)}

			<Menu open={menuOpen} onClose={() => setMenuOpen(false)} />

			{rulesOpen && (
				<Rules
					onAccept={() => setRulesOpen(false)}
				/>
			)}

			{detailLoading && (
				<div className="s8__loadingPill">opening drawing…</div>
			)}
		</div>
	);
}
