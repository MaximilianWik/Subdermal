import type { Stroke, ToolType } from "./types";
import { PIXEL_CELL } from "./types";

// ─────────────────────────────────────────────────────────────
//  Stroke rendering — 10 brush types, each visually distinct.
//
//  Coordinates are WORLD pixels. The caller is expected to have
//  already applied the pan/zoom transform to the canvas context.
//
//  All randomness is deterministic per stroke (seeded from the
//  first point), so replays look identical to the live draw.
// ─────────────────────────────────────────────────────────────

/**
 * Render a single stroke. Pass `partial` to render only the first N points
 * (used by replay animation and by the live "ink" preview while drawing).
 */
export function drawStroke(
	ctx: CanvasRenderingContext2D,
	stroke: Stroke,
	partial?: number,
): void {
	const { tool, points } = stroke;
	if (points.length < 2) return;

	const limit =
		partial !== undefined
			? Math.min(points.length, partial * 2)
			: points.length;
	if (limit < 2) return;

	ctx.save();

	switch (tool) {
		case "pen":
			renderPen(ctx, stroke, limit);
			break;
		case "pencil":
			renderPencil(ctx, stroke, limit);
			break;
		case "marker":
			renderMarker(ctx, stroke, limit);
			break;
		case "brush":
			renderBrush(ctx, stroke, limit);
			break;
		case "charcoal":
			renderCharcoal(ctx, stroke, limit);
			break;
		case "watercolor":
			renderWatercolor(ctx, stroke, limit);
			break;
		case "calligraphy":
			renderCalligraphy(ctx, stroke, limit);
			break;
		case "spray":
			renderSpray(ctx, stroke, limit);
			break;
		case "airbrush":
			renderAirbrush(ctx, stroke, limit);
			break;
		case "pixel":
			renderPixel(ctx, stroke, limit);
			break;
		case "eyedropper":
			// Eyedropper never produces strokes — sampling happens
			// inline in CanvasView's pointer handler.
			break;
		case "eraser":
			// Never rendered — eraser strokes mutate the user's draft array
			// directly via stroke splitting; nothing to draw on canvas.
			break;
	}

	ctx.restore();
}

// ─── Helpers ─────────────────────────────────────────────────

function drawPath(
	ctx: CanvasRenderingContext2D,
	pts: number[],
	limit: number,
): void {
	ctx.beginPath();
	ctx.moveTo(pts[0], pts[1]);
	if (limit === 2) {
		ctx.lineTo(pts[0] + 0.01, pts[1] + 0.01);
		return;
	}
	for (let i = 2; i < limit; i += 2) {
		ctx.lineTo(pts[i], pts[i + 1]);
	}
}

/** Deterministic LCG seeded from the first point of a stroke. */
function seededRand(pts: number[]): () => number {
	let s = (((pts[0] | 0) * 73856093) ^ ((pts[1] | 0) * 19349663)) >>> 0;
	if (s === 0) s = 1;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0xffffffff;
	};
}

// ─── 1. Pen — clean, hard-edged ink line ────────────────────
function renderPen(
	ctx: CanvasRenderingContext2D,
	s: Stroke,
	limit: number,
): void {
	ctx.globalCompositeOperation = "source-over";
	ctx.globalAlpha = s.opacity;
	ctx.strokeStyle = s.color;
	ctx.lineWidth = s.size;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	drawPath(ctx, s.points, limit);
	ctx.stroke();
}

// ─── 2. Pencil — scratchy graphite, jittered + grainy ───────
function renderPencil(
	ctx: CanvasRenderingContext2D,
	s: Stroke,
	limit: number,
): void {
	const pts = s.points;
	const rand = seededRand(pts);
	ctx.globalCompositeOperation = "source-over";
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.strokeStyle = s.color;

	// Main line — slightly broken-up (segment-by-segment with jittered offsets)
	ctx.globalAlpha = s.opacity * 0.6;
	ctx.lineWidth = s.size * 0.85;
	for (let i = 0; i < limit - 2; i += 2) {
		const jx = (rand() - 0.5) * s.size * 0.25;
		const jy = (rand() - 0.5) * s.size * 0.25;
		ctx.beginPath();
		ctx.moveTo(pts[i] + jx, pts[i + 1] + jy);
		ctx.lineTo(pts[i + 2] + jx * 0.5, pts[i + 3] + jy * 0.5);
		ctx.stroke();
	}

	// Grain — scattered short dashes near the path for that sketchy feel
	ctx.globalAlpha = s.opacity * 0.35;
	ctx.lineWidth = s.size * 0.35;
	for (let i = 0; i < limit; i += 2) {
		if (rand() > 0.55) continue;
		const ox = (rand() - 0.5) * s.size * 1.4;
		const oy = (rand() - 0.5) * s.size * 1.4;
		ctx.beginPath();
		ctx.moveTo(pts[i] + ox, pts[i + 1] + oy);
		ctx.lineTo(pts[i] + ox + (rand() - 0.5) * s.size, pts[i + 1] + oy);
		ctx.stroke();
	}
}

