# Multiple slices and mobile clarity

Four-slice benchmark: `PIZZA_MULTI=1 node scripts/test-regressions.mjs performance`.
Initial v54 measurement: median 53.46 ms / P95 91.23 ms. A later baseline rerun measured 42.64 / 83.62 ms; optimized measurement 23.19 / 35.16 ms. Environment load varies. These measure CPU simulation and mesh updates only, not phone/desktop GPU FPS. Network count falls from 128 to 94 because opposite sides of a shared cut no longer spawn duplicate connections.

Changes:
- Reuse existing cheese networks when their neighboring slice is grabbed. Both physical endpoints already follow their slices.
- Conservative chain bounds prune distant cheese self-contact, expanding after corrections.
- Particle collision uses eight-proxy block bounds inside each slice bound, preserving traversal order.
- Pure translations move cached collision vertices/bounds; no need to reskin vertices or rebuild face normals.
- Stop contact passes when neither contacts nor stretch limiting changed any point; retain the maximum six passes when needed.
- Intact extrusion lanes sample their common curve once per row, preserving individual width and tear behavior.
- Restore mobile antialiasing. Mobile pixel ratio starts at 1.5 and cannot drop below 1.25 on high-density screens, replacing 1.0/0.7. Lower-DPI displays remain capped to their actual DPR. This costs more GPU work than the old deliberately coarse profile; real-device performance must still be checked.

No texture, material, pizza geometry, UI or timestep changes in this pass.

Checks: build; 80-chain self-contact equivalence over five passes; no duplicate shared-cut bridges; 600 particle collision cases including block-bound bypass comparison; normal/skin equivalence; eight collision solver passes; closed extrusion roots, tears, clumping, reset; desktop/touch input; mobile geometry and resting seam continuity.

Real GPU appearance and device FPS are unverified here.
