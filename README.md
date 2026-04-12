# Codewall Runtime

Browser-fullscreen interactive code animation system starter built with Vite, TypeScript, and Three.js.

## Stack

- Vite
- TypeScript
- Three.js
- MediaPipe Hand Landmarker

## Run

1. `npm install`
2. `npm run dev`
3. Open the local Vite URL in a browser on `localhost` or another secure origin
4. Allow camera access when prompted if you want webcam hand tracking enabled

## Commands

- `npm run dev` starts the local dev server.
- `npm run build` type-checks and builds a production bundle.
- `npm run preview` serves the production build locally.

## Hand Tracking Notes

- The runtime now initializes a narrow MediaPipe hand-tracking input layer on boot.
- MediaPipe Wasm files are bundled from the installed `@mediapipe/tasks-vision` package.
- The hand landmarker model is fetched from Google's hosted MediaPipe model bucket at runtime.
- If camera access is denied, unavailable, or unsupported, the app keeps running and simply disables hand input.

## Structure

- `index.html` bootstraps the browser app.
- `src/main.ts` is the minimal entrypoint.
- `src/app.ts` composes the runtime modules and mounts the app.
- `src/scene/` contains the fullscreen Three.js runtime scene.
- `src/input/` contains mouse, keyboard, and future hand-tracking input adapters.
- `src/state/` contains runtime lifecycle coordination primitives.
- `src/glyphs/` contains glyph catalog and pooling scaffolding.
- `src/effects/` contains effect emitters and shared animation drivers.
- `src/perf/` contains lightweight performance instrumentation.
- `src/theme/` contains theme tokens and the fullscreen shell CSS.

## Current Status

- The fullscreen Three.js particle runtime remains active and browser-only.
- Mouse and keyboard input are active, and hand tracking now exposes normalized webcam hand frames for future runtime consumers.
- Gesture UX/state machines, glyph rendering, advanced emitters, and wallpaper integration are intentionally deferred.
