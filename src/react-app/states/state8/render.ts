import type { Stroke, ToolType } from "./types";

// ─────────────────────────────────────────────────────────────
//  Stroke rendering.
//
//  Each tool maps to a different combination of:
//    - line cap / line join
//    - composite mode
//    - opacity
//    - texture (extra dots / scatter for spray, jitter for pencil)
//
//  All rendering is done in WORLD coordinates — the caller is
//  expected to have already applied the pan/zoom transform to
//  the canvas context.
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
	const { tool, color, size, opacity, points } = stroke;
	if (points.length < 2) return;

	const limit =
		partial !== undefined
			? Math.min(points.length, partial * 2)
			: points.length;
	if (limit < 2) return;

	ctx.save();

	switch (tool) {
		case "pen":
			ctx.globalCompositeOperation = "source-over";
			ctx.globalAlpha = opacity;
			ctx.strokeStyle = color;
			ctx.lineWidth = size;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			drawPath(ctx, points, limit);
			ctx.stroke();
			break;

		case "pencil":
			// Hard-edge, full opacity, slightly textured by varying width
			ctx.globalCompositeOperation = "source-over";
			ctx.globalAlpha = opacity * 0.95;
			ctx.strokeStyle = color;
			ctx.lineWidth = size * 0.85;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			drawPath(ctx, points, limit);
			ctx.stroke();
			// Faint second pass for grain
			ctx.globalAlpha = opacity * 0.25;
			ctx.lineWidth = size * 0.6;
			drawPath(ctx, points, limit);
			ctx.stroke();
			break;

		case "marker":
			// Soft, semi-transparent — accumulates on overlap
			ctx.globalCompositeOperation = "source-over";
			ctx.globalAlpha = opacity * 0.45;
			ctx.strokeStyle = color;
			ctx.lineWidth = size;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			drawPath(ctx, points, limit);
			ctx.stroke();
			break;

		case "brush":
			// Thicker than pen, slight outer halo for "wet ink" feel
			ctx.globalCompositeOperation = "source-over";
			ctx.globalAlpha = opacity * 0.18;
			ctx.strokeStyle = color;
			ctx.lineWidth = size * 1.6;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			drawPath(ctx, points, limit);
			ctx.stroke();
			ctx.globalAlpha = opacity;
			ctx.lineWidth = size;
			drawPath(ctx, points, limit);
			ctx.stroke();
			break;

		case "spray":
			// Scatter dots within radius along the path
			ctx.globalCompositeOperation = "source-over";
			ctx.globalAlpha = opacity * 0.4;
			ctx.fillStyle = color;
			drawSpray(ctx, points, limit, size);
			break;

		case "eraser":
			// Eraser strokes are baked into the user's draft as transparent
			// holes — but we never get here because eraser is applied to the
			// strokes ARRAY (removing strokes from currentStrokes), not to the
			// canvas. Fallthrough is a no-op.
			break;
	}

	ctx.restore();
}

function drawPath(
	ctx: CanvasRenderingContext2D,
	pts: number[],
	limit: number,
): void {
	ctx.beginPath();
	ctx.moveTo(pts[0], pts[1]);
	if (limit === 2) {
		// Single-point tap — stroke a tiny segment so it renders as a dot
		ctx.lineTo(pts[0] + 0.01, pts[1] + 0.01);
		return;
	}
	for (let i = 2; i < limit; i += 2) {
		ctx.lineTo(pts[i], pts[i + 1]);
	}
}

function drawSpray(
	ctx: CanvasRenderingContext2D,
	pts: number[],
	limit: number,
	radius: number,
): void {
	// Deterministic per-stroke noise — same input always renders same dots
	// so replays look identical to the live draw.
	let seed = (pts[0] * 1000 + pts[1]) | 0;
	const rand = () => {
		seed = (seed * 9301 + 49297) & 0x7fffffff;
		return seed / 0x7fffffff;
	};
	for (let i = 0; i < limit; i += 2) {
		const x = pts[i];
		const y = pts[i + 1];
		const density = Math.max(8, Math.min(40, Math.round(radius * 0.8)));
		for (let j = 0; j < density; j++) {
			const ang = rand() * Math.PI * 2;
			const r = Math.sqrt(rand()) * radius;
			ctx.fillRect(
				x + Math.cos(ang) * r - 0.5,
				y + Math.sin(ang) * r - 0.5,
				1.4,
				1.4,
			);
		}
	}
}

/**
 * Total point count across all strokes — used for replay frame budgeting.
 */
export function totalPoints(strokes: Stroke[]): number {
	let n = 0;
	for (const s of strokes) n += s.points.length / 2;
	return n;
}

/**
 * Render strokes up to (totalPointBudget) points distributed across them.
 * Used by the replay animation.
 */
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

/**
 * Render every stroke fully. Used for the world canvas + final submitted views.
 */
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
	"spray",
	"eraser",
];
