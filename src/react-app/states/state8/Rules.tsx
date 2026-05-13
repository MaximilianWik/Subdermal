import "./Rules.css";

interface Props {
	onAccept: () => void;
}

interface Rule {
	icon: string;
	title: string;
	body: string;
}

const RULES: Rule[] = [
	{
		icon: "✕",
		title: "No hate speech",
		body: "Slurs, harassment, or content targeting any group will be removed without warning.",
	},
	{
		icon: "✕",
		title: "No profanity or NSFW",
		body: "Keep it work- and family-safe. No nudity, gore, or explicit imagery.",
	},
	{
		icon: "✕",
		title: "No griefing",
		body: "Don't deface, scribble over, or sabotage other people's drawings on purpose.",
	},
	{
		icon: "✕",
		title: "No spam or impersonation",
		body: "One artist, one signature. Don't pose as someone else.",
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
						This is a shared canvas — every drawing here lives forever
						alongside everyone else's. Read this once, then have fun.
					</div>
				</div>

				<ul className="rules__list">
					{RULES.map((r) => (
						<li className="rules__row" key={r.title}>
							<span className="rules__icon" aria-hidden>
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
					I understand — let me draw
				</button>
			</div>
		</div>
	);
}
