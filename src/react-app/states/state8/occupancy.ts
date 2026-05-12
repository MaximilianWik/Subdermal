import type { Stroke } from "./types";
import {
	OCCUPANCY_CELL,
	OCCUPANCY_H,
	OCCUPANCY_W,
} from "./types";

// ─────────────────────────────────────────────────────────────
//  Occupancy grid for "can't draw over others" enforcement.
//
//  A 1-bit-per-cell bitmap covering the world canvas. Each cell
//  is OCCUPANCY_CELL world-pixels square. Populated from existing
//  (other people's) strokes when the canvas loads.
//
//  At 32px cells, a 16384×24576 world is 512×768 = 393K cells =
//  49 KB. Lookup is O(1).
//
//  Live drawing checks the cell at each new point; if occupied by
//  another drawing, the segment is skipped (the user's stroke
//  breaks naturally around existing pieces).
// ─────────────────────────────────────────────────────────────

export class OccupancyGrid {
	readonly bits: Uint8Array;

	constructor() {
		// 1 bit per cell, packed into bytes
		const totalBits = OCCUPANCY_W * OCCUPANCY_H;
		this.bits = new Uint8Array(Math.ceil(totalBits / 8));
	}

	private idx(cx: number, cy: number): { byte: number; mask: number } | null {
		if (cx < 0 || cy < 0 || cx >= OCCUPANCY_W || cy >= OCCUPANCY_H)
			return null;
		const flat = cy * OCCUPANCY_W + cx;
		return { byte: flat >> 3, mask: 1 << (flat & 7) };
	}

	mark(cx: number, cy: number): void {
		const i = this.idx(cx, cy);
		if (!i) return;
		this.bits[i.byte] |= i.mask;
	}

	/** True if the cell containing (worldX, worldY) is occupied. */
	isWorldPointOccupied(wx: number, wy: number): boolean {
		const cx = Math.floor(wx / OCCUPANCY_CELL);
		const cy = Math.floor(wy / OCCUPANCY_CELL);
		const i = this.idx(cx, cy);
		if (!i) return true; // out-of-bounds counts as occupied (= can't draw)
		return (this.bits[i.byte] & i.mask) !== 0;
	}

	/** Mark every cell touched by a line segment (DDA-style). */
	markSegment(x1: number, y1: number, x2: number, y2: number, padding = 1) {
		const cx1 = Math.floor(x1 / OCCUPANCY_CELL);
		const cy1 = Math.floor(y1 / OCCUPANCY_CELL);
		const cx2 = Math.floor(x2 / OCCUPANCY_CELL);
		const cy2 = Math.floor(y2 / OCCUPANCY_CELL);
		const dx = Math.abs(cx2 - cx1);
		const dy = Math.abs(cy2 - cy1);
		const sx = cx1 < cx2 ? 1 : -1;
		const sy = cy1 < cy2 ? 1 : -1;
		let err = dx - dy;
		let x = cx1;
		let y = cy1;
		while (true) {
			// pad nearby cells too so brush radius is respected
			for (let py = -padding; py <= padding; py++) {
				for (let px = -padding; px <= padding; px++) {
					this.mark(x + px, y + py);
				}
			}
			if (x === cx2 && y === cy2) break;
			const e2 = 2 * err;
			if (e2 > -dy) {
				err -= dy;
				x += sx;
			}
			if (e2 < dx) {
				err += dx;
				y += sy;
			}
		}
	}

	/** Add an entire stroke to the occupancy. */
	addStroke(s: Stroke): void {
		const pts = s.points;
		// Padding scales with brush size: 1 padding cell ≈ 32px world,
		// so for a 32px brush we mark 3x3 cells around each segment.
		const padding = Math.max(0, Math.ceil(s.size / OCCUPANCY_CELL / 2));
		for (let i = 0; i < pts.length - 2; i += 2) {
			this.markSegment(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], padding);
		}
		// Also mark single-point strokes (just one tap)
		if (pts.length === 2) {
			const cx = Math.floor(pts[0] / OCCUPANCY_CELL);
			const cy = Math.floor(pts[1] / OCCUPANCY_CELL);
			for (let py = -padding; py <= padding; py++) {
				for (let px = -padding; px <= padding; px++) {
					this.mark(cx + px, cy + py);
				}
			}
		}
	}
}
