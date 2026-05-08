// ─────────────────────────────────────────────────────────────
//  PAGE STATE SWITCH
//
//  Change the number below to flip which page is shown.
//
//    1 → glorpglorp.gif
//    2 → Jessi.jpg
//
//  How to add a new state:
//    1. Drop your asset into  public/
//    2. Create                src/react-app/states/StateN.tsx
//    3. Register it in        src/react-app/states/index.ts
//    4. Set STATE below to    N
//
//  Cloudflare auto-deploys main, so editing this file from the
//  GitHub mobile app and committing will redeploy the page.
// ─────────────────────────────────────────────────────────────

import type { StateKey } from "./src/react-app/states";

export const STATE: StateKey = 2;
