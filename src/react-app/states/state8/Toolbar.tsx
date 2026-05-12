import { useState } from "react";
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
	hasStrokes: boolean;
}

const TOOLS: Array<{ id: ToolType; label: string; icon: string }> = [
	{ id: "pen", label: "Pen", icon: "✒︎" },
	{ id: "pencil", label: "Pencil", icon: "✎" },
	{ id: "marker", label: "Marker", icon: "▮" },
	{ id: "brush", label: "Brush", icon: "🖌" },
	{ id: "spray", label: "Spray", icon: "✦" },
	{ id: "eraser", label: "Eraser", icon: "⌫" },
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
		hasStrokes,
	} = props;

	const [colorOpen, setColorOpen] = useState(false);
	const [recents, setRecents] = useState<string[]>(loadRecentColors);

	const isEraser = tool === "eraser";
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
				<input
					className="tb__slider"
					type="range"
					min={sizeMin}
					max={sizeMax}
					value={size}
					onChange={(e) => onSize(parseInt(e.target.value, 10))}
					title={`Size: ${size}px`}
				/>
				<div className="tb__sizeLabel">{size}</div>
				<input
					className="tb__slider tb__slider--narrow"
					type="range"
					min={5}
					max={100}
					value={Math.round(opacity * 100)}
					onChange={(e) =>
						onOpacity(parseInt(e.target.value, 10) / 100)
					}
					title={`Opacity: ${Math.round(opacity * 100)}%`}
					disabled={isEraser}
				/>
			</div>

			<div className="tb__row tb__row--actions">
				<button className="tb__btn" onClick={onUndo} disabled={!canUndo}>
					↶ Undo
				</button>
				<button className="tb__btn" onClick={onRedo} disabled={!canRedo}>
					↷ Redo
				</button>
				<button className="tb__btn" onClick={onResetView}>
					⊕ Reset
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
