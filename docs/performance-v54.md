# Desktop performance pass — v54

Baseline: published v53, c87d825ac2981043cfdcef14112bedd6cb962ff4.

The deterministic held-slice fixture (36 connections, 120 Hz physics, 60 Hz presentation) runs the same simulation before and after. These are CPU timings in the build environment, not device FPS or GPU measurements.

| Metric | v53 | v54 |
|---|---:|---:|
| Median CPU frame | 20.68 ms | 12.29 ms |
| P95 CPU frame | 30.66 ms | 21.73 ms |
| Mean slice mesh work | 10.70 ms | 3.12 ms |
| Base render vertices | 212,410 | 125,434 |

A second v54 run measured 11.14 ms median. Results vary with runtime load; the final sequential run above is the conservative comparison. Stages overlap and should not be summed.

Changes:
- Hover raycasts use existing deformed convex collision proxies, at most 30 Hz. Pointer-down retains exact detailed mesh picking and material coordinates. 120 hover queries took 3.50 ms with proxies vs 416.52 ms with the reduced render meshes; original full meshes took 663–693 ms.
- Area-weighted normal reconstruction uses contiguous numeric buffers; matches Three's result exactly in the fixture.
- Slice collision skips disjoint body bounds and disjoint patch/body pairs before entering patch-pair traversal. Bounds expand conservatively during correction. Static bodies no longer rebuild their proxies after another body moves.
- Desktop rim tessellation is 108×56 per slice instead of 180×96; cut crumb is 20×80 instead of 28×112. Shape functions, material coordinates and photographic maps are unchanged. Mobile mesh settings and the mozzarella contour/extrusion mesh remain unchanged. Very close inspection may reveal the lower tessellation.
- WebGPU requests the high-performance adapter, as the WebGL fallback already did. The browser ultimately chooses the adapter.

Validation:
- Build passes.
- Normal buffer comparison: maximum error 0.
- Eight collision solver passes agree with the original unpruned body traversal within 1e-12.
- 600 particle/sweep cases and render skinning equivalence pass.
- Boundary extrusion continuity, finite buffers, anchors, tearing, re-grabbing, reset and clumping pass.
- Pointer ownership, held orbit, pinch and capture cleanup pass.

Preserved: fixed timestep, constraint iterations, deformation behavior, materials/textures, cheese root topology, tearing and clumping, camera, Neapolitan-only controls and current layout.

Real GPU appearance and RTX 3060 Ti/mobile FPS remain unverified in this environment. Do not infer 60 FPS from CPU timings alone.
