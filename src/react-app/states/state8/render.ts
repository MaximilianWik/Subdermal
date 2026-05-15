import type { Stroke } from "./types";
import { PIXEL_CELL } from "./types";

// ─────────────────────────────────────────────────────────────
//  Stroke rendering. One renderer per ToolType variant.
//
//  Coordinates are WORLD pixels. The caller is expected to have
//  already applied the pan/zoom transform to the canvas context.
//
//  All randomness is deterministic per stroke (seeded from the
//  first point or from per-point world coords), so replays look
//  identical to the live draw on any device or zoom level.
//
//  The pencil / marker / brush / charcoal renderers are kept even
//  though those tools are no longer in the toolbar palette: existing
//  drawings in the database may still reference them, and the
//  renderer is what guarantees those drawings continue to display
//  correctly. Removing them here would silently break old work.
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
		case "blender":
			renderBlender(ctx, stroke, limit);
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

// ─── 11. Blender — soft, colourless smear with cloud-shaped tip ──
//
// The blender doesn't introduce new colours: at paint time CanvasView
// samples the canvas under each step and stores the colour into
// stroke.pointColors. Each stamp is a closed path traced as a wavy
// silhouette (radius modulated by two sinusoids with seeded phases)
// rather than a circle, so the brush footprint has clear concave dips
// and convex bumps — a cloud, not a disc. The path is filled with a
// soft radial gradient so edges still feather. Per-stamp seed comes
// from the stamp's world coords so the shape is stable across redraws
// and replays.
const BLENDER_PATH_SAMPLES = 24;
function renderBlender(
	ctx: CanvasRenderingContext2D,
	s: Stroke,
	limit: number,
): void {
	const colors = s.pointColors;
	if (!colors || colors.length === 0) return;
	const pts = s.points;
	const radius = s.size;
	const stampAlpha = Math.max(0, Math.min(1, s.opacity)) * 0.4;
	ctx.globalCompositeOperation = "source-over";

	for (let i = 0; i < limit; i += 2) {
		const ci = i >> 1;
		if (ci >= colors.length) break;
		const packed = colors[ci];
		// Sentinel for "sample failed" — skip silently.
		if (packed < 0) continue;
		const r = (packed >> 16) & 0xff;
		const g = (packed >> 8) & 0xff;
		const b = packed & 0xff;
		const x = pts[i];
		const y = pts[i + 1];

		// Seeded RNG so the cloud silhouette is deterministic per stamp.
		let seed = (((x | 0) * 73856093) ^ ((y | 0) * 19349663)) >>> 0;
		if (seed === 0) seed = 1;
		const rand = () => {
			seed = (seed * 1664525 + 1013904223) >>> 0;
			return seed / 0xffffffff;
		};
		const phase1 = rand() * Math.PI * 2;
		const phase2 = rand() * Math.PI * 2;

		// Trace the cloud silhouette. Two sinusoids at different angular
		// frequencies (5θ and 3θ) produce visible bumps and dips around
		// the perimeter; the result extends to ~1.37·radius at peaks and
		// recedes to ~0.63·radius at troughs.
		ctx.beginPath();
		for (let j = 0; j <= BLENDER_PATH_SAMPLES; j++) {
			const ang = (j / BLENDER_PATH_SAMPLES) * Math.PI * 2;
			const wave =
				1.0 +
				Math.sin(ang * 5 + phase1) * 0.22 +
				Math.sin(ang * 3 + phase2) * 0.15;
			const px = x + Math.cos(ang) * radius * wave;
			const py = y + Math.sin(ang) * radius * wave;
			if (j === 0) ctx.moveTo(px, py);
			else ctx.lineTo(px, py);
		}
		ctx.closePath();

		// Soft radial gradient inside the cloud silhouette. Gradient
		// extent slightly larger than `radius` so the high bumps still
		// see a non-zero alpha at their tips.
		const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.4);
		grad.addColorStop(0, `rgba(${r},${g},${b},${stampAlpha})`);
		grad.addColorStop(0.65, `rgba(${r},${g},${b},${stampAlpha * 0.55})`);
		grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
		ctx.fillStyle = grad;
		ctx.fill();
	}
}

// Pre-computed wavy path string used by the blender hover cursor in
// CanvasView so the preview matches what the brush actually deposits.
// Same wave formula as renderBlender, just with a fixed seed so the
// shape is stable across the whole session.
function buildCloudPathD(seed: number): string {
	let s = seed >>> 0;
	if (s === 0) s = 1;
	const rand = () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0xffffffff;
	};
	const phase1 = rand() * Math.PI * 2;
	const phase2 = rand() * Math.PI * 2;
	const N = BLENDER_PATH_SAMPLES;
	let d = "";
	for (let j = 0; j <= N; j++) {
		const ang = (j / N) * Math.PI * 2;
		const wave =
			1.0 +
			Math.sin(ang * 5 + phase1) * 0.22 +
			Math.sin(ang * 3 + phase2) * 0.15;
		const x = Math.cos(ang) * wave;
		const y = Math.sin(ang) * wave;
		d += (j === 0 ? "M" : "L") + x.toFixed(3) + " " + y.toFixed(3) + " ";
	}
	return d + "Z";
}
export const BLENDER_PREVIEW_PATH = buildCloudPathD(0xc10dface);

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
