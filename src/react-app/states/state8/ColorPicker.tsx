import { useEffect, useRef, useState } from "react";
import "./ColorPicker.css";

// ─────────────────────────────────────────────────────────────
//  HSV color picker.
//
//  - Hue ring on the outside.
//  - Saturation/Value square inside.
//  - Tap anywhere on either to set the corresponding channel.
//  - Recent-colors row + Opacity slider rendered by the parent.
// ─────────────────────────────────────────────────────────────

interface Props {
	color: string; // #RRGGBB
	onChange: (hex: string) => void;
}

export default function ColorPicker({ color, onChange }: Props) {
	const ringRef = useRef<HTMLCanvasElement>(null);
	const sqRef = useRef<HTMLCanvasElement>(null);

	const [hsv, setHsv] = useState(() => hexToHsv(color));

	// Keep internal HSV synced if parent changes color externally
	useEffect(() => {
		const incoming = hexToHsv(color);
		if (
			Math.abs(incoming.h - hsv.h) > 0.5 ||
			Math.abs(incoming.s - hsv.s) > 0.005 ||
			Math.abs(incoming.v - hsv.v) > 0.005
		) {
			setHsv(incoming);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [color]);

	// Draw hue ring once
	useEffect(() => {
		const c = ringRef.current;
		if (!c) return;
		const ctx = c.getContext("2d");
		if (!ctx) return;
		drawHueRing(ctx, c.width, c.height);
	}, []);

	// Redraw S/V square whenever hue changes
	useEffect(() => {
		const c = sqRef.current;
		if (!c) return;
		const ctx = c.getContext("2d");
		if (!ctx) return;
		drawSvSquare(ctx, c.width, c.height, hsv.h);
	}, [hsv.h]);

	const handleRingPointer = (clientX: number, clientY: number) => {
		const c = ringRef.current;
		if (!c) return;
		const rect = c.getBoundingClientRect();
		const cx = rect.width / 2;
		const cy = rect.height / 2;
		const x = clientX - rect.left - cx;
		const y = clientY - rect.top - cy;
		let h = (Math.atan2(y, x) * 180) / Math.PI;
		if (h < 0) h += 360;
		const next = { ...hsv, h };
		setHsv(next);
		onChange(hsvToHex(next));
	};

	const handleSquarePointer = (clientX: number, clientY: number) => {
		const c = sqRef.current;
		if (!c) return;
		const rect = c.getBoundingClientRect();
		const x = Math.max(
			0,
			Math.min(rect.width, clientX - rect.left),
		);
		const y = Math.max(
			0,
			Math.min(rect.height, clientY - rect.top),
		);
		const s = x / rect.width;
		const v = 1 - y / rect.height;
		const next = { ...hsv, s, v };
		setHsv(next);
		onChange(hsvToHex(next));
	};

	const ringRadius = 110;
	const ringInner = 84;
	const sqSize = 110;

	// Hue indicator position on the ring
	const hueRad = (hsv.h * Math.PI) / 180;
	const hueX = Math.cos(hueRad) * (ringInner + (ringRadius - ringInner) / 2);
	const hueY = Math.sin(hueRad) * (ringInner + (ringRadius - ringInner) / 2);

	return (
		<div className="cp">
			<div
				className="cp__ring"
				style={{ width: ringRadius * 2, height: ringRadius * 2 }}
				onPointerDown={(e) => {
					(e.target as Element).setPointerCapture(e.pointerId);
					handleRingPointer(e.clientX, e.clientY);
				}}
				onPointerMove={(e) => {
					if (e.buttons === 0) return;
					handleRingPointer(e.clientX, e.clientY);
				}}
			>
				<canvas
					ref={ringRef}
					width={ringRadius * 2}
					height={ringRadius * 2}
				/>
				<div
					className="cp__hueIndicator"
					style={{
						left: ringRadius + hueX,
						top: ringRadius + hueY,
					}}
				/>
				<div
					className="cp__square"
					style={{ width: sqSize, height: sqSize }}
					onPointerDown={(e) => {
						e.stopPropagation();
						(e.target as Element).setPointerCapture(e.pointerId);
						handleSquarePointer(e.clientX, e.clientY);
					}}
					onPointerMove={(e) => {
						e.stopPropagation();
						if (e.buttons === 0) return;
						handleSquarePointer(e.clientX, e.clientY);
					}}
				>
					<canvas ref={sqRef} width={sqSize} height={sqSize} />
					<div
						className="cp__svIndicator"
						style={{
							left: hsv.s * sqSize,
							top: (1 - hsv.v) * sqSize,
						}}
					/>
				</div>
			</div>
			<div className="cp__hex">{color.toUpperCase()}</div>
		</div>
	);
}

// ─── Color math ──────────────────────────────────────────────

function drawHueRing(ctx: CanvasRenderingContext2D, w: number, h: number) {
	const cx = w / 2;
	const cy = h / 2;
	const outer = w / 2;
	const inner = outer * 0.76;
	for (let a = 0; a < 360; a += 0.5) {
		const r1 = (a * Math.PI) / 180;
		const r2 = ((a + 1.5) * Math.PI) / 180;
		ctx.beginPath();
		ctx.arc(cx, cy, outer, r1, r2);
		ctx.arc(cx, cy, inner, r2, r1, true);
		ctx.closePath();
		ctx.fillStyle = `hsl(${a}, 100%, 50%)`;
		ctx.fill();
	}
}

function drawSvSquare(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	hue: number,
) {
	// Base hue
	ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
	ctx.fillRect(0, 0, w, h);
	// White → transparent gradient (left to right) for saturation
	const sg = ctx.createLinearGradient(0, 0, w, 0);
	sg.addColorStop(0, "rgba(255,255,255,1)");
	sg.addColorStop(1, "rgba(255,255,255,0)");
	ctx.fillStyle = sg;
	ctx.fillRect(0, 0, w, h);
	// Transparent → black (top to bottom) for value
	const vg = ctx.createLinearGradient(0, 0, 0, h);
	vg.addColorStop(0, "rgba(0,0,0,0)");
	vg.addColorStop(1, "rgba(0,0,0,1)");
	ctx.fillStyle = vg;
	ctx.fillRect(0, 0, w, h);
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
	const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
	if (!m) return { h: 0, s: 0, v: 0 };
	const n = parseInt(m[1], 16);
	const r = ((n >> 16) & 0xff) / 255;
	const g = ((n >> 8) & 0xff) / 255;
	const b = (n & 0xff) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	let h = 0;
	const s = max === 0 ? 0 : d / max;
	const v = max;
	if (d !== 0) {
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h *= 60;
	}
	return { h, s, v };
}

export function hsvToHex(hsv: { h: number; s: number; v: number }): string {
	const { h, s, v } = hsv;
	const c = v * s;
	const hp = h / 60;
	const x = c * (1 - Math.abs((hp % 2) - 1));
	let r = 0,
		g = 0,
		b = 0;
	if (hp < 1) [r, g, b] = [c, x, 0];
	else if (hp < 2) [r, g, b] = [x, c, 0];
	else if (hp < 3) [r, g, b] = [0, c, x];
	else if (hp < 4) [r, g, b] = [0, x, c];
	else if (hp < 5) [r, g, b] = [x, 0, c];
	else [r, g, b] = [c, 0, x];
	const m = v - c;
	const toHex = (n: number) =>
		Math.round((n + m) * 255)
			.toString(16)
			.padStart(2, "0");
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
