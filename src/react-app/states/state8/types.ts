// ─────────────────────────────────────────────────────────────
//  State 8 shared types + world constants.
// ─────────────────────────────────────────────────────────────

export type ToolType =
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
	| "blender"
	| "eyedropper"
	| "eraser";

/** A single brush gesture. Coordinates are in WORLD space (not screen). */
export interface Stroke {
	tool: ToolType;
	color: string; // #RRGGBB
	size: number; // px in world coords
	opacity: number; // 0..1
	/** Flat interleaved [x0, y0, x1, y1, ...] for compactness. */
	points: number[];
	/**
	 * Optional per-point colors as packed 0xRRGGBB ints. Length must
	 * equal points.length / 2. Used by the blender brush, which samples
	 * the canvas at each step and stores the colour rather than using
	 * the brush's `color`. Other tools ignore this field.
	 */
	pointColors?: number[];
}

export interface Bbox {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

/** Drawing as it comes from the gallery feed (lighter — no IP/UA). */
export interface FeedDrawing {
	id: number;
	created_at: number;
	name: string | null;
	country: string | null;
	city: string | null;
	region: string | null;
	likes: number;
	bbox: Bbox;
	strokes: Stroke[];
	instagram_handle: string | null;
}

/** Drawing as it comes from /api/drawings/:id — full metadata. */
export interface FullDrawing extends FeedDrawing {
	ip: string | null;
	user_agent: string | null;
	accept_language: string | null;
	colo: string | null;
	postal_code: string | null;
	timezone: string | null;
	viewport_w: number | null;
	viewport_h: number | null;
	device_pixel_ratio: number | null;
	draw_time_ms: number | null;
	canvas_width: number | null;
	canvas_height: number | null;
	hidden: number;
}

// World canvas dimensions. Coordinates of all strokes are absolute world px.
// We never instantiate a HTMLCanvasElement at this size — we render to a
// viewport-sized canvas with a pan/zoom transform applied.
export const WORLD_W = 16384;
export const WORLD_H = 24576;

// Initial viewport size shown at zoom = 1 (in world px)
export const INITIAL_VIEW_W = 1024;
export const INITIAL_VIEW_H = 1536;

// Brush size limits (in world px at zoom 1)
export const BRUSH_SIZE_MIN = 1;
export const BRUSH_SIZE_MAX = 50;
export const ERASER_SIZE_MIN = 4;
export const ERASER_SIZE_MAX = 50;

// Pixel art cell size — must match the minor grid spacing in
// CanvasView's drawGrid so each filled pixel sits exactly inside
// one of the visible small grid squares.
export const PIXEL_CELL = 32;

// Occupancy grid cell size — coarser = faster but blockier collision.
// At 16px cells, a 16384×24576 world is 1024×1536 = 1.57M cells = 196 KB.
export const OCCUPANCY_CELL = 16;
export const OCCUPANCY_W = Math.ceil(WORLD_W / OCCUPANCY_CELL);
export const OCCUPANCY_H = Math.ceil(WORLD_H / OCCUPANCY_CELL);

// Min/max zoom levels — min lets you see the whole canvas, max for detail work
export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 8;

export const DRAFT_KEY = "state8.draft.v1";
