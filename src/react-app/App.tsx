import { useEffect, useState } from "react";
import { STATE } from "../../state";
import { states, type StateKey } from "./states";
import State7 from "./states/State7";
import "./App.css";

// Hash-based override lets the canvas's menu navigate temporarily to
// other states (e.g. "Girlfriend <3" → State 2) without touching
// state.ts or persisting to the tattoo target. The format is
// "#view=<N>" where N is a valid StateKey. Any other value falls
// back to the canonical STATE.
function readHashOverride(): StateKey | null {
	if (typeof window === "undefined") return null;
	const m = window.location.hash.match(/^#view=(\d+)$/);
	if (!m) return null;
	const n = parseInt(m[1], 10);
	if (n in states) return n as StateKey;
	return null;
}

export default function App() {
	const [override, setOverride] = useState<StateKey | null>(readHashOverride);

	// Intro: replay State 7's "rm -rf" cinematic on every page load /
	// QR scan, then transition to the canonical STATE. Skipped when:
	//   - the user deep-links a view override (#view=N), or
	//   - the canonical STATE is already 7 (the cinematic itself).
	// Once dismissed (by completion or by any navigation), it never
	// replays inside this SPA session.
	const [introDone, setIntroDone] = useState(
		() => readHashOverride() !== null || STATE === 7,
	);

	useEffect(() => {
		const onHash = () => setOverride(readHashOverride());
		window.addEventListener("hashchange", onHash);
		return () => window.removeEventListener("hashchange", onHash);
	}, []);

	// Any navigation away from the intro (e.g. menu click during the
	// cinematic) should commit "intro is done" so coming back doesn't
	// replay it.
	useEffect(() => {
		if (override !== null) setIntroDone(true);
	}, [override]);

	const showIntro = !introDone && override === null;
	const activeKey = override ?? STATE;
	const Active = states[activeKey];
	const showBack = !showIntro && override !== null && STATE === 8;

	return (
		<div id="center">
			{showIntro ? (
				<State7 onComplete={() => setIntroDone(true)} />
			) : (
				<Active />
			)}
			{showBack && (
				<button
					className="backToCanvas"
					onClick={() => {
						if (window.history.length > 1) {
							window.history.back();
						} else {
							window.location.hash = "";
						}
					}}
					aria-label="Back to canvas"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<line x1="19" y1="12" x2="5" y2="12" />
						<polyline points="12 19 5 12 12 5" />
					</svg>
					<span>Back to canvas</span>
				</button>
			)}
		</div>
	);
}
