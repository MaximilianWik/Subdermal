// ─────────────────────────────────────────────────────────────
//  PAGE STATE SWITCH
//
//  Change the number below to flip which page is shown.
//
//    1 → glorpglorp.gif
//    2 → Jessi.jpg + romantic header
//    3 → cleo.png
//    4 → redirect to REDIRECT_URL (set below)
//
// ─────────────────────────────────────────────────────────────

import type { StateKey } from "./src/react-app/states";

export const STATE: StateKey = 2;

// Only used when STATE = 4. Any absolute URL (https://, mailto:, tel:, etc.)
export const REDIRECT_URL = "https://tessera-neon.vercel.app/";
