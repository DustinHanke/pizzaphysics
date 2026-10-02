# Mobile performance profile — v52

Accepted visual/interaction checkpoint remains v50 (`89718ceb830ad1282ae045fc8d85586cc63acdc8`).

Coarse-pointer devices now use a separate render-detail profile. Desktop detail is unchanged.

- Surface vertices: 212,410 -> 81,730 in the six-slice fixture (61.5% reduction). Rim and crumb sample the same shape/material functions at fewer subdivisions; mozzarella contours and pull attachment vertices remain unchanged.
- No mobile MSAA. Pixel ratio starts at 1.0 and adapts down to 0.7 under sustained pressure, rather than starting at 1.4 with a 1.0 floor.
- Shadow map: 1024² instead of 2048²; moving shadows refresh at most 30 Hz. Static shadow caching remains.
- Keep photographic albedo, roughness, normals, environment and thickness-dependent scattering. Skip layered normal+bump evaluation and minor clearcoat/sheen on mobile; cap anisotropy at 2. Retain underlying bump textures so mozzarella regeneration remains valid.
- No physics timestep, constraint-iteration, collision, cheese density or tearing changes.

CPU fixture: median 12.16 ms compared with 16.35 ms for v51 desktop-detail fixture; P95 25.06 ms (no demonstrated P95 improvement). GPU/device FPS is unverified. Fewer pixels, no MSAA, smaller shadows and cheaper shaders target GPU load not captured in this CPU benchmark.

Mobile extrusion, clumping and seam tests passed. Rest seam maximum gap 1.13e-7. Production build passed.

Tradeoffs: somewhat less geometric microdetail in crust/crumb, softer rendering under load, possible edge aliasing, and lower shadow update cadence. UI resolution and source material maps remain unchanged.
