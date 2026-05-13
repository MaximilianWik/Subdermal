import type { Stroke, ToolType } from "./types";
import { DRAFT_KEY } from "./types";

// ─────────────────────────────────────────────────────────────
//  Draft persistence — survives page refreshes / phone notifications.
// ─────────────────────────────────────────────────────────────

export interface Draft {
	strokes: Stroke[];
	tool: ToolType;
	color: string;
	size: number;
	opacity: number;
	name: string;
	instagram: string;
	startedAt: number;
}

export function loadDraft(): Draft | null {
	try {
		const raw = localStorage.getItem(DRAFT_KEY);
		if (!raw) return null;
		const v = JSON.parse(raw) as unknown;
		if (!v || typeof v !== "object") return null;
		const d = v as Partial<Draft>;
		if (!Array.isArray(d.strokes)) return null;
		return {
			strokes: d.strokes,
			tool: (d.tool as ToolType) ?? "pen",
			color: typeof d.color === "string" ? d.color : "#000000",
			size: typeof d.size === "number" ? d.size : 6,
			opacity: typeof d.opacity === "number" ? d.opacity : 1,
			name: typeof d.name === "string" ? d.name : "",
			instagram: typeof d.instagram === "string" ? d.instagram : "",
			startedAt: typeof d.startedAt === "number" ? d.startedAt : Date.now(),
		};
	} catch {
		return null;
	}
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveDraft(draft: Draft): void {
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(() => {
		try {
			localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
		} catch {
			/* quota exceeded — ignore, draft will fall back to memory only */
		}
	}, 250);
}

export function clearDraft(): void {
	if (saveTimer) {
		clearTimeout(saveTimer);
		saveTimer = null;
	}
	try {
		localStorage.removeItem(DRAFT_KEY);
	} catch {
		/* ignore */
	}
}
