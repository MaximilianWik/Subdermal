import { useEffect } from "react";
import { REDIRECT_URL } from "../../../state";
import "./State4.css";

export default function State4() {
	useEffect(() => {
		if (REDIRECT_URL) {
			// `replace` so the redirect page doesn't pollute back-button history.
			window.location.replace(REDIRECT_URL);
		}
	}, []);

	return (
		<div className="state4">
			<p className="state4__msg">
				{REDIRECT_URL ? "Redirecting…" : "No REDIRECT_URL set in state.ts"}
			</p>
		</div>
	);
}
