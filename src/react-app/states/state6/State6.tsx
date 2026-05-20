import "./State6.css";
import { PHOTO_B64 } from "./State6.photo";

// ─────────────────────────────────────────────────────────────
//  vCard — "Save my contact" page.
//
//  Edit the fields below. They flow into the downloadable .vcf.
//  Empty strings ("") are omitted from the card.
//
//  The page shows your NAME, ORG, and PROFILE PHOTO. Phone, email,
//  etc. stay private until someone taps the button and saves you
//  to their phone.
// ─────────────────────────────────────────────────────────────
const VCARD = {
	firstName: "Maximilian",
	lastName: "Wikström",
	organization: "",
	title: "", // e.g. "Software Engineer"
	phone: "+46707360515",
	email: "max.wik@icloud.com",

	// Profile picture displayed on the page (sharp, full resolution).
	// The .vcf payload uses a separately resized JPEG embedded as base64
	// — see State6.photo.ts for regeneration instructions.
	photoSrc: "/maximilian.png",

	// URLs in display order. Each gets a custom label via Apple's
	// itemN.X-ABLabel extension — proper labels in iOS/macOS Contacts;
	// Android shows the URL with a generic "Website" label. Add/remove
	// /reorder freely.
	//
	// Non-ASCII characters in URLs MUST be percent-encoded per RFC 3986
	// (e.g. ö → %C3%B6) for cross-parser compatibility.
	urls: [
		{ label: "Homepage", url: "https://maximilian-wikstrom.vercel.app/" },
		{ label: "GitHub", url: "https://github.com/MaximilianWik" },
		{
			label: "LinkedIn",
			url: "https://se.linkedin.com/in/maximilian-wikstr%C3%B6m",
		},
		{ label: "Tessera", url: "https://tessera-neon.vercel.app/" },
	],

	note: "Saved from a QR tattoo.",
};

const FILENAME = "MaximilianWikstrom.vcf";
const BUTTON_LABEL = "Save to Contacts";
// ─────────────────────────────────────────────────────────────

/** Escape a value per vCard 3.0 (RFC 2426 §4): backslash, comma, semicolon, newline. */
function vEscape(s: string): string {
	return s
		.replace(/\\/g, "\\\\")
		.replace(/\n/g, "\\n")
		.replace(/,/g, "\\,")
		.replace(/;/g, "\\;");
}

/**
 * Fold a single line per RFC 2425 §5.8.1: lines longer than `max` octets
 * are split, with each continuation line starting with a single space
 * (which the parser strips on unfolding). Required for embedded photos —
 * strict parsers reject overlong lines.
 */
function foldLine(line: string, max = 75): string {
	if (line.length <= max) return line;
	const out: string[] = [line.slice(0, max)];
	let i = max;
	const contLen = max - 1; // continuation lines reserve 1 octet for the leading space
	while (i < line.length) {
		out.push(" " + line.slice(i, i + contLen));
		i += contLen;
	}
	return out.join("\r\n");
}

function buildVCard(): string {
	const d = VCARD;
	const fullName = `${d.firstName} ${d.lastName}`.trim();
	const lines: string[] = [
		"BEGIN:VCARD",
		"VERSION:3.0",
		// N is structured: Last;First;Middle;Prefix;Suffix
		`N:${vEscape(d.lastName)};${vEscape(d.firstName)};;;`,
		`FN:${vEscape(fullName)}`,
	];
	if (d.organization) lines.push(`ORG:${vEscape(d.organization)}`);
	if (d.title) lines.push(`TITLE:${vEscape(d.title)}`);
	if (d.phone) lines.push(`TEL;TYPE=CELL:${d.phone}`);
	if (d.email) lines.push(`EMAIL;TYPE=INTERNET:${d.email}`);

	// Multi-URL with labels. Apple itemN pattern is widely supported and
	// preserves custom labels on import in iOS/macOS/Outlook.
	d.urls.forEach((u, i) => {
		const item = `item${i + 1}`;
		lines.push(`${item}.URL:${u.url}`);
		lines.push(`${item}.X-ABLabel:${vEscape(u.label)}`);
	});

	// Profile picture: embedded base64 JPEG. iOS Contacts ignores the URL
	// form (PHOTO;VALUE=URL) in most versions — embedded is the form that
	// reliably renders in the saved contact.
	if (PHOTO_B64) {
		lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${PHOTO_B64}`);
	}

	if (d.note) lines.push(`NOTE:${vEscape(d.note)}`);
	lines.push("END:VCARD", "");

	// vCard requires CRLF line endings, and lines must not exceed 75 octets.
	return lines.map((l) => foldLine(l)).join("\r\n");
}

const HREF = `data:text/vcard;charset=utf-8,${encodeURIComponent(buildVCard())}`;

export default function State6() {
	const fullName = `${VCARD.firstName} ${VCARD.lastName}`.trim();
	return (
		<div className="vcard">
			<div className="vcard__card">
				{VCARD.photoSrc && (
					<img
						className="vcard__photo"
						src={VCARD.photoSrc}
						alt={fullName}
					/>
				)}
				<div className="vcard__name">{fullName}</div>
				{VCARD.organization && (
					<div className="vcard__org">{VCARD.organization}</div>
				)}
				{VCARD.title && <div className="vcard__title">{VCARD.title}</div>}
				<a className="vcard__btn" href={HREF} download={FILENAME}>
					{BUTTON_LABEL}
				</a>
			</div>
		</div>
	);
}
