// ─────────────────────────────────────────────────────────────
//  Per-browser ownership for drawings.
//
//  We mint a random UUID-v4-shaped secret on first use and store
//  it in localStorage. It's sent with every submit and edit so
//  the server can match a row's owner_secret column against the
//  caller's. Treat the secret as private to this browser.
//
//  Drawing IDs the user owns (so we can show an "Edit" button
//  even when the server doesn't echo owner_secret on detail
//  fetches) are tracked in a separate localStorage list.
// ─────────────────────────────────────────────────────────────

const OWNER_KEY = "state8.owner.v1";
const MY_IDS_KEY = "state8.myDrawings.v1";

function makeUuidV4(): string {
	// Prefer crypto.randomUUID when available (all modern browsers)
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	// Fallback — RFC4122 v4 from getRandomValues
	const buf = new Uint8Array(16);
	crypto.getRandomValues(buf);
	buf[6] = (buf[6] & 0x0f) | 0x40;
	buf[8] = (buf[8] & 0x3f) | 0x80;
	const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0"));
	return (
		hex.slice(0, 4).join("") +
		"-" +
		hex.slice(4, 6).join("") +
		"-" +
		hex.slice(6, 8).join("") +
		"-" +
		hex.slice(8, 10).join("") +
		"-" +
		hex.slice(10, 16).join("")
	);
}

export function getOwnerSecret(): string {
	try {
		const existing = localStorage.getItem(OWNER_KEY);
		if (existing && existing.length >= 16) return existing;
	} catch {
		/* localStorage may be blocked — fall through */
	}
	const fresh = makeUuidV4();
	try {
		localStorage.setItem(OWNER_KEY, fresh);
	} catch {
		/* ignore — secret will be ephemeral for this session */
	}
	return fresh;
}

function readMyIds(): number[] {
	try {
		const raw = localStorage.getItem(MY_IDS_KEY);
		if (!raw) return [];
		const v = JSON.parse(raw) as unknown;
		if (!Array.isArray(v)) return [];
		return v.filter((x): x is number => typeof x === "number");
	} catch {
		return [];
	}
}

function writeMyIds(ids: number[]): void {
	try {
		// Cap the list — if a user submits thousands, oldest fall off.
		localStorage.setItem(MY_IDS_KEY, JSON.stringify(ids.slice(-500)));
	} catch {
		/* ignore */
	}
}

export function getMyDrawingIds(): number[] {
	return readMyIds();
}

export function rememberMyDrawing(id: number): void {
	const cur = readMyIds();
	if (cur.includes(id)) return;
	cur.push(id);
	writeMyIds(cur);
}

export function forgetMyDrawing(id: number): void {
	const cur = readMyIds().filter((x) => x !== id);
	writeMyIds(cur);
}

export function isMyDrawing(id: number): boolean {
	return readMyIds().includes(id);
}