// ─── 3. Marker — chunky, multiply-blended ───────────────────
function renderMarker(
	ctx: CanvasRenderingContext2D,
	s: Stroke,
	limit: number,
): void {
	// "multiply" makes overlaps darken naturally — the killer marker feel
	ctx.globalCompositeOperation = "multiply";
	ctx.globalAlpha = s.opacity * 0.55;
	ctx.strokeStyle = s.color;
	ctx.lineWidth = s.size * 1.4;
	ctx.lineCap = "square"; // chunky corners distinct from pen's round
	ctx.lineJoin = "miter";
	ctx.miterLimit = 4;
	drawPath(ctx, s.points, limit);
	ctx.stroke();
}

// ─── 4. Brush — wet ink with halo ───────────────────────────
function renderBrush(
	ctx: CanvasRenderingContext2D,
	s: Stroke,
	limit: number,
): void {
	ctx.globalCompositeOperation = "source-over";
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.strokeStyle = s.color;
	// Outer wet halo
	ctx.globalAlpha = s.opacity * 0.18;
	ctx.lineWidth = s.size * 1.9;
	drawPath(ctx, s.points, limit);
	ctx.stroke();
	// Mid pass
	ctx.globalAlpha = s.opacity * 0.4;
	ctx.lineWidth = s.size * 1.3;
	drawPath(ctx, s.points, limit);
	ctx.stroke();
	// Core
	ctx.globalAlpha = s.opacity;
	ctx.lineWidth = s.size;
	drawPath(ctx, s.points, limit);
	ctx.stroke();
}

// ─── 5. Charcoal — heavy textured grain ─────────────────────
function renderCharcoal(
	ctx: CanvasRenderingContext2D,
	s: Stroke,
	limit: number,
): void {
	const pts = s.points;
	const rand = seededRand(pts);
	ctx.globalCompositeOperation = "source-over";
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.strokeStyle = s.color;

	// Base pass — soft, low alpha
	ctx.globalAlpha = s.opacity * 0.55;
	ctx.lineWidth = s.size;
	drawPath(ctx, s.points, limit);
	ctx.stroke();

	// Multiple jittered passes for the grainy, dusty texture
	for (let pass = 0; pass < 3; pass++) {
		ctx.globalAlpha = s.opacity * 0.18;
		ctx.lineWidth = s.size * (0.4 + rand() * 0.3);
		ctx.beginPath();
		const ox = (rand() - 0.5) * s.size * 0.6;
		const oy = (rand() - 0.5) * s.size * 0.6;
		ctx.moveTo(pts[0] + ox, pts[1] + oy);
		for (let i = 2; i < limit; i += 2) {
			ctx.lineTo(pts[i] + ox * (rand() * 0.6 + 0.7), pts[i + 1] + oy * (rand() * 0.6 + 0.7));
		}
		ctx.stroke();
	}

	// Scatter dust
	ctx.fillStyle = s.color;
	ctx.globalAlpha = s.opacity * 0.4;
	for (let i = 0; i < limit; i += 2) {
		const dust = Math.max(3, Math.round(s.size * 0.3));
		for (let j = 0; j < dust; j++) {
			const ang = rand() * Math.PI * 2;
			const r = Math.sqrt(rand()) * s.size * 0.8;
			ctx.fillRect(
				pts[i] + Math.cos(ang) * r,
				pts[i + 1] + Math.sin(ang) * r,
				1,
				1,
			);
		}
	}
}

// ─── 6. Watercolor — soft, blurred, builds up on overlap ────
function renderWatercolor(
	ctx: CanvasRenderingContext2D,
	s: Stroke,
	limit: number,
): void {
	ctx.globalCompositeOperation = "source-over";
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.strokeStyle = s.color;
	// Heavy blur via shadowBlur — gives the wet-paper diffusion look
	ctx.shadowColor = s.color;
	ctx.shadowBlur = s.size * 1.4;

	// Wide soft pass
	ctx.globalAlpha = s.opacity * 0.12;
	ctx.lineWidth = s.size * 1.4;
	drawPath(ctx, s.points, limit);
	ctx.stroke();

	// Slightly tighter pass on top — lets pigment "pool" along the stroke center
	ctx.shadowBlur = s.size * 0.6;
	ctx.globalAlpha = s.opacity * 0.18;
	ctx.lineWidth = s.size * 0.85;
	drawPath(ctx, s.points, limit);
	ctx.stroke();
}

