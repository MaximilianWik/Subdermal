import "./Rules.css";

interface Props {
	onAccept: () => void;
}

type RuleTone = "ban" | "ok";

interface Rule {
	tone: RuleTone;
	icon: string;
	title: string;
	body: string;
}

const RULES: Rule[] = [
	{
		tone: "ban",
		icon: "✕",
		title: "No hate speech",
		body: "Slurs, harassment, or anything aimed at a group will be removed without warning. Don't be that person.",
	},
	{
		tone: "ok",
		icon: "✓",
		title: "Profanity and NSFW",
		body: "This is a QR tattoo on some guy's arm. The bar was on the floor before you got here.",
	},
	{
		tone: "ban",
		icon: "✕",
		title: "No griefing other artists",
		body: "Drawing on top of someone else's piece is forbidden, and physically impossible: the proximity rule blocks your strokes from crossing anyone's existing work. Try it if you want. It won't work. Save your battery.",
	},
	{
		tone: "ban",
		icon: "✕",
		title: "No spam or impersonation",
		body: "One artist, one signature. Don't pose as someone you aren't.",
	},
];

export default function Rules({ onAccept }: Props) {
	return (
		<div className="rules">
			<div className="rules__card">
				<div className="rules__head">
					<div className="rules__eyebrow">Before you draw</div>
					<div className="rules__title">House rules</div>
					<div className="rules__sub">
						You found this canvas by scanning a QR code tattooed on
						a real human arm. Every drawing you make here lives
						there too, permanently inked next to everyone else's,
						for as long as the skin holds. Treat it accordingly.
					</div>
				</div>

				<ul className="rules__list">
					{RULES.map((r) => (
						<li
							className={`rules__row rules__row--${r.tone}`}
							key={r.title}
						>
							<span
								className={`rules__icon rules__icon--${r.tone}`}
								aria-hidden
							>
								{r.icon}
							</span>
							<div className="rules__rowBody">
								<div className="rules__rowTitle">{r.title}</div>
								<div className="rules__rowText">{r.body}</div>
							</div>
						</li>
					))}
				</ul>

				<div className="rules__warn">
					<div className="rules__warnTitle">If you break the rules</div>
					<div className="rules__warnList">
						<div>· Your artwork will be removed.</div>
						<div>· Your IP and device will be banned.</div>
						<div>
							· You will be{" "}
							<span className="rules__doxx">doxxed</span>
							<span className="rules__doxxNote">
								{" "}
								(joking… mostly)
							</span>
							.
						</div>
					</div>
				</div>

				<button
					className="rules__btn"
					onClick={onAccept}
					autoFocus
				>
					I understand. Let me draw.
				</button>
			</div>
		</div>
	);
}
