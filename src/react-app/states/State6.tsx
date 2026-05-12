import "./State6.css";

// ─────────────────────────────────────────────────────────────
//  vCard — "Save my contact" page.
//
//  Edit the fields below. They flow into the downloadable .vcf.
//  Empty strings ("") are omitted from the card.
//
//  The page only shows your NAME and ORG. Phone, email, etc.
//  stay private until someone taps the button and saves you to
//  their phone — so the page is safe to display in public.
// ─────────────────────────────────────────────────────────────
const VCARD = {
	firstName: "Maximilian",
	lastName: "Wikström",
	organization: "DNB Bank ASA",
	title: "", // e.g. "Software Engineer"
	phone: "+46707360515",
	email: "max.wik@icloud.com",
	url: "https://github.com/MaximilianWik",
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
	if (d.url) lines.push(`URL:${d.url}`);
	if (d.note) lines.push(`NOTE:${vEscape(d.note)}`);
	lines.push("END:VCARD", "");
	// vCard requires CRLF line endings.
	return lines.join("\r\n");
}

// vCards are tiny (<1KB) — a data URL is simpler than blob lifecycle and works
// identically across iOS Safari, Android Chrome, and desktop browsers. iOS in
// particular shows the native "Add Contact" preview for `text/vcard` data URLs.
const HREF = `data:text/vcard;charset=utf-8,${encodeURIComponent(buildVCard())}`;

export default function State6() {
	const fullName = `${VCARD.firstName} ${VCARD.lastName}`.trim();
	return (
		<div className="vcard">
			<div className="vcard__card">
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
