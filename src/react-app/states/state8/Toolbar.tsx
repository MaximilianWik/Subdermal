import { useState, type ReactNode } from "react";
import type { ToolType } from "./types";
import {
	BRUSH_SIZE_MAX,
	BRUSH_SIZE_MIN,
	ERASER_SIZE_MAX,
	ERASER_SIZE_MIN,
} from "./types";
import ColorPicker from "./ColorPicker";
import "./Toolbar.css";

interface Props {
	tool: ToolType;
	color: string;
	size: number;
	opacity: number;
	canUndo: boolean;
	canRedo: boolean;
	onTool: (t: ToolType) => void;
	onColor: (c: string) => void;
	onSize: (n: number) => void;
	onOpacity: (n: number) => void;
	onUndo: () => void;
	onRedo: () => void;
	onSubmit: () => void;
	onCancel: () => void;
	onResetView: () => void;
	onClear: () => void;
	hasStrokes: boolean;
}

// ─── Icons ───────────────────────────────────────────────────
//
// Monochrome line-art icons that pick up the button's text color
// via `currentColor`. 24×24 viewBox, 1.6px stroke for crispness
// at toolbar size.
const SVG_PROPS = {
	width: "20",
	height: "20",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "1.6",
	strokeLinecap: "round" as const,
	strokeLinejoin: "round" as const,
} as const;

function PenIcon() {
	return (
		<svg {...SVG_PROPS}>
			<path d="M14 4l6 6-10 10H4v-6L14 4z" />
			<path d="M13 5l6 6" />
		</svg>
	);
}
function WatercolorIcon() {
	return (
		<svg {...SVG_PROPS}>
			<path d="M12 3.5c0 0-6.5 7-6.5 11a6.5 6.5 0 0 0 13 0c0-4-6.5-11-6.5-11z" />
		</svg>
	);
}
function CalligraphyIcon() {
	return (
		<svg {...SVG_PROPS}>
			<path d="M5 19l11-11 3 3-11 11H5v-3z" strokeWidth="1.6" />
			<line x1="14" y1="6" x2="17" y2="9" />
			<line x1="3" y1="21" x2="11" y2="21" />
		</svg>
	);
}
function SprayIcon() {
	return (
		<svg {...SVG_PROPS}>
			<circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
			<circle cx="7.5" cy="9" r="0.9" fill="currentColor" stroke="none" />
			<circle cx="16.5" cy="9" r="0.9" fill="currentColor" stroke="none" />
			<circle cx="7.5" cy="15" r="0.9" fill="currentColor" stroke="none" />
			<circle cx="16.5" cy="15" r="0.9" fill="currentColor" stroke="none" />
			<circle cx="12" cy="6" r="0.7" fill="currentColor" stroke="none" />
			<circle cx="12" cy="18" r="0.7" fill="currentColor" stroke="none" />
			<circle cx="5" cy="12" r="0.7" fill="currentColor" stroke="none" />
			<circle cx="19" cy="12" r="0.7" fill="currentColor" stroke="none" />
			<circle cx="20" cy="6" r="0.5" fill="currentColor" stroke="none" />
			<circle cx="4" cy="18" r="0.5" fill="currentColor" stroke="none" />
		</svg>
	);
}
function AirbrushIcon() {
	return (
		<svg {...SVG_PROPS}>
			<circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
			<circle cx="12" cy="12" r="6" opacity="0.55" />
			<circle cx="12" cy="12" r="9.5" opacity="0.3" />
		</svg>
	);
}
function PixelArtIcon() {
	return (
		<svg {...SVG_PROPS}>
			<rect x="3" y="3" width="18" height="18" rx="0.5" />
			<line x1="9" y1="3" x2="9" y2="21" />
			<line x1="15" y1="3" x2="15" y2="21" />
			<line x1="3" y1="9" x2="21" y2="9" />
			<line x1="3" y1="15" x2="21" y2="15" />
			<rect x="9" y="9" width="6" height="6" fill="currentColor" stroke="none" />
			<rect x="3" y="15" width="6" height="6" fill="currentColor" stroke="none" opacity="0.55" />
		</svg>
	);
}
function EraserIcon() {
	return (
		<svg {...SVG_PROPS}>
			<path d="M16 3l5 5-11 11H5v-5L16 3z" />
			<line x1="11" y1="8" x2="16" y2="13" />
			<line x1="9" y1="19" x2="21" y2="19" />
		</svg>
	);
}

const TOOLS: Array<{ id: ToolType; label: string; icon: ReactNode }> = [
	{ id: "pen", label: "Pen", icon: <PenIcon /> },
	{ id: "watercolor", label: "Watercolor", icon: <WatercolorIcon /> },
	{ id: "calligraphy", label: "Calligraphy", icon: <CalligraphyIcon /> },
	{ id: "spray", label: "Spray", icon: <SprayIcon /> },
	{ id: "airbrush", label: "Airbrush", icon: <AirbrushIcon /> },
	{ id: "pixel", label: "Pixel art", icon: <PixelArtIcon /> },
	{ id: "eraser", label: "Eraser", icon: <EraserIcon /> },
];

