# Pizza Physics

An interactive Neapolitan pizza material study built with TypeScript, Three.js and Vite. Drag a slice to bend the thin dough and stretch its mozzarella into tearing bridges. Includes coarse XPBD dough, convex collision proxies, seeded toppings, camera orbit and live measurements.

Live: https://pizza-physics.dustinhx.chatgpt.site

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:4173. Use a WebGPU-capable browser for the intended renderer.

## Verify and build

```sh
npm test
npm run build
```

`npm test` discovers every `tests/*.ts` file, runs each in isolation, reports every failure and exits nonzero if any test fails. To run selected files:

```sh
node scripts/test-regressions.mjs particle-ccd cheese-surfaces
```

Build output is in `dist/`. GitHub Actions runs the full suite and production build on pushes and pull requests.

Physics tests run on the CPU; passing them does not establish browser appearance or real-device GPU frame rate. The simulation is a lightweight perceptual approximation, not a validated food mechanics model.
