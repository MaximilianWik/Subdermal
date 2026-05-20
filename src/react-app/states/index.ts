import State1 from "./state1/State1";
import State2 from "./state2/State2";
import State3 from "./state3/State3";
import State4 from "./state4/State4";
import State5 from "./state5/State5";
import State6 from "./state6/State6";
import State7 from "./state7/State7";
import State8 from "./state8/State8";

// Registry of all available page states.
//
// Keys must be the same numbers used in /state.ts.
// `as const` keeps the keys as literal types so that StateKey
// resolves to a strict union (e.g. 1 | 2 | 3 | ... | 8) rather than `number`.
//
// To add a new state: import it above and add it here.
export const states = {
	1: State1,
	2: State2,
	3: State3,
	4: State4,
	5: State5,
	6: State6,
	7: State7,
	8: State8,
} as const;

export type StateKey = keyof typeof states;