// ─── 7. Calligraphy — width modulated by stroke direction ───
function renderCalligraphy(
	ctx: CanvasRenderingContext2D,
	s: Stroke,
	limit: number,
): void {
	const pts = s.points;
	ctx.globalCompositeOperation = "source-over";
	ctx.globalAlpha = s.opacity;
	ctx.fillStyle = s.color;
	ctx.strokeStyle = s.color;

	// Pen tip angle — wider on diagonals matching this angle, thin on perpendicular
	const tipAngle = Math.PI / 4; // 45° (NW–SE) like a classic chisel nib

	for (let i = 0; i < limit - 2; i += 2) {
		const dx = pts[i + 2] - pts[i];
		const dy = pts[i + 3] - pts[i + 1];
		const len = Math.hypot(dx, dy);
		if (len === 0) continue;
		const ang = Math.atan2(dy, dx);
		const widthFactor = Math.abs(Math.sin(ang - tipAngle)); // 0..1
		const w = s.size * (0.2 + widthFactor * 0.95);

		// Render the segment as a quad oriented perpendicular to the tip
		const nx = -Math.sin(tipAngle);
		const ny = Math.cos(tipAngle);
		ctx.beginPath();
		ctx.moveTo(pts[i] + (nx * w) / 2, pts[i + 1] + (ny * w) / 2);
		ctx.lineTo(pts[i + 2] + (nx * w) / 2, pts[i + 3] + (ny * w) / 2);
		ctx.lineTo(pts[i + 2] - (nx * w) / 2, pts[i + 3] - (ny * w) / 2);
		ctx.lineTo(pts[i] - (nx * w) / 2, pts[i + 1] - (ny * w) / 2);
		ctx.closePath();
		ctx.fill();
	}
}

// ─── 8. Spray — scattered dots within radius ────────────────
function renderSpray(
	ctx: CanvasRenderingContext2D,
	s: Stroke,
	limit: number,
): void {
	const pts = s.points;
	const rand = seededRand(pts);
	ctx.globalCompositeOperation = "source-over";
	ctx.globalAlpha = s.opacity * 0.45;
	ctx.fillStyle = s.color;
	for (let i = 0; i < limit; i += 2) {
		const density = Math.max(8, Math.min(50, Math.round(s.size * 1.0)));
		for (let j = 0; j < density; j++) {
			const ang = rand() * Math.PI * 2;
			const r = Math.sqrt(rand()) * s.size;
			ctx.fillRect(
				pts[i] + Math.cos(ang) * r - 0.5,
				pts[i + 1] + Math.sin(ang) * r - 0.5,
				1.5,
				1.5,
			);
		}
	}
}

// ─── 9. Airbrush — smooth radial gradient buildup ───────────
function renderAirbrush(
	ctx: CanvasRenderingContext2D,
	s: Stroke,
	limit: number,
): void {
	const pts = s.points;
	ctx.globalCompositeOperation = "source-over";
	for (let i = 0; i < limit; i += 2) {
		const grad = ctx.createRadialGradient(
			pts[i],
			pts[i + 1],
			0,
			pts[i],
			pts[i + 1],
			s.size,
		);
		grad.addColorStop(0, hexWithAlpha(s.color, s.opacity * 0.18));
		grad.addColorStop(1, hexWithAlpha(s.color, 0));
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.arc(pts[i], pts[i + 1], s.size, 0, Math.PI * 2);
		ctx.fill();
	}
}

function hexWithAlpha(hex: string, alpha: number): string {
	// hex is #RRGGBB, alpha 0..1
	const a = Math.max(0, Math.min(255, Math.round(alpha * 255)))
		.toString(16)
		.padStart(2, "0");
	return `${hex}${a}`;
}

// ─── 10. Pixel — fills exactly one minor-grid cell per point ──
//
// Each point in the stroke is the TOP-LEFT corner of a snapped
// PIXEL_CELL×PIXEL_CELL square, in world coords. No anti-aliasing,
// no overlap between adjacent cells (origins are 32-px aligned).
function renderPixel(
	ctx: CanvasRenderingContext2D,
	s: Stroke,
	limit: number,
): void {
	ctx.globalCompositeOperation = "source-over";
	ctx.globalAlpha = s.opacity;
	ctx.fillStyle = s.color;
	for (let i = 0; i < limit; i += 2) {
		ctx.fillRect(s.points[i], s.points[i + 1], PIXEL_CELL, PIXEL_CELL);
	}
}

// ─── Bulk renderers ──────────────────────────────────────────

export function totalPoints(strokes: Stroke[]): number {
	let n = 0;
	for (const s of strokes) n += s.points.length / 2;
	return n;
}

export function drawStrokesProgressive(
	ctx: CanvasRenderingContext2D,
	strokes: Stroke[],
	pointBudget: number,
): void {
	let remaining = pointBudget;
	for (const s of strokes) {
		if (remaining <= 0) break;
		const strokePoints = s.points.length / 2;
		if (remaining >= strokePoints) {
			drawStroke(ctx, s);
			remaining -= strokePoints;
		} else {
			drawStroke(ctx, s, remaining);
			remaining = 0;
		}
	}
}

export function drawStrokes(
	ctx: CanvasRenderingContext2D,
	strokes: Stroke[],
): void {
	for (const s of strokes) drawStroke(ctx, s);
}

export const TOOL_LIST: ToolType[] = [
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
	"eraser",
];
