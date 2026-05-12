import State1 from "./State1";
import State2 from "./State2";
import State3 from "./State3";
import State4 from "./State4";
import State5 from "./State5";
import State6 from "./State6";

// Registry of all available page states.
//
// Keys must be the same numbers used in /state.ts.
// `as const` keeps the keys as literal types so that StateKey
// resolves to a strict union (e.g. 1 | 2 | 3 | 4 | 5 | 6) rather than `number`.
//
// To add a new state: import it above and add it here.
export const states = {
	1: State1,
	2: State2,
	3: State3,
	4: State4,
	5: State5,
	6: State6,
} as const;

export type StateKey = keyof typeof states;
