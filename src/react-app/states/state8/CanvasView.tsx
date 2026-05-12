import {
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	type Ref,
} from "react";
import type { FeedDrawing, Stroke } from "./types";
import {
	WORLD_W,
	WORLD_H,
	INITIAL_VIEW_W,
	INITIAL_VIEW_H,
	ZOOM_MIN,
	ZOOM_MAX,
} from "./types";
import { OccupancyGrid } from "./occupancy";
import { drawStrokes } from "./render";
import "./CanvasView.css";

// ─────────────────────────────────────────────────────────────
//  CanvasView — the actual world canvas with pan/zoom rendering
//  and drawing input. Imperative API exposed via ref so the
//  parent can drive it (start/finish stroke, undo, etc.).
// ─────────────────────────────────────────────────────────────

export interface CanvasViewHandle {
	/** Replace the in-progress draft strokes (e.g. for undo/redo). */
	setDraft: (strokes: Stroke[]) => void;
	/** Re-center on the canvas center at zoom 1. */
	resetView: () => void;
	/** Zoom to a level centered on the viewport. */
	setZoom: (z: number) => void;
}

interface Props {
	mode: "view" | "draw";
	tool: Stroke["tool"];
	color: string;
	size: number;
	opacity: number;
	existing: FeedDrawing[];
	draftStrokes: Stroke[];
	onStrokeAdded: (s: Stroke) => void;
	onDraftReplaced: (next: Stroke[]) => void;
	onTapDrawing: (drawing: FeedDrawing) => void;
	canvasRef?: Ref<CanvasViewHandle>;
}

