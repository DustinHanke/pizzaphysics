# Noodle Physics — initial prototype

An independent food-physics scene built on Pizza Physics's existing TypeScript + Three.js + Vite foundation.

- Open `/noodles.html` or run `npm run dev` and visit `http://localhost:4173/noodles.html`.
- Drag either dough knob to pull. Drag empty space to orbit. Scroll to zoom.
- Click **Fold dough** or press **F** once the dough has been elongated enough.
- Click **Fresh start** or press **R** to reset. Press **C** to reset camera.
- Keyboard: focus the canvas, press **Space** to begin controlling the right knob, then arrow keys / Page Up / Page Down.

## Model

The strand is modeled as a preallocated, 33-point chain with 32 XPBD distance constraints, plastic rest-length growth, gravity, damping, and bend regularization. Constant-volume-inspired rendering uses a radius inversely proportional to the square root of total modeled rest length. The fold operation halves each strand's rest length and doubles the number of parallel strands, up to eight. Meshes reuse dynamic vertex buffers rather than rebuilding tube geometry every frame.

This is a perceptual model, not a mechanically calibrated simulation of real lamian dough. It currently lacks self-collision, real contact/knocking, true topology-aware hand folding, tearing, and flour particles. The fold button deliberately performs an assisted fold rather than trying to infer it from a drag gesture. Noodle drawing dimensions are illustrative rather than millimeter-accurate.

Reused from Pizza Physics: `createScene` (WebGPU/WebGL fallback, HDR environment, key/fill/rim lights, dynamic resolution), global editorial CSS components, and fixed-step XPBD design conventions. The existing pizza scene and physics remain separate and unchanged.
