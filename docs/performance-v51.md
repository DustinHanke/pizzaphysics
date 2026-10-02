# Performance pass after accepted v50

Checkpoint: docs/checkpoint-v50.md. No material assets, solver timestep, solver iteration counts or pizza tessellation reduced.

## Measured CPU benchmark

`node scripts/test-regressions.mjs performance` constructs six slices and a deterministic held pull, warms 30 frames, then measures 60 frames. Times include CPU simulation and mesh updates, not GPU rasterization. Instrumentation is identical before and after.

| Measurement | v50 | Optimized |
|---|---:|---:|
| Median CPU frame | 28.52 ms | 16.35 ms |
| P95 CPU frame | 41.68 ms | 23.02 ms |
| Mean slice geometry | 14.05 ms | 8.36 ms |
| Mean cheese geometry | 5.28 ms | 2.67 ms |
| Mean particle collision calls | 7.76 ms | 2.76 ms |

Stage measurements overlap (particle collisions are also included in physics), so do not sum them. Device FPS remains unverified; these are container CPU results, not iPhone FPS promises.

## Changes

- Cache sparse rest-space cheese-neck influence weights; ignore zero-force necks.
- Interpolate the coarse deformable lattice once per slice render, preserving the original skinning equations.
- Conservative whole-slice bounds reject irrelevant collision patches before the unchanged narrow-phase solver.
- Preserve extrusion UVs after initialization; expand shared bounds only for updated extension vertices.
- Upload modified ribbon slots only, and restrict indexed drawing to occupied slots.
- Reuse shadows when geometry/light positions are unchanged.
- Mobile pixel-ratio cap 1.4 instead of 1.75 (36% fewer pixels at the cap); bounded adaptive resolution reduces toward 1.0 under sustained load and restores quality when frames recover. Desktop maximum remains 1.75. Materials, maps and mesh resolution stay unchanged; rendering may be slightly softer at reduced pixel ratio.
- FPS telemetry now uses actual wall-clock frame duration instead of clamped simulation time.

## Validation

- Optimized skinning agrees within 4.5e-16 in deterministic deformation fixtures.
- 600 particle/sweep queries match the full unpruned collision traversal.
- Resolution bounds/recovery, extrusion closed topology, endpoint continuity, clumping, reset and fixed timestep regressions pass.
- GPU appearance and real-device FPS cannot be verified in this environment.
