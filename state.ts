// ─────────────────────────────────────────────────────────────
//  PAGE STATE SWITCH
//
//  Change the number below to flip which page is shown.
//
//    1 → glorpglorp.gif
//    2 → Jessi.jpg + romantic header
//    3 → cleo.png
//    4 → redirect to REDIRECT_URL (set below)
//    5 → jonte.jpg + romantic header
//    6 → vCard "Save to Contacts" page (edit details in State6.tsx)
//    7 → rm -rf chaos cinematic
//    8 → Collaborative canvas (placeholder — D1 heartbeat page)
//
// ─────────────────────────────────────────────────────────────

import type { StateKey } from "./src/react-app/states";

export const STATE: StateKey = 8;

// Only used when STATE = 4. Any absolute URL (https://, mailto:, tel:, etc.)
export const REDIRECT_URL = "https://example.com";
