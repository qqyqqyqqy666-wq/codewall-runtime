# Codewall Runtime

Browser-based fullscreen runtime scaffold built with Vite, TypeScript, Three.js, and MediaPipe hand tracking.

## What is currently implemented

- Fullscreen Three.js scene shell mounted from `src/app.ts`.
- Mouse and keyboard input adapters connected at app startup.
- MediaPipe Hand Landmarker initialization and per-frame hand signal extraction (`src/input/hand-tracker.ts`).
- Basic runtime scaffolding modules for glyph pooling, effects, state, and perf monitoring.

## Development

1. `npm install`
2. `npm run dev`
3. Open the local Vite URL in a browser on a secure origin (`localhost` is allowed).
4. Allow camera access if you want hand tracking enabled.

## Scripts

- `npm run dev` — start local dev server.
- `npm run build` — run TypeScript checks and create a production build.
- `npm run preview` — serve the production build locally.

## Dependency notes

- `@mediapipe/tasks-vision` is required by the current hand-tracker implementation and by Vite asset imports for MediaPipe Wasm runtime files.
- The hand landmarker model is fetched at runtime from Google's MediaPipe model bucket.
- If camera access is denied or unavailable, the app continues running with hand tracking inactive.

## Repository hygiene

- `dist/` is treated as build output and is gitignored.
- `package-lock.json` is committed to keep installs reproducible.
