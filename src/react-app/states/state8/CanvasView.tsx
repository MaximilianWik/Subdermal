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
	PIXEL_CELL,
} from "./types";
import { OccupancyGrid } from "./occupancy";
import { BLENDER_PREVIEW_PATH, drawStroke, drawStrokes } from "./render";
import "./CanvasView.css";

// ─────────────────────────────────────────────────────────────
//  CanvasView — the actual world canvas with pan/zoom rendering
//  and drawing input. Imperative API exposed via ref so the
//  parent can drive it (start/finish stroke, undo, etc.).
// ─────────────────────────────────────────────────────────────

// Drawings with more than this many strokes are baked into a
// per-drawing offscreen canvas the first time they render. Smaller
// drawings render live every frame — they're cheap enough that
// caching them just wastes memory.
const STROKE_CACHE_THRESHOLD = 50;

export interface CanvasViewHandle {
	/** Replace the in-progress draft strokes (e.g. for undo/redo). */
	setDraft: (strokes: Stroke[]) => void;
	/** Re-center on the canvas center at zoom 1. */
	resetView: () => void;
	/** Zoom to a level centered on the viewport. */
	setZoom: (z: number) => void;
	/**
	 * If the current zoom is below the draw-mode floor (the zoom computed
	 * by the initial centerView), zoom up to the floor while keeping the
	 * current viewport centre anchored in world space. No-op if already
	 * at or above the floor.
	 */
	snapToDrawFloor: () => void;
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
	onColorPicked?: (hex: string) => void;
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
	onColorPicked,
	canvasRef,
}: Props) {
	const wrapRef = useRef<HTMLDivElement>(null);
	const canvasElRef = useRef<HTMLCanvasElement>(null);
	const eraserCursorRef = useRef<HTMLDivElement>(null);
	const dropperCursorRef = useRef<HTMLDivElement>(null);
	const blenderCursorRef = useRef<HTMLDivElement>(null);
	const brushCursorRef = useRef<HTMLDivElement>(null);

	// View transform: world (wx, wy) -> screen (sx, sy)
	//   sx = wx * zoom + view.x
	//   sy = wy * zoom + view.y
	const viewRef = useRef({ x: 0, y: 0, zoom: 1 });

	// The zoom level produced by centerView() — used as the draw-mode
	// zoom floor so users can't draw while zoomed out past their spawn point.
	const drawZoomFloorRef = useRef(1);

	// Occupancy grid is rebuilt whenever `existing` changes
	const occupancyRef = useRef<OccupancyGrid>(new OccupancyGrid());

	// Per-drawing offscreen bitmap cache. Drawings with more than
	// STROKE_CACHE_THRESHOLD strokes are rasterised once into their
	// own bbox-sized canvas the first time they're rendered, then
	// composited every frame via a single drawImage instead of
	// re-rasterising hundreds of strokes on every pan/zoom.
	const drawingCacheRef = useRef<
		Map<number, { canvas: HTMLCanvasElement; strokesLen: number }>
	>(new Map());

	const getOrBakeDrawing = (d: FeedDrawing): HTMLCanvasElement | null => {
		const cache = drawingCacheRef.current;
		const cached = cache.get(d.id);
		if (cached && cached.strokesLen === d.strokes.length) {
			return cached.canvas;
		}
		const w = Math.max(1, d.bbox.x2 - d.bbox.x1);
		const h = Math.max(1, d.bbox.y2 - d.bbox.y1);
		// Soft cap on per-drawing cache size: if the bbox is enormous
		// (a giant or long thin scribble) fall back to live render to
		// avoid eating hundreds of MB of canvas memory.
		if (w * h > 16_000_000) return null;
		const off = document.createElement("canvas");
		off.width = w;
		off.height = h;
		const oCtx = off.getContext("2d");
		if (!oCtx) return null;
		oCtx.translate(-d.bbox.x1, -d.bbox.y1);
		for (const s of d.strokes) drawStroke(oCtx, s);
		cache.set(d.id, { canvas: off, strokesLen: d.strokes.length });
		return off;
	};

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

	// Right-click drag pan in draw mode (desktop only — button === 2)
	const rightPanRef = useRef<{ lastX: number; lastY: number } | null>(null);

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
		snapToDrawFloor: () => {
			const v = viewRef.current;
			const floor = drawZoomFloorRef.current;
			if (v.zoom >= floor) return; // already at or above floor — no-op
			const cw = wrapRef.current?.clientWidth ?? INITIAL_VIEW_W;
			const ch = wrapRef.current?.clientHeight ?? INITIAL_VIEW_H;
			// Zoom up to floor anchored on viewport centre so the user
			// stays looking at the same world location.
			const wx = (cw / 2 - v.x) / v.zoom;
			const wy = (ch / 2 - v.y) / v.zoom;
			v.zoom = floor;
			v.x = cw / 2 - wx * floor;
			v.y = ch / 2 - wy * floor;
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
		// Drop cache entries for drawings that disappeared (admin
		// hide, edit-in-progress filter, etc.) or whose stroke count
		// changed (someone edited the piece).
		const cache = drawingCacheRef.current;
		const incomingMap = new Map(existing.map((d) => [d.id, d]));
		for (const id of [...cache.keys()]) {
			const incoming = incomingMap.get(id);
			if (!incoming || incoming.strokes.length !== cache.get(id)?.strokesLen) {
				cache.delete(id);
			}
		}
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
		drawZoomFloorRef.current = zoom;
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
		const cw = wrap.clientWidth;
		const ch = wrap.clientHeight;

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

		// Visible world rect (frustum) — used to cull both grid lines
		// and committed drawings that are entirely off-screen.
		const viewLeft = -v.x / v.zoom;
		const viewTop = -v.y / v.zoom;
		const viewRight = (cw - v.x) / v.zoom;
		const viewBottom = (ch - v.y) / v.zoom;

		// Grid background, culled to viewport
		drawGrid(ctx, v, viewLeft, viewTop, viewRight, viewBottom);

		// Existing drawings — cache heavy ones into per-drawing
		// offscreen bitmaps so each redraw is one drawImage call
		// instead of rasterising hundreds of strokes again.
		for (const d of existing) {
			const b = d.bbox;
			if (
				b.x2 < viewLeft ||
				b.x1 > viewRight ||
				b.y2 < viewTop ||
				b.y1 > viewBottom
			) {
				continue;
			}
			if (d.strokes.length > STROKE_CACHE_THRESHOLD) {
				const bake = getOrBakeDrawing(d);
				if (bake) ctx.drawImage(bake, b.x1, b.y1);
				else drawStrokes(ctx, d.strokes);
			} else {
				drawStrokes(ctx, d.strokes);
			}
		}

		// Live (in-progress) strokes on top
		drawStrokes(ctx, liveStrokesRef.current);

		// World boundary
		ctx.lineWidth = 2 / v.zoom;
		ctx.strokeStyle = "rgba(0,0,0,0.18)";
		ctx.strokeRect(0, 0, WORLD_W, WORLD_H);

		// ─── Pixel-snapped pass ──────────────────────────────────
		// Re-render every pixel-tool cell in device space using
		// Math.floor for position and Math.ceil for size so each fill
		// snaps to exact integer device pixels.  This eliminates the
		// sub-pixel anti-aliased gap that appears between the fill edge
		// and the grid-line center when v.x / v.y are non-integer.
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = "source-over";
		const cellDev = Math.ceil(PIXEL_CELL * v.zoom * dpr);
		const renderPixelSnapped = (s: Stroke) => {
			if (s.tool !== "pixel" || s.points.length < 2) return;
			ctx.globalAlpha = s.opacity;
			ctx.fillStyle = s.color;
			for (let i = 0; i + 1 < s.points.length; i += 2) {
				const dx = Math.floor((s.points[i] * v.zoom + v.x) * dpr);
				const dy = Math.floor((s.points[i + 1] * v.zoom + v.y) * dpr);
				ctx.fillRect(dx, dy, cellDev, cellDev);
			}
		};
		for (const d of existing) {
			for (const s of d.strokes) renderPixelSnapped(s);
		}
		for (const s of liveStrokesRef.current) renderPixelSnapped(s);
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
			// Cancel any in-progress single-finger work. Crucially, also
			// remove the orphan stroke that was pushed onto liveStrokesRef
			// when the first finger touched down — otherwise the user sees
			// a phantom dot/line every time they pinch-zoom mid-draw.
			const orphan = currentStrokeRef.current;
			if (orphan) {
				liveStrokesRef.current = liveStrokesRef.current.filter(
					(s) => s !== orphan,
				);
			}
			currentStrokeRef.current = null;
			tapRef.current = null;
			dropperHexRef.current = null;
			const dEl = dropperCursorRef.current;
			if (dEl) dEl.style.display = "none";
			const brEl = brushCursorRef.current;
			if (brEl) brEl.style.display = "none";
			scheduleDraw();
			return;
		}

		// Single-finger
		tapRef.current = {
			startX: sx,
			startY: sy,
			startTime: performance.now(),
			moved: false,
		};

		// Right-click in draw mode → pan only, no stroke
		if (e.button === 2 && mode === "draw") {
			rightPanRef.current = { lastX: sx, lastY: sy };
			wrapRef.current?.classList.add("cv--panning");
			return;
		}

		if (mode === "draw") {
			const { x: wx, y: wy } = screenToWorld(sx, sy);
			if (tool === "eraser") {
				// Eraser at this point — find any draft strokes within radius and remove
				eraseAt(wx, wy);
				return;
			}
			if (tool === "eyedropper") {
				// Sample but don't commit yet — commit happens on pointer up
				// so users can drag to fine-tune the pick before lifting.
				updateDropperCursor(sx, sy, true);
				return;
			}
			if (tool === "pixel") {
				// Snap to PIXEL_CELL grid and seed a single-cell stroke.
				const cellX = Math.floor(wx / PIXEL_CELL) * PIXEL_CELL;
				const cellY = Math.floor(wy / PIXEL_CELL) * PIXEL_CELL;
				const inBounds =
					cellX >= 0 &&
					cellY >= 0 &&
					cellX < WORLD_W &&
					cellY < WORLD_H;
				const cx = cellX + PIXEL_CELL / 2;
				const cy = cellY + PIXEL_CELL / 2;
				const blocked =
					!inBounds ||
					occupancyRef.current.isWorldPointOccupied(cx, cy);
				currentStrokeRef.current = {
					tool,
					color,
					size: PIXEL_CELL,
					opacity,
					points: blocked ? [] : [cellX, cellY],
				};
				if (!blocked) {
					liveStrokesRef.current.push(currentStrokeRef.current);
				}
				scheduleDraw();
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
					...(tool === "blender" ? { pointColors: [] } : {}),
				};
			} else {
				const seedColor =
					tool === "blender" ? samplePixelInt(sx, sy) : -1;
				currentStrokeRef.current = {
					tool,
					color,
					size,
					opacity,
					points: [wx, wy],
					...(tool === "blender" ? { pointColors: [seedColor] } : {}),
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
			const zoomFloor = mode === "draw" ? drawZoomFloorRef.current : ZOOM_MIN;
			const newZoom = Math.max(
				zoomFloor,
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

		// Right-click pan (draw mode, desktop)
		if (rightPanRef.current) {
			const dx = sx - rightPanRef.current.lastX;
			const dy = sy - rightPanRef.current.lastY;
			rightPanRef.current.lastX = sx;
			rightPanRef.current.lastY = sy;
			viewRef.current.x += dx;
			viewRef.current.y += dy;
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
			if (tool === "eyedropper") {
				updateDropperCursor(sx, sy, true);
				return;
			}
			const cur = currentStrokeRef.current;
			if (!cur) return;

			if (tool === "pixel") {
				// Snap to grid; skip when the dragged finger is in the
				// same cell as the last placed pixel; skip cells that
				// collide with existing drawings; skip out-of-bounds.
				const cellX = Math.floor(wx / PIXEL_CELL) * PIXEL_CELL;
				const cellY = Math.floor(wy / PIXEL_CELL) * PIXEL_CELL;
				if (
					cellX < 0 ||
					cellY < 0 ||
					cellX >= WORLD_W ||
					cellY >= WORLD_H
				) {
					return;
				}
				const len = cur.points.length;
				if (
					len >= 2 &&
					cur.points[len - 2] === cellX &&
					cur.points[len - 1] === cellY
				) {
					return; // same cell as last point
				}
				const cx = cellX + PIXEL_CELL / 2;
				const cy = cellY + PIXEL_CELL / 2;
				if (occupancyRef.current.isWorldPointOccupied(cx, cy)) {
					return;
				}
				if (cur.points.length === 0) {
					cur.points.push(cellX, cellY);
					liveStrokesRef.current.push(cur);
				} else {
					cur.points.push(cellX, cellY);
				}
				scheduleDraw();
				return;
			}

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
						...(tool === "blender" ? { pointColors: [] } : {}),
					};
				}
				return;
			}
			if (cur.points.length === 0) {
				// First valid point — push fresh stroke onto live list
				cur.points.push(wx, wy);
				if (tool === "blender") {
					(cur.pointColors ??= []).push(samplePixelInt(sx, sy));
				}
				liveStrokesRef.current.push(cur);
			} else {
				// Don't append duplicate points if user holds still
				const lx = cur.points[cur.points.length - 2];
				const ly = cur.points[cur.points.length - 1];
				if (Math.hypot(wx - lx, wy - ly) > 1) {
					cur.points.push(wx, wy);
					if (tool === "blender") {
						(cur.pointColors ??= []).push(samplePixelInt(sx, sy));
					}
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

		// End right-click pan
		if (e.button === 2) {
			rightPanRef.current = null;
			tapRef.current = null;
			wrapRef.current?.classList.remove("cv--panning");
			return;
		}

		const tap = tapRef.current;
		tapRef.current = null;

		// Commit the eyedropper pick on lift
		if (mode === "draw" && tool === "eyedropper") {
			const hex = dropperHexRef.current;
			dropperHexRef.current = null;
			const el = dropperCursorRef.current;
			if (el) el.style.display = "none";
			if (hex && onColorPicked) onColorPicked(hex);
			return;
		}

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
		const live = liveStrokesRef.current;
		let mutated = false;
		const next: Stroke[] = [];

		for (const s of live) {
			const pts = s.points;
			const colors = s.pointColors;

			// Account for the stroke's visible footprint, not just its
			// stored sample points. For pixel cells the sample point is
			// the cell's top-left, and the cell extends PIXEL_CELL in
			// both directions — use the cell centre and half-diagonal
			// so the eraser hits anywhere visible inside the cell.
			let strokeR: number;
			let centerOffset: number;
			if (s.tool === "pixel") {
				strokeR = PIXEL_CELL * 0.7071; // half-diagonal ≈ 22.6
				centerOffset = PIXEL_CELL / 2;
			} else {
				strokeR = Math.max(0.5, s.size / 2);
				centerOffset = 0;
			}
			const effR = r + strokeR;
			const effR2 = effR * effR;

			let hadHit = false;
			let pushedAny = false;
			let curPts: number[] = [];
			let curCols: number[] = [];

			const flush = () => {
				if (curPts.length >= 2) {
					const sub: Stroke = { ...s, points: curPts };
					// Keep pointColors in sync with the sliced points so
					// blender strokes still render correctly after a split.
					if (colors) sub.pointColors = curCols;
					next.push(sub);
					pushedAny = true;
				}
				curPts = [];
				curCols = [];
			};

			for (let i = 0; i < pts.length; i += 2) {
				const cx = pts[i] + centerOffset;
				const cy = pts[i + 1] + centerOffset;
				const dx = cx - wx;
				const dy = cy - wy;
				if (dx * dx + dy * dy > effR2) {
					curPts.push(pts[i], pts[i + 1]);
					if (colors) curCols.push(colors[i >> 1]);
				} else {
					hadHit = true;
					flush();
				}
			}
			flush();

			if (!hadHit) {
				// Stroke wasn't touched at all — restore the original
				// reference so React can shallow-compare cheaply.
				if (pushedAny) next.pop();
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

	// ─── Eyedropper ─────────────────────────────────────────
	//
	// Samples a single pixel under the cursor in canvas-backing-store
	// coords (independent of the current pan/zoom transform), and
	// returns it as #RRGGBB. Returns null if the point is outside the
	// canvas or the pixel is fully transparent.
	const dropperHexRef = useRef<string | null>(null);

	const samplePixelHex = (sx: number, sy: number): string | null => {
		const canvas = canvasElRef.current;
		if (!canvas) return null;
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;
		const dpr = window.devicePixelRatio || 1;
		const px = Math.floor(sx * dpr);
		const py = Math.floor(sy * dpr);
		if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) {
			return null;
		}
		try {
			const data = ctx.getImageData(px, py, 1, 1).data;
			const r = data[0];
			const g = data[1];
			const b = data[2];
			const a = data[3];
			if (a === 0) return null;
			return (
				"#" +
				((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")
			);
		} catch {
			return null;
		}
	};

	// Same sampler, returns the colour as a packed 0xRRGGBB integer
	// (or -1 sentinel on failure). Used by the blender brush which
	// stores per-point sampled colours in stroke.pointColors.
	const samplePixelInt = (sx: number, sy: number): number => {
		const hex = samplePixelHex(sx, sy);
		if (!hex) return -1;
		return parseInt(hex.slice(1), 16);
	};

	const updateDropperCursor = (
		sx: number,
		sy: number,
		visible: boolean,
	) => {
		const el = dropperCursorRef.current;
		if (!el) return;
		const showing = mode === "draw" && tool === "eyedropper" && visible;
		if (!showing) {
			el.style.display = "none";
			return;
		}
		const hex = samplePixelHex(sx, sy);
		if (!hex) {
			el.style.display = "none";
			return;
		}
		dropperHexRef.current = hex;
		el.style.display = "block";
		el.style.left = sx + "px";
		el.style.top = sy + "px";
		el.style.setProperty("--c", hex);
	};

	// Hide preview whenever the active tool changes away from eyedropper
	useEffect(() => {
		if (mode !== "draw" || tool !== "eyedropper") {
			const el = dropperCursorRef.current;
			if (el) el.style.display = "none";
			dropperHexRef.current = null;
		}
	}, [mode, tool]);

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

	// ─── Blender hover cursor ───────────────────────────────
	// Same pattern as the eraser preview: a circle the size of the
	// brush radius that follows the pointer, so the user can see
	// where the cloud-shaped stamps are about to land.
	const updateBlenderCursor = (
		sx: number,
		sy: number,
		visible: boolean,
	) => {
		const el = blenderCursorRef.current;
		if (!el) return;
		const showing = mode === "draw" && tool === "blender" && visible;
		el.style.display = showing ? "block" : "none";
		if (!showing) return;
		const v = viewRef.current;
		const diameter = size * v.zoom * 2;
		el.style.left = `${sx}px`;
		el.style.top = `${sy}px`;
		el.style.width = `${diameter}px`;
		el.style.height = `${diameter}px`;
	};

	useEffect(() => {
		if (mode !== "draw" || tool !== "blender") {
			const el = blenderCursorRef.current;
			if (el) el.style.display = "none";
		}
	}, [mode, tool]);

	// ─── Brush hover cursor ─────────────────────────────────
	// Generic preview that adapts to the active brush so the user can
	// see the actual footprint before they tap. One DOM element with a
	// className modifier per tool — circles for pen/watercolor/airbrush
	// at each renderer's real diameter, an angled chisel for calligraphy
	// matching tipAngle = 45°, and a grid-snapped square for pixel-art.
	const updateBrushCursor = (
		sx: number,
		sy: number,
		visible: boolean,
	) => {
		const el = brushCursorRef.current;
		if (!el) return;
		const isBrushPreview =
			tool === "pen" ||
			tool === "watercolor" ||
			tool === "airbrush" ||
			tool === "calligraphy" ||
			tool === "pixel";
		const showing = mode === "draw" && visible && isBrushPreview;
		if (!showing) {
			el.style.display = "none";
			return;
		}
		el.style.display = "block";
		el.className = `cv__brushCursor cv__brushCursor--${tool}`;
		const v = viewRef.current;

		if (tool === "pixel") {
			// Snap to the minor-grid cell the pointer is in and place a
			// square at that cell's top-left in screen coords. No
			// translate(-50%,-50%) — the square IS the cell, not centred
			// on the pointer.
			const wx = (sx - v.x) / v.zoom;
			const wy = (sy - v.y) / v.zoom;
			const cellWX = Math.floor(wx / PIXEL_CELL) * PIXEL_CELL;
			const cellWY = Math.floor(wy / PIXEL_CELL) * PIXEL_CELL;
			const screenX = cellWX * v.zoom + v.x;
			const screenY = cellWY * v.zoom + v.y;
			const cellPx = PIXEL_CELL * v.zoom;
			el.style.transform = "none";
			el.style.left = `${screenX}px`;
			el.style.top = `${screenY}px`;
			el.style.width = `${cellPx}px`;
			el.style.height = `${cellPx}px`;
			return;
		}

		if (tool === "calligraphy") {
			// Chisel rectangle, long axis perpendicular to renderer's
			// tipAngle (= 45°). Width matches the maximum quad width
			// renderCalligraphy can produce; height is a thin tip.
			const w = size * 1.15 * v.zoom;
			const h = Math.max(2, size * 0.32 * v.zoom);
			el.style.transform = "translate(-50%, -50%) rotate(-45deg)";
			el.style.left = `${sx}px`;
			el.style.top = `${sy}px`;
			el.style.width = `${w}px`;
			el.style.height = `${h}px`;
			return;
		}

		// Circle previews — diameter matches each renderer's footprint:
		//   pen        : ctx.lineWidth = s.size            → diameter = size
		//   watercolor : lineWidth = s.size * 1.4          → diameter = size * 1.4
		//   airbrush   : ctx.arc(..., s.size, ...)         → diameter = size * 2
		let mul = 1;
		if (tool === "watercolor") mul = 1.4;
		else if (tool === "airbrush") mul = 2;
		const diameter = size * v.zoom * mul;
		el.style.transform = "translate(-50%, -50%)";
		el.style.left = `${sx}px`;
		el.style.top = `${sy}px`;
		el.style.width = `${diameter}px`;
		el.style.height = `${diameter}px`;
	};

	useEffect(() => {
		const showsBrushCursor =
			mode === "draw" &&
			(tool === "pen" ||
				tool === "watercolor" ||
				tool === "airbrush" ||
				tool === "calligraphy" ||
				tool === "pixel");
		if (!showsBrushCursor) {
			const el = brushCursorRef.current;
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
		const zoomFloor = mode === "draw" ? drawZoomFloorRef.current : ZOOM_MIN;
		const newZoom = Math.max(
			zoomFloor,
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
			onContextMenu={(e) => { if (mode === "draw") e.preventDefault(); }}
			onPointerMove={(e) => {
				handlePointerMove(e);
				const wrap = wrapRef.current;
				if (!wrap) return;
				const r = wrap.getBoundingClientRect();
				const sx = e.clientX - r.left;
				const sy = e.clientY - r.top;
				// Track eraser cursor when not actively erasing too —
				// shows the user where they would erase before tapping.
				if (mode === "draw" && tool === "eraser") {
					updateEraserCursor(sx, sy, true);
				}
				// Show eyedropper hover preview before commit too.
				if (mode === "draw" && tool === "eyedropper") {
					updateDropperCursor(sx, sy, true);
				}
				// Show blender hover preview so the brush size is visible.
				if (mode === "draw" && tool === "blender") {
					updateBlenderCursor(sx, sy, true);
				}
				// Show generic brush preview for the remaining shape-bearing tools.
				updateBrushCursor(sx, sy, true);
			}}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
			onPointerLeave={() => {
				rightPanRef.current = null;
				wrapRef.current?.classList.remove("cv--panning");
				updateEraserCursor(0, 0, false);
				const dEl = dropperCursorRef.current;
				if (dEl) dEl.style.display = "none";
				const bEl = blenderCursorRef.current;
				if (bEl) bEl.style.display = "none";
				const brEl = brushCursorRef.current;
				if (brEl) brEl.style.display = "none";
			}}
			onWheel={handleWheel}
		>
			<canvas ref={canvasElRef} />
			<div
				ref={eraserCursorRef}
				className="cv__eraserCursor"
				aria-hidden
			/>
			<div
				ref={dropperCursorRef}
				className="cv__dropperCursor"
				aria-hidden
			/>
			<div
				ref={blenderCursorRef}
				className="cv__blenderCursor"
				aria-hidden
			>
				<svg
					className="cv__blenderCursor__svg"
					viewBox="-1 -1 2 2"
					preserveAspectRatio="none"
				>
					<path d={BLENDER_PREVIEW_PATH} />
				</svg>
			</div>
			<div
				ref={brushCursorRef}
				className="cv__brushCursor"
				aria-hidden
			/>
		</div>
	);
}

// ─── Helpers ─────────────────────────────────────────────────

function drawGrid(
	ctx: CanvasRenderingContext2D,
	v: { zoom: number },
	viewLeft: number,
	viewTop: number,
	viewRight: number,
	viewBottom: number,
): void {
	// Major grid every 256 world px, minor every 32. Both are culled
	// to the visible viewport so we never iterate the full world span
	// at zoom-in (was 1444 line segments per frame regardless of view).
	const minor = 32;
	const major = 256;

	// Clamp the iteration range to the world bounds so the grid
	// doesn't spill into negative space or past WORLD_W/H.
	const clampL = Math.max(0, viewLeft);
	const clampR = Math.min(WORLD_W, viewRight);
	const clampT = Math.max(0, viewTop);
	const clampB = Math.min(WORLD_H, viewBottom);

	ctx.strokeStyle = "rgba(0,0,0,0.04)";
	ctx.lineWidth = 1 / v.zoom;
	if (v.zoom > 0.4) {
		ctx.beginPath();
		const xStart = Math.floor(clampL / minor) * minor;
		const xEnd = Math.ceil(clampR / minor) * minor;
		for (let x = xStart; x <= xEnd; x += minor) {
			ctx.moveTo(x, clampT);
			ctx.lineTo(x, clampB);
		}
		const yStart = Math.floor(clampT / minor) * minor;
		const yEnd = Math.ceil(clampB / minor) * minor;
		for (let y = yStart; y <= yEnd; y += minor) {
			ctx.moveTo(clampL, y);
			ctx.lineTo(clampR, y);
		}
		ctx.stroke();
	}

	ctx.strokeStyle = "rgba(0,0,0,0.09)";
	ctx.lineWidth = 1 / v.zoom;
	ctx.beginPath();
	const mxStart = Math.floor(clampL / major) * major;
	const mxEnd = Math.ceil(clampR / major) * major;
	for (let x = mxStart; x <= mxEnd; x += major) {
		ctx.moveTo(x, clampT);
		ctx.lineTo(x, clampB);
	}
	const myStart = Math.floor(clampT / major) * major;
	const myEnd = Math.ceil(clampB / major) * major;
	for (let y = myStart; y <= myEnd; y += major) {
		ctx.moveTo(clampL, y);
		ctx.lineTo(clampR, y);
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
