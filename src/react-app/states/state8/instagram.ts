// ─────────────────────────────────────────────────────────────
//  Instagram handle sanitisation. Used by both the SignModal
//  (so the user can paste a URL or "@handle" and it just works)
//  and the worker (defence in depth).
//
//  Rules: a-zA-Z0-9._, length 1..30, no leading dot, no trailing
//  dot, no consecutive dots. Anything else is treated as missing.
// ─────────────────────────────────────────────────────────────

const HANDLE_RE = /^(?!\.)(?!.*\.\.)[A-Za-z0-9._]{1,30}(?<!\.)$/;

export function sanitizeInstagram(input: unknown): string | null {
	if (typeof input !== "string") return null;
	let s = input.trim();
	if (!s) return null;
	// Strip URL prefixes: https://instagram.com/foo, www.instagram.com/foo, etc.
	s = s.replace(
		/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i,
		"",
	);
	// Drop any trailing slash or query
	s = s.replace(/[/?#].*$/, "");
	// Strip a leading @
	if (s.startsWith("@")) s = s.slice(1);
	if (!HANDLE_RE.test(s)) return null;
	return s;
}

export function instagramUrl(handle: string): string {
	return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
}