export default function CanvasView({
	mode,
	tool,
	color,
	size,
	opacity,
	existing,
	draftStrokes,
	onStrokeAdded,
	onDraftReplaced,
	onTapDrawing,
	canvasRef,
}: Props) {
	const wrapRef = useRef<HTMLDivElement>(null);
	const canvasElRef = useRef<HTMLCanvasElement>(null);
	const eraserCursorRef = useRef<HTMLDivElement>(null);

	// View transform: world (wx, wy) -> screen (sx, sy)
	//   sx = wx * zoom + view.x
	//   sy = wy * zoom + view.y
	const viewRef = useRef({ x: 0, y: 0, zoom: 1 });

	// Occupancy grid is rebuilt whenever `existing` changes
	const occupancyRef = useRef<OccupancyGrid>(new OccupancyGrid());

	// Strokes the user is currently drawing — kept in a ref because we
	// mutate it during pointer-move at very high frequency (don't re-render
	// React for every point — render loop pulls from the ref).
	const liveStrokesRef = useRef<Stroke[]>([]);
	const currentStrokeRef = useRef<Stroke | null>(null);

	// Active pointers for multi-touch gesture detection
	const pointersRef = useRef<Map<number, { x: number; y: number }>>(
		new Map(),
	);
	const gestureRef = useRef<
		| null
		| {
				type: "pan-pinch";
				startView: { x: number; y: number; zoom: number };
				startCenter: { x: number; y: number };
				startDist: number;
		  }
	>(null);

	const tapRef = useRef<{
		startX: number;
		startY: number;
		startTime: number;
		moved: boolean;
	} | null>(null);

	// ─── Imperative API ─────────────────────────────────────
	useImperativeHandle(canvasRef, () => ({
		setDraft: (strokes: Stroke[]) => {
			liveStrokesRef.current = strokes;
			scheduleDraw();
		},
		resetView: () => {
			centerView();
			scheduleDraw();
		},
		setZoom: (z: number) => {
			const v = viewRef.current;
			const cw = wrapRef.current?.clientWidth ?? INITIAL_VIEW_W;
			const ch = wrapRef.current?.clientHeight ?? INITIAL_VIEW_H;
			// Keep viewport center fixed while changing zoom
			const wx = (cw / 2 - v.x) / v.zoom;
			const wy = (ch / 2 - v.y) / v.zoom;
			v.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
			v.x = cw / 2 - wx * v.zoom;
			v.y = ch / 2 - wy * v.zoom;
			scheduleDraw();
		},
	}));

	// ─── Rebuild occupancy when `existing` changes ──────────
	useEffect(() => {
		const grid = new OccupancyGrid();
		for (const d of existing) {
			for (const s of d.strokes) grid.addStroke(s);
		}
		occupancyRef.current = grid;
		scheduleDraw();
	}, [existing]);

	// ─── Sync external draft strokes into the live ref ──────
	useEffect(() => {
		liveStrokesRef.current = [...draftStrokes];
		scheduleDraw();
	}, [draftStrokes]);

	// ─── Center on canvas ──────────────────────────────────
	const centerView = useCallback(() => {
		const wrap = wrapRef.current;
		if (!wrap) return;
		const cw = wrap.clientWidth;
		const ch = wrap.clientHeight;
		// Show the initial viewport area centered, at zoom that fits it
		const zoom = Math.min(cw / INITIAL_VIEW_W, ch / INITIAL_VIEW_H);
		viewRef.current = {
			zoom,
			x: cw / 2 - (WORLD_W / 2) * zoom,
			y: ch / 2 - (WORLD_H / 2) * zoom,
		};
	}, []);

	// ─── Resize / DPR handling ──────────────────────────────
	useEffect(() => {
		const wrap = wrapRef.current;
		const canvas = canvasElRef.current;
		if (!wrap || !canvas) return;
		const resize = () => {
			const dpr = window.devicePixelRatio || 1;
			const w = wrap.clientWidth;
			const h = wrap.clientHeight;
			canvas.width = Math.floor(w * dpr);
			canvas.height = Math.floor(h * dpr);
			canvas.style.width = w + "px";
			canvas.style.height = h + "px";
			scheduleDraw();
		};
		resize();
		centerView();
		scheduleDraw();
		const ro = new ResizeObserver(resize);
		ro.observe(wrap);
		return () => ro.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ─── Render loop (RAF on demand) ────────────────────────
	//
	// The render function is assigned to a ref every render so the stable
	// scheduleDraw closure always invokes the LATEST version (with the
	// current `existing` array baked into its closure). Without this, the
	// canvas would render against whatever `existing` was on first mount.
	const drawAllRef = useRef<() => void>(() => {});
	const drawScheduledRef = useRef(false);
	const scheduleDraw = useCallback(() => {
		if (drawScheduledRef.current) return;
		drawScheduledRef.current = true;
		requestAnimationFrame(() => {
			drawScheduledRef.current = false;
			drawAllRef.current();
		});
	}, []);

	drawAllRef.current = () => {
		const canvas = canvasElRef.current;
		const wrap = wrapRef.current;
		if (!canvas || !wrap) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const dpr = window.devicePixelRatio || 1;
		const v = viewRef.current;
		// Clear screen-space first
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// White canvas background
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Apply DPR + view transform
		ctx.setTransform(
			dpr * v.zoom,
			0,
			0,
			dpr * v.zoom,
			dpr * v.x,
			dpr * v.y,
		);

		// Grid background (only inside world bounds)
		drawGrid(ctx, v);

		// Existing drawings
		for (const d of existing) drawStrokes(ctx, d.strokes);
		// Live (in-progress) strokes on top
		drawStrokes(ctx, liveStrokesRef.current);

		// World boundary
		ctx.lineWidth = 2 / v.zoom;
		ctx.strokeStyle = "rgba(0,0,0,0.18)";
		ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
	};

	// Schedule redraw whenever inputs that affect static rendering change
	useEffect(scheduleDraw, [existing, scheduleDraw]);

	// ─── Pointer event handling ─────────────────────────────
	const screenToWorld = (sx: number, sy: number) => {
		const v = viewRef.current;
		return { x: (sx - v.x) / v.zoom, y: (sy - v.y) / v.zoom };
	};

	const handlePointerDown = (e: React.PointerEvent) => {
		const wrap = wrapRef.current;
		if (!wrap) return;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		const r = wrap.getBoundingClientRect();
		const sx = e.clientX - r.left;
		const sy = e.clientY - r.top;
		pointersRef.current.set(e.pointerId, { x: sx, y: sy });

		// Two-finger gesture? start pinch/pan
		if (pointersRef.current.size === 2) {
			const pts = Array.from(pointersRef.current.values());
			gestureRef.current = {
				type: "pan-pinch",
				startView: { ...viewRef.current },
				startCenter: {
					x: (pts[0].x + pts[1].x) / 2,
					y: (pts[0].y + pts[1].y) / 2,
				},
				startDist: Math.hypot(
					pts[0].x - pts[1].x,
					pts[0].y - pts[1].y,
				),
			};
			// Cancel any in-progress single-finger work
			currentStrokeRef.current = null;
			tapRef.current = null;
			return;
		}

		// Single-finger
		tapRef.current = {
			startX: sx,
			startY: sy,
			startTime: performance.now(),
			moved: false,
		};

		if (mode === "draw") {
			const { x: wx, y: wy } = screenToWorld(sx, sy);
			if (tool === "eraser") {
				// Eraser at this point — find any draft strokes within radius and remove
				eraseAt(wx, wy);
				return;
			}
			// Skip if this point is already occupied by another drawing
			if (
				occupancyRef.current.isWorldPointOccupied(wx, wy) &&
				wx >= 0 &&
				wy >= 0 &&
				wx <= WORLD_W &&
				wy <= WORLD_H
			) {
				// Don't start the stroke here — but still allow continuing if they move
				currentStrokeRef.current = {
					tool,
					color,
					size,
					opacity,
					points: [],
				};
			} else {
				currentStrokeRef.current = {
					tool,
					color,
					size,
					opacity,
					points: [wx, wy],
				};
				liveStrokesRef.current.push(currentStrokeRef.current);
			}
			scheduleDraw();
		}
	};

	const handlePointerMove = (e: React.PointerEvent) => {
		const wrap = wrapRef.current;
		if (!wrap) return;
		const r = wrap.getBoundingClientRect();
		const sx = e.clientX - r.left;
		const sy = e.clientY - r.top;
		const tracked = pointersRef.current.get(e.pointerId);
		if (!tracked) return;
		tracked.x = sx;
		tracked.y = sy;

		// Mark tap as moved if the cursor traveled
		if (tapRef.current) {
			const dx = sx - tapRef.current.startX;
			const dy = sy - tapRef.current.startY;
			if (dx * dx + dy * dy > 36) tapRef.current.moved = true;
		}

		// Two-finger gesture: pan + pinch
		if (gestureRef.current && pointersRef.current.size === 2) {
			const pts = Array.from(pointersRef.current.values());
			const center = {
				x: (pts[0].x + pts[1].x) / 2,
				y: (pts[0].y + pts[1].y) / 2,
			};
			const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
			const g = gestureRef.current;
			const zoomFactor = dist / Math.max(1, g.startDist);
			const newZoom = Math.max(
				ZOOM_MIN,
				Math.min(ZOOM_MAX, g.startView.zoom * zoomFactor),
			);
			// Anchor zoom on the gesture center (in world coords)
			const anchorWorldX =
				(g.startCenter.x - g.startView.x) / g.startView.zoom;
			const anchorWorldY =
				(g.startCenter.y - g.startView.y) / g.startView.zoom;
			viewRef.current.zoom = newZoom;
			viewRef.current.x = center.x - anchorWorldX * newZoom;
			viewRef.current.y = center.y - anchorWorldY * newZoom;
			scheduleDraw();
			return;
		}

		// Single finger
		if (mode === "draw") {
			const { x: wx, y: wy } = screenToWorld(sx, sy);
			if (tool === "eraser") {
				eraseAt(wx, wy);
				return;
			}
			const cur = currentStrokeRef.current;
			if (!cur) return;
			// Skip occupied cells — break the stroke around obstacles
			if (occupancyRef.current.isWorldPointOccupied(wx, wy)) {
				if (cur.points.length > 0) {
					// Close current segment, start a fresh stroke when free space hit
					currentStrokeRef.current = {
						tool,
						color,
						size,
						opacity,
						points: [],
					};
				}
				return;
			}
			if (cur.points.length === 0) {
				// First valid point — push fresh stroke onto live list
				cur.points.push(wx, wy);
				liveStrokesRef.current.push(cur);
			} else {
				// Don't append duplicate points if user holds still
				const lx = cur.points[cur.points.length - 2];
				const ly = cur.points[cur.points.length - 1];
				if (Math.hypot(wx - lx, wy - ly) > 1) {
					cur.points.push(wx, wy);
				}
			}
			scheduleDraw();
			return;
		}

		// View mode: drag = pan
		if (tapRef.current && tapRef.current.moved) {
			const dx = sx - tapRef.current.startX;
			const dy = sy - tapRef.current.startY;
			tapRef.current.startX = sx;
			tapRef.current.startY = sy;
			viewRef.current.x += dx;
			viewRef.current.y += dy;
			scheduleDraw();
		}
	};

	const handlePointerUp = (e: React.PointerEvent) => {
		pointersRef.current.delete(e.pointerId);
		if (pointersRef.current.size < 2) gestureRef.current = null;

		const tap = tapRef.current;
		tapRef.current = null;

		// Commit the in-progress stroke
		if (mode === "draw" && currentStrokeRef.current) {
			const s = currentStrokeRef.current;
			currentStrokeRef.current = null;
			if (s.points.length >= 2) {
				onStrokeAdded(s);
			} else {
				// Empty stroke — drop it from live
				liveStrokesRef.current = liveStrokesRef.current.filter(
					(x) => x !== s,
				);
				scheduleDraw();
			}
			return;
		}

		// View-mode tap → check if it landed on a drawing → open detail
		if (
			mode === "view" &&
			tap &&
			!tap.moved &&
			performance.now() - tap.startTime < 350
		) {
			const wrap = wrapRef.current;
			if (!wrap) return;
			const r = wrap.getBoundingClientRect();
			const { x: wx, y: wy } = screenToWorld(
				tap.startX,
				tap.startY,
			);
			const hit = findDrawingAt(existing, wx, wy);
			if (hit) onTapDrawing(hit);
			void r;
		}
	};

	// ─── Eraser ─────────────────────────────────────────────
	//
	// Partial erase via stroke splitting: walk each draft stroke's points,
	// drop those falling inside the eraser circle, and emit one or more
	// sub-strokes for the surviving runs of points. A stroke that crosses
	// the eraser path becomes two strokes; one entirely inside disappears;
	// one untouched passes through.
	//
	// Eraser only operates on the user's own draft (liveStrokesRef);
	// committed drawings in `existing` are untouchable.
	const eraseAt = (wx: number, wy: number) => {
		const r = size;
		const r2 = r * r;
		const live = liveStrokesRef.current;
		let mutated = false;
		const next: Stroke[] = [];

		for (const s of live) {
			const pts = s.points;
			let hadHit = false;
			let cur: number[] = [];
			const flush = () => {
				if (cur.length >= 2) next.push({ ...s, points: cur });
				cur = [];
			};
			for (let i = 0; i < pts.length; i += 2) {
				const dx = pts[i] - wx;
				const dy = pts[i + 1] - wy;
				if (dx * dx + dy * dy > r2) {
					cur.push(pts[i], pts[i + 1]);
				} else {
					hadHit = true;
					flush();
				}
			}
			flush();
			if (!hadHit) {
				// Stroke wasn't touched at all — preserve original reference
				next.pop();
				next.push(s);
			} else {
				mutated = true;
			}
		}

		if (!mutated) return;
		liveStrokesRef.current = next;
		onDraftReplaced(next);
		scheduleDraw();
	};

	// ─── Eraser hover cursor (DOM-mutated, no React re-renders) ─
	const updateEraserCursor = (sx: number, sy: number, visible: boolean) => {
		const el = eraserCursorRef.current;
		if (!el) return;
		const showing = mode === "draw" && tool === "eraser" && visible;
		el.style.display = showing ? "block" : "none";
		if (!showing) return;
		const v = viewRef.current;
		const diameter = size * v.zoom * 2;
		el.style.left = `${sx}px`;
		el.style.top = `${sy}px`;
		el.style.width = `${diameter}px`;
		el.style.height = `${diameter}px`;
	};

	// Hide the indicator whenever the active tool changes away from eraser
	useEffect(() => {
		if (mode !== "draw" || tool !== "eraser") {
			const el = eraserCursorRef.current;
			if (el) el.style.display = "none";
		}
	}, [mode, tool]);

	// ─── Mouse wheel zoom (desktop) ─────────────────────────
	const handleWheel = (e: React.WheelEvent) => {
		e.preventDefault();
		const wrap = wrapRef.current;
		if (!wrap) return;
		const r = wrap.getBoundingClientRect();
		const sx = e.clientX - r.left;
		const sy = e.clientY - r.top;
		const v = viewRef.current;
		const factor = Math.exp(-e.deltaY * 0.0015);
		const newZoom = Math.max(
			ZOOM_MIN,
			Math.min(ZOOM_MAX, v.zoom * factor),
		);
		const wx = (sx - v.x) / v.zoom;
		const wy = (sy - v.y) / v.zoom;
		v.zoom = newZoom;
		v.x = sx - wx * newZoom;
		v.y = sy - wy * newZoom;
		scheduleDraw();
	};

	return (
		<div
			ref={wrapRef}
			className={`cv ${mode === "draw" ? "cv--draw" : "cv--view"} ${
				mode === "draw" && tool === "eraser" ? "cv--erasing" : ""
			}`}
			onPointerDown={handlePointerDown}
			onPointerMove={(e) => {
				handlePointerMove(e);
				// Track eraser cursor when not actively erasing too —
				// shows the user where they would erase before tapping.
				if (mode === "draw" && tool === "eraser") {
					const wrap = wrapRef.current;
					if (wrap) {
						const r = wrap.getBoundingClientRect();
						updateEraserCursor(
							e.clientX - r.left,
							e.clientY - r.top,
							true,
						);
					}
				}
			}}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
			onPointerLeave={() => updateEraserCursor(0, 0, false)}
			onWheel={handleWheel}
		>
			<canvas ref={canvasElRef} />
			<div
				ref={eraserCursorRef}
				className="cv__eraserCursor"
				aria-hidden
			/>
		</div>
	);
}

// ─── Helpers ─────────────────────────────────────────────────

function drawGrid(
	ctx: CanvasRenderingContext2D,
	v: { zoom: number },
): void {
	// Major grid every 256 world px, minor every 32. Hide minor at low zoom.
	ctx.strokeStyle = "rgba(0,0,0,0.04)";
	ctx.lineWidth = 1 / v.zoom;
	const minor = 32;
	const major = 256;
	if (v.zoom > 0.4) {
		ctx.beginPath();
		for (let x = 0; x <= WORLD_W; x += minor) {
			ctx.moveTo(x, 0);
			ctx.lineTo(x, WORLD_H);
		}
		for (let y = 0; y <= WORLD_H; y += minor) {
			ctx.moveTo(0, y);
			ctx.lineTo(WORLD_W, y);
		}
		ctx.stroke();
	}
	ctx.strokeStyle = "rgba(0,0,0,0.09)";
	ctx.lineWidth = 1 / v.zoom;
	ctx.beginPath();
	for (let x = 0; x <= WORLD_W; x += major) {
		ctx.moveTo(x, 0);
		ctx.lineTo(x, WORLD_H);
	}
	for (let y = 0; y <= WORLD_H; y += major) {
		ctx.moveTo(0, y);
		ctx.lineTo(WORLD_W, y);
	}
	ctx.stroke();
}

function strokeIntersectsCircle(
	s: Stroke,
	cx: number,
	cy: number,
	radius: number,
): boolean {
	const r2 = radius * radius;
	const pts = s.points;
	for (let i = 0; i < pts.length; i += 2) {
		const dx = pts[i] - cx;
		const dy = pts[i + 1] - cy;
		if (dx * dx + dy * dy <= r2) return true;
	}
	return false;
}

function findDrawingAt(
	drawings: FeedDrawing[],
	wx: number,
	wy: number,
): FeedDrawing | null {
	// Iterate newest-first (drawings come in DESC order from the API)
	for (const d of drawings) {
		const b = d.bbox;
		// Pad bbox by 16px so taps near edges still register
		if (
			wx < b.x1 - 16 ||
			wy < b.y1 - 16 ||
			wx > b.x2 + 16 ||
			wy > b.y2 + 16
		)
			continue;
		// Refine: any stroke point within ~24px?
		for (const s of d.strokes) {
			const r = Math.max(24, s.size * 1.5);
			if (strokeIntersectsCircle(s, wx, wy, r)) return d;
		}
	}
	return null;
}
