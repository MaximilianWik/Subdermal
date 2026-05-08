import { STATE } from "../../state";
import { states } from "./states";

export default function App() {
	const Active = states[STATE];
	return (
		<div id="center">
			<Active />
		</div>
	);
}
