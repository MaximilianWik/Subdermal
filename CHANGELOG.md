# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **State 4 — redirect state.** Set `STATE = 4` and edit `REDIRECT_URL` in `state.ts` to forward visitors to any URL. Useful for repointing the QR code without reprinting it.
- State 3 — displays `cleo.png`
- Romantic stylized header on State 2 — *"I LOVE MY SMOKING HOT GF"* in Cinzel Decorative with a pink-red gradient and a soft pink glow on Jessi.jpg
- Co-located `State2.css` so each state can own its own styling
- **State-switching architecture** — single-number page state control via root-level `state.ts`
  - `src/react-app/states/` registry maps numbers to React components
  - Type-safe: `STATE` is constrained to registered keys, invalid values fail the build
  - Designed for mobile editing via GitHub app + Cloudflare auto-deploy
- `State1` (glorpglorp.gif) and `State2` (Jessi.jpg) as initial states
- `Jessi.jpg` moved into `public/`
- Image sizing rules in `index.css` so assets fit the viewport
- README section documenting state-switching workflow and how to add new states
- Initial project setup: React 19 + Vite 6 + Hono 4 + Cloudflare Workers
- Clean `.gitignore` with Node, Windows, macOS, and Wrangler entries

### Removed
- Duplicate asset folders `Assets/` and `GIF/` at repo root (consolidated into `public/`)
- Empty `src/react-app/assets/` folder

[Unreleased]: https://github.com/MaximilianWik/vite-react-template/commits/main
