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
//    7 → rm -rf chaos cinematic (with /public/glitch image flashing)
//    8 → Collaborative canvas — huge shared world canvas with full
//         drawing tools, pan/zoom, signature/metadata, admin moderation
//
// ─────────────────────────────────────────────────────────────

import type { StateKey } from "./src/react-app/states";

export const STATE: StateKey = 4;

// Only used when STATE = 4. Any absolute URL (https://, mailto:, tel:, etc.)
export const REDIRECT_URL = "https://www.instagram.com/wikstrom.jens?igsh=bXU2bnZwYXRtbmtw";
