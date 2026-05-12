import "./State6.css";

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
	organization: "DNB Bank ASA",
	title: "", // e.g. "Software Engineer"
	phone: "+46707360515",
	email: "max.wik@icloud.com",

	// Profile picture, served from /public. Embedded in the .vcf as an
	// absolute URL so iOS/Android fetch and cache it locally on save.
	photo: "/maximilian.png",

	// URLs in display order. Each gets a custom label via Apple's
	// itemN.X-ABLabel extension — proper labels in iOS/macOS Contacts
	// ("Homepage", "GitHub"); Android shows the URL with a generic
	// "Website" label. Add/remove/reorder freely.
	urls: [
		{ label: "Homepage", url: "https://maximilian-wikstrom.vercel.app/" },
		{ label: "GitHub", url: "https://github.com/MaximilianWik" },
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

function buildVCard(origin: string): string {
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

	// Profile picture: external URL reference. The contact app fetches it
	// once on save and caches it locally on the device, so it survives even
	// if the domain ever lapses (for everyone who already saved you).
	if (d.photo) {
		const abs = /^https?:\/\//.test(d.photo) ? d.photo : `${origin}${d.photo}`;
		lines.push(`PHOTO;VALUE=URL:${abs}`);
	}

	if (d.note) lines.push(`NOTE:${vEscape(d.note)}`);
	lines.push("END:VCARD", "");
	// vCard requires CRLF line endings.
	return lines.join("\r\n");
}

// Vite SPA bundles run in the browser only — `window` is always defined at
// module init. The defensive check just keeps SSR/test environments safe.
const ORIGIN = typeof window !== "undefined" ? window.location.origin : "";
const HREF = `data:text/vcard;charset=utf-8,${encodeURIComponent(
	buildVCard(ORIGIN),
)}`;

export default function State6() {
	const fullName = `${VCARD.firstName} ${VCARD.lastName}`.trim();
	return (
		<div className="vcard">
			<div className="vcard__card">
				{VCARD.photo && (
					<img className="vcard__photo" src={VCARD.photo} alt={fullName} />
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