const RECENT_COLORS_LS = "state8.recentColors.v1";
const PRESET_COLORS = [
	"#000000",
	"#ffffff",
	"#e63946",
	"#f1a208",
	"#fee440",
	"#06d6a0",
	"#118ab2",
	"#7209b7",
	"#ff70a6",
	"#7d8597",
];

function loadRecentColors(): string[] {
	try {
		const raw = localStorage.getItem(RECENT_COLORS_LS);
		if (!raw) return [];
		const v = JSON.parse(raw) as unknown;
		return Array.isArray(v) ? (v as string[]).slice(0, 10) : [];
	} catch {
		return [];
	}
}
function saveRecentColors(arr: string[]) {
	try {
		localStorage.setItem(RECENT_COLORS_LS, JSON.stringify(arr.slice(0, 10)));
	} catch {
		/* ignore */
	}
}

export default function Toolbar(props: Props) {
	const {
		tool,
		color,
		size,
		opacity,
		canUndo,
		canRedo,
		onTool,
		onColor,
		onSize,
		onOpacity,
		onUndo,
		onRedo,
		onSubmit,
		onCancel,
		onResetView,
		onClear,
		hasStrokes,
	} = props;

	const [colorOpen, setColorOpen] = useState(false);
	const [recents, setRecents] = useState<string[]>(loadRecentColors);

	const isEraser = tool === "eraser";
	const isPixel = tool === "pixel";
	const sizeMin = isEraser ? ERASER_SIZE_MIN : BRUSH_SIZE_MIN;
	const sizeMax = isEraser ? ERASER_SIZE_MAX : BRUSH_SIZE_MAX;

	const handleColor = (c: string) => {
		onColor(c);
		const next = [c, ...recents.filter((x) => x !== c)].slice(0, 10);
		setRecents(next);
		saveRecentColors(next);
	};

	return (
		<div className="tb">
			<div className="tb__row tb__row--tools">
				{TOOLS.map((t) => (
					<button
						key={t.id}
						className={`tb__tool ${tool === t.id ? "tb__tool--active" : ""}`}
						onClick={() => onTool(t.id)}
						title={t.label}
						aria-label={t.label}
					>
						<span className="tb__toolIcon">{t.icon}</span>
						<span className="tb__toolLabel">{t.label}</span>
					</button>
				))}
			</div>

			<div className="tb__row tb__row--params">
				<button
					className="tb__swatch"
					style={{ background: color }}
					onClick={() => setColorOpen((v) => !v)}
					title="Color"
					aria-label="Color"
					disabled={isEraser}
				/>
				<div className="tb__sliderGroup">
					<span className="tb__sliderIcon">●</span>
					<span className="tb__sliderLabel">Size</span>
					<input
						className="tb__slider"
						type="range"
						min={sizeMin}
						max={sizeMax}
						value={size}
						onChange={(e) => onSize(parseInt(e.target.value, 10))}
						disabled={isPixel}
					/>
					<span className="tb__sliderValue">{isPixel ? 32 : size}</span>
				</div>
				<div className="tb__sliderGroup">
					<span className="tb__sliderIcon">◐</span>
					<span className="tb__sliderLabel">Opacity</span>
					<input
						className="tb__slider"
						type="range"
						min={5}
						max={100}
						value={Math.round(opacity * 100)}
						onChange={(e) =>
							onOpacity(parseInt(e.target.value, 10) / 100)
						}
						disabled={isEraser || isPixel}
					/>
					<span className="tb__sliderValue">
						{Math.round(opacity * 100)}%
					</span>
				</div>
			</div>

			<div className="tb__row tb__row--actions">
				<button className="tb__btn" onClick={onUndo} disabled={!canUndo}>
					↶ Undo
				</button>
				<button className="tb__btn" onClick={onRedo} disabled={!canRedo}>
					↷ Redo
				</button>
				<button className="tb__btn" onClick={onResetView}>
					⊕ Reset view
				</button>
				<button
					className="tb__btn tb__btn--danger"
					onClick={onClear}
					disabled={!hasStrokes}
				>
					🗑 Clear
				</button>
				<button className="tb__btn tb__btn--danger" onClick={onCancel}>
					Cancel
				</button>
				<button
					className="tb__btn tb__btn--primary"
					onClick={onSubmit}
					disabled={!hasStrokes}
				>
					Sign &amp; Submit →
				</button>
			</div>

			{colorOpen && (
				<div className="tb__colorPop">
					<ColorPicker color={color} onChange={handleColor} />
					<div className="tb__presetRow">
						{PRESET_COLORS.map((c) => (
							<button
								key={c}
								className="tb__presetSwatch"
								style={{ background: c }}
								onClick={() => handleColor(c)}
							/>
						))}
					</div>
					{recents.length > 0 && (
						<>
							<div className="tb__presetLabel">Recent</div>
							<div className="tb__presetRow">
								{recents.map((c, i) => (
									<button
										key={i}
										className="tb__presetSwatch"
										style={{ background: c }}
										onClick={() => handleColor(c)}
									/>
								))}
							</div>
						</>
					)}
					<button
						className="tb__btn tb__closeColor"
						onClick={() => setColorOpen(false)}
					>
						Close
					</button>
				</div>
			)}
		</div>
	);
}
