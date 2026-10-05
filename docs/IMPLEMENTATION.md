# Pizza Physics — implementation notes

## Reference review

The requested `/reference/sweet-twist/` source directory was not provided. The Claude artifact could not be retrieved. No reference files were modified and no claim is made to have inspected its renderer or physics. Architecture was implemented independently from the supplied brief.

## Simulation

- All six slices may be grabbed; one constraint is active at a time. A damped off-center spring applies force and torque. Release preserves linear and angular velocity.
- 120 Hz fixed updates with six-step catch-up cap; frame deltas cap at 50 ms.
- Seven support points approximate tabletop collision. Bounds cap velocity and translation. This is a lightweight rigid-body approximation, not a general collision engine. Slice-to-slice collision is not modeled.
- Interior vertices bend with a damped scalar mode, weighted down to zero near the stiff outer crust. Attached basil follows the deformation. Surface normals update after deformation.
- Separation creates eight strands per slice along two cut boundaries, anchored to adjacent slices. Each has ten Verlet particles, seven PBD relaxation passes, viscosity, gravity, separate thickness and breaking-distance variation. Both ends follow deformed local surface anchors.
- Each strand renders as two reusable Catmull–Rom tube buffers. A broken middle constraint allows both halves to recoil; the broken halves retract and fade over approximately 1.6 seconds. Rendering uses a minimum intact radius before the broken fade.
- Temperature and the six property controls feed the same simulation. Presets reset the specimen and change those parameters. Reset is available at any time.
- The shape is a 312 mm pizza at the display calibration of 60 mm per scene unit. Longest strand reports endpoint separation; stretch reports separation / initial strand rest length. Deflection is a visual estimate derived from the bending mode, not a measured crust strain angle. Physics timing is CPU simulation elapsed time, not GPU time.

## Rendering and input

Procedural geometry and seeded procedural material textures, no downloaded pizza model or paid assets. WebGPU is attempted where available, with Three.js WebGL fallback. Soft directional shadow maps and ambient studio lighting. WebGL also uses a room environment for reflections. No default camera orbit or drift.

Pointer raycasting captures the local grab point. A camera-facing plane defines the 3D target, with progressive lift along pull distance. Pointer cancellation, capture loss, blur and tab hiding release the constraint. The canvas owns touch gestures; controls remain separately scrollable. Keyboard: focus canvas, Space to grab/release, arrows to translate, Page Up/Down to change height. R resets. Reduced-motion preferences increase damping.

## Boundaries

This is a perceptual material study, not a validated food mechanics model. Reconnection of snapped cheese and topping collisions are intentionally omitted. No GPU timing is fabricated. Physics tests cover slow pulls, fast motion, staged failure, release, reset and parameter extremes. Visual and physical-device performance must still be checked in the target browsers; no device-specific 60 FPS guarantee is made.


## Neapolitan refinement

The original full cheese layer is replaced with contour-clipped, globally continuous mozzarella pools. Seeded ellipse fields with edge distortion give true geometry gaps; their coverage measures approximately 55% of the inner disk, leaving broad tomato regions. The dough base is 0.07 scene units thick (4.2 mm at display scale), with a separate sauce layer. Four curled basil leaves remain.

The cornicione uses periodic low-frequency fields for its irregular width and height, an inflated dome, flattened underside, and sparse local blister displacement. Closed dough cut faces match the rim shape. A wrap-safe 2048 × 512 crust material adds clustered multi-scale char marks over pale, toasted dough, with distinct roughness and pore-height textures. Sauce has its own deep-red color, height, and wetness maps. Mozzarella pools have warm ivory color and subtle surface variation. Studio light intensity is reduced to preserve the red sauce and baked tones.

Strands start at radii of 0.078–0.133 scene units, versus 0.021–0.035 previously. A slower 0.32-power thinning law, strain-driven necking, and wider flattened root sections avoid hairline wires. Parallel-transported frames prevent the oval cross-sections from flipping during a pull. Break thresholds remain independent; broken constraints shorten more gently, with damped recoil and a longer fade. Attachment searches favor existing cheese pools along each cut boundary.

Validation: type check, production build, existing slow/fast-pull and preset stress checks, four-leaf count, topping coverage, finite geometry buffers and surface normals. The refinement was not visually verified in a browser in this environment.

## Subsurface scattering and noise bump pass

- WebGPU (including the node renderer's WebGL backend) uses Three.js `MeshSSSNodeMaterial` with warm, thickness-weighted single-scattering approximation. The classic WebGL renderer receives an equivalent physical-lighting shader extension. This is a real-time translucency approximation, not volumetric path tracing; no glass transmission or emissive glow is used.
- Mozzarella pool height controls a vertex thickness attribute. Strand cross-section thickness updates the same attribute as it narrows; thinner regions scatter more. Albedo modulation suppresses scattering on black char. Dough scattering is mild, crust weaker still.
- Multi-octave height noise adds pores to dough, finer detail to mozzarella and sauce, and a subtle strand surface. New strand UVs provide continuous bump mapping along the pull. Height maps remain in linear data space, with mipmaps and repeat wrapping for the tileable maps.
- Checked: production type/build, node-material construction, WebGL shader hook insertion, per-vertex thickness coverage, finite strand UVs and thickness buffers. GPU compilation and the visual appearance have not been verified in a browser in this environment.

## Stronger overall material response

Scattering strength is increased across dough, crust, mozzarella pools and strands, with a small sauce response added. The forward-scattering lobe is broader and the low ambient scattering term is stronger. Char remains albedo-masked.

All five food materials now receive explicit tangent-space normal maps derived from broader height gradients, plus increased fine bump strength. Normal textures use linear data space and retain the source UV wrapping/repeats. The node renderer explicitly combines its normal-map and bump perturbations; the classic WebGL shader applies bump after tangent-space normal mapping. This avoids Three.js's default normal-map precedence silently disabling the bump contribution. Cheese/strand normal scales remain below crust/dough scales.

Validation: type check, production build, node material normal-layer construction, classic shader layer insertion and existing thickness/UV checks. Browser visual verification remains unavailable.

## Finer normals, stronger scattering, airy cornicione

- Normal detail now uses a tileable fine-noise source at four times the UV frequency, with normal strength reduced to about 40% of the previous values. Broad blister bump remains separate from the smaller micro-normal layer.
- Increased SSS on every existing food surface; added mild green translucency to basil with per-vertex thickness and preserved vertex colors.
- Fourteen irregular, localized gas pockets change the cornicione's height, width and crown shape. Four flattened regions interrupt the inflated contour. Placement, spread and rise vary independently; the silhouette is continuous across slice boundaries.
- The matching cut faces use a pale porous crumb material with irregular fermentation pockets and warm scattering. These pores are texture/bump detail rather than volumetric holes.
- Type/build, fixed-step physics regression and material setup checks passed. Visual verification in a browser remains unavailable.

## Closed mozzarella web refinement

The renderer now draws each intact load-bearing strand as one continuous closed sweep. Perimeter vertices share indexed edges; rounded end domes close both ends without flat tube lids. On failure it switches to two closed tear volumes following the existing recoil particles. The initial strand hierarchy is three thick primary volumes and five slimmer secondary volumes, with wider, flattened roots and narrower, irregular centers.

Four diagonal secondary filaments link neighboring strands. Four thin near-root membranes connect selected pairs on the lifted slice and remaining pizza. Each membrane has front and back faces plus a sealed perimeter. Its scalloped free boundary and varying thickness approximate stretched molten sheets. Branches have damped particle motion and independent failure thresholds; membranes retract toward a surviving boundary and thin before removal. Filaments and membranes visually intersect at their attachments; they are individually closed surfaces rather than a boolean-unioned global mesh.

Telemetry now counts the eight principal strands plus four diagonal branches. Membranes are not counted as strands. Reset disposes every branch and membrane.

Validation: all 32 generated strand/branch/membrane mesh variants have exactly two consistently oriented incident faces per indexed edge (zero open edges). Finite position, normal, UV and thickness buffers checked. Intact/broken visibility transition, rounded broken ends, complete disposal, slow pull, fast movement and all presets passed, along with the production build. Browser visual/performance verification remains unavailable.

## Photo-reference crust and underside refinement

Used the five supplied pizza photographs/diagrams as shape and material references. The crown now transitions from pale lower sides to concentrated golden toast and leopard marks. Increased broad outline asymmetry and an outward-leaning dome complement the existing localized air pockets and collapsed sections.

The dough bottom and lower cornicione now share a dedicated oven-floor material in continuous global XZ UVs (channel 1). Its dry golden surface combines broad contact bake patches, irregular dark flecks, flour variation, subtle relief and fine normals. It is distinct from the pale cut edge and wet sauce/cheese above. Thin-center scattering is stronger and warmer than the rim; dark patches remain albedo-masked. The original closed dough layer is retained with explicit material groups, rather than overlaying an extra bottom disk.

Cut cornicione faces now have recessed, irregular fermentation cells driven by the same field as their texture. Their perimeter stays joined to the exterior skin, with larger soft cavities and thin pale walls between them. These are closed sculpted recesses, not a full volumetric crumb simulation.

Validation: production build and type check; downward underside winding and complete material group coverage; finite relief, normal, UV and thickness buffers; existing fixed-step pull/release/preset and closed cheese-surface regressions; both renderer material setup paths. Browser-rendered appearance remains unverified in this environment.

## Reference-matched thin mozzarella webs

Compared the supplied prototype screenshot with five cheese-pull references. Removed the large persistent attachment flares: principal strand radii are now 0.062–0.085 world units, secondary radii 0.016–0.030. Both body and root shrink by inverse square root of stretch. Roots are only 18–30% wider before a small lateral flattening, with a short rounded closure buried in the attachment. Fine diagonal links receive the same reduced flare treatment.

Replaced four short, thick root patches with four full-length thin films. Each film has three varied elongated tear apertures (some may merge), contour-clipped into indexed geometry. Front, back, outer perimeter and every hole boundary form closed solid surfaces. At rest the maximum total thickness is below 0.014 world units (0.84 mm at the scene scale), decreasing with stretch. Particle-chain motion drives film curvature and lag; small folds vary across each sheet. Broken films retract toward a surviving strand. Reduced strand micro-bump and normal amplitude to keep the thin films soft. Main snapping and recoil remain unchanged.

Validation: production build/type check; existing slow/fast pull, release and preset regressions; all strand/web closed-edge checks; actual through-hole topology and 22–65% film coverage; bounded root/body width, root thinning under stretch and thin-film thickness. Browser visual comparison remains unavailable, so visual equivalence to the photographs is not claimed.

## Varied crumb pores in bump shading

The user-provided cut-crust screenshot showed conspicuous equal-size cavities in rows. Replaced that grid field with four independently seeded crumb atlas variants: four large irregular alveoli, rejection-packed medium cells and fine pores. Size, rotation and shape vary across scales. Warm color shading and a matching bump map supply cavity depth, while fine grain breaks up the pale walls.

Removed all pore-driven cut-face vertex displacement. The exposed section now remains smooth and planar, with UVs confined to its atlas tile. Removed small localized outer-rim mesh bumps as well; existing broad inflation and collapse fields still shape the silhouette, while smaller baked blisters remain in the crust bump texture. This deliberately uses shading rather than geometrically hollow crumb.

Validation: inspected a generated cavity-field preview for size and spacing variation; production build/type check; planar cut-face and atlas-boundary checks alongside the existing physics regression. Full browser shading remains unverified.

## Full refinement: seeded pizza, collisions, flex and orbit

### Materials and light

A per-pizza unsigned seed is generated once at page load. `?seed=12345` reproduces it; the canvas `data-seed` and development debug object expose the selected value. The seed drives dough shape, a weighted range of air pockets, cut angles, mozzarella pools, basil transforms, browning and crumb/underside textures. Reset restores this pizza while the pull counter continues, so successive pulls have different topology. Reload without a seed generates a new pizza.

The crust map now uses seamless, clustered value noise at several scales rather than stamped oval spots. Raised regions probabilistically influence the bake mask. Small pores stay in bump/normal maps. Mozzarella has graded warm edges matching the actual pool field, patchy browning and selective oil highlights. Basil has restrained vein relief and varied scale/tilt. Mozzarella islands now include a back surface and sealed contour walls.

Stronger approximate single scattering is present in both renderer paths. Local thickness varies across thin centers and inflated crust skin; the surface albedo attenuates scattering in browned and charred regions. This is not volumetric path-traced SSS. Filmic exposure is fixed. WebGPU now receives a prefiltered RoomEnvironment as well as WebGL. Reduced front fill, warm backlight and a weak lower bounce preserve shape and underside visibility. Environment and all lights stay in world space. In development `?debug`, `pizzaLighting` exposes environment intensity/rotation, key intensity/position, exposure and an SSS multiplier.

### Dynamics and collision

Each slice has three deforming thin dough prisms and three rounded convex crust sections. Broad-phase boxes precede a separating-axis narrow phase. Four contact iterations apply soft positional correction, relative normal impulses and limited angular response. The table and other slices therefore support released pieces. The contact slop is 0.006 world units (about 0.36 mm at the displayed scale).

Cheese nodes collide as small spheres against the same proxies. Swept tests cover fast motion through thin dough; segment midpoints provide additional strand coverage. Separate chains and local branches receive soft self-contact. Thin web vertices are projected out of the proxy surfaces while their motion follows the simulated chains. This is a lightweight approximation: it does not solve continuous triangle collisions or a fully coupled volumetric cheese/dough system.

Bend and torsion are damped modes driven by lift, gravity, acceleration and temperature/stiffness. The tip has the largest weight and the crust remains comparatively stiff. Motion excites wobble; there is no idle shaking. The drag spring retains linear and angular inertia.

Pulls now have 2–4 primary connections, a varying number of thinner connections and up to four local branches/membranes. Weighted anchor sampling favors actual mozzarella pools and avoids far-away neighboring slices. Counts, clustering, widths, holes and strengths are generated once per pull. Primaries have higher failure thresholds; failures add load to survivors. The existing closed sweeps, sealed membrane hole walls, thinning, progressive failure and recoil remain.

### Camera and input

A pointer that starts on a slice owns the slice drag until release. Empty-space drag or right drag orbits; Shift/middle drag pans; wheel zooms. Touch supports empty-space orbit and two-finger pinch/pan. Damped radius and pitch limits permit an underside view without flipping the camera. The target gently follows a lifted slice; camera transforms never write to the physics state.

`HOLD SLICE` / H keeps the spring target suspended on release, allowing inspection from other angles. Turn it off to release. `RESET VIEW` / C animates back to the default framing. The existing specimen reset and presets remain. Camera controls are confined to the canvas.

### Verification and limitations

- Build/type check and classic shader injection/node-material construction checks.
- Slow and fast pull, gravity/release, preset, finite-buffer and closed-cheese regressions.
- Slice drop, stack and forced-contact tests: residual penetration approximately 0.006 world units.
- Swept cheese contact crosses neither the thin base nor the floor in the targeted test.
- Twelve consecutive pulls produced twelve distinct, stable configurations.
- Bend/torsion settle after movement; orbit leaves physics transforms and targets unchanged.
- Pointer ownership, held-slice orbit, right drag, pinch zoom and capture cleanup checks.
- Procedural texture generation and inspection of the crust color map. Cached cheese-field sampling and appropriately sized maps reduce startup work.

The supplied reference photos were inspected, but the managed browser-control skill remains unavailable. Full browser appearance, actual GPU shader compilation, touch behavior on hardware and rendered FPS have not been verified. The passing CPU tests are not a claim of photorealism or measured browser frame rate.

## Deformable dough and realism pass (supersedes the scalar-bend implementation)

The thin center now uses a 31-particle world-space XPBD-style sheet, with stretch/shear links, compliant second-neighbor bending links, strong velocity damping, and a smooth stiffness gradient toward the crust. Only the outer ring is pinned to the cornicione frame. High-resolution dough, underside, sauce and mozzarella sample precomputed interpolation weights; local surface normals preserve layer thickness while folding. Basil follows the local position and orientation. Deformation is interpolated between fixed physics steps for rendering. This is cooked-dough behavior, not a general-purpose fabric solver.

Crust grabs retain the weighted rigid spring. A grab in the soft center constrains only nearby sheet particles; their constraint reactions transfer force and torque into the crust. Unsupported regions continue falling under gravity. Ray hits recover rest coordinates using barycentric interpolation on the hit render triangle, allowing a folded slice to be re-grabbed. Stretch limiting prevents fast pointer motion from turning the sheet into rubber.

Collision now uses the coarse triangular sheet patches and thicker cornicione proxies. Flexible contacts move nearby particles, rather than translating the entire slice. The outermost dough band remains comparatively stiff. Sphere/swept particle contacts, local triangle-contact correction and table friction are solved at 120 Hz. Settled pieces sleep and wake on interaction/contact; untouched pieces remain static. Tiny secondary cheese fibers reduce visual buffer-update frequency when sub-pixel, without changing physics with the camera. Late snapped fragments stop integrating before disposal.

Cheese anchors follow the deforming surface. Intact strands apply limited opposing force locally to the sheet and its crust; broken connections stop resisting. Small surrounding mozzarella regions form a pulled neck at each attachment. Membranes are now short, offset, asymmetric perforated patches rather than full-length parallel curtains. Closed fronts, backs, hole walls and rounded strand ends remain. Primary strand cross-sections are more volumetric, and late necking is stronger. Topology is still generated once per pull from the pizza/pull seeds.

Pizza rendering changes: reduced mozzarella coverage with fewer oversized merged pools; thinner resting cut gaps; varied cornicione cross-sections and rare localized silhouette blisters; clustered baked spots with brown transition halos instead of dominant broad dark smears. The separately generated flour/bake underside remains. Richer red sauce, less sauce scattering, lower fixed exposure and substantially lower environment/fill intensity restore color separation and directional form. The procedural crust map was inspected; approximately 7.8% of its upper texture falls in the dark-char range for the regression seed.

Mobile now has an independent 3D stage between the header and live measurements. Measurements, collapsible material properties, specimen selector and controls flow below it. The caption stays at the stage bottom and disappears on interaction. Canvas dimensions follow the stage via ResizeObserver; camera framing leaves additional pull space and gently widens for large pulls. A second touch during a slice grab freezes its target while the two fingers control the camera; releasing the gesture releases the slice unless HOLD is enabled. Telemetry defines 0% as rest extension and uses unpadded strand counts.

Verification includes: local obstacle draping with approximately 1.1% settled edge extension in the targeted hanging test; layer-thickness preservation; basil orientation; folded-surface re-grabbing; drop/stack/forced-contact checks; progressive cheese failure; closed mesh edge/winding checks; preset stress and finite buffers; equivalent 30/60/90/120 Hz trajectories; sleep/wake; pointer ownership and pinch cleanup; WebGL shader injection and WebGPU material construction. Production type checking/build is also required before publication.

Limitations: collision uses soft simplified proxies, not continuous full-mesh collision; the crust backbone remains a rigid frame; rendering interpolates sheet deformation, not every rigid transform. SSS remains an albedo/thickness/direction-dependent single-scattering approximation. The required managed browser-control skill is unavailable, so full orbit-angle visual inspection, actual GPU shader compilation, device touch feel and hardware FPS have not been verified. CPU/geometry checks are not a claim of final photographic realism.

Final regression results for the seeded fixture: maximum measured stretch ratio 1.122 during extreme preset stress runs; local hanging stretch ratio 1.011; residual proxy penetration 0.006 after drop, 0.012 after stacking, and 0.029 under forced contact. All six regression suites and the production build passed. These are CPU simulation measurements, not browser performance measurements.

## v12 — thin dough, finite pulls and stable framing

This pass responds to the updated full-refinement brief and IMG_9170/9171. The existing graphic design, presets, protected mobile viewport, orbit ownership and deformable solver are preserved.

- The dough center is now 1.5 mm at the existing 60 mm/unit scale, with a gradual shoulder rise. Sauce and mozzarella layers, neutral simulation plane, surface anchors, SSS thickness and deforming collision proxies follow the revised proportions. Shared small cut-edge variation avoids mechanically straight center cuts.
- Cornicione cutaways contain bounded inward recesses for larger crumb cavities. Their perimeter remains sealed against the rim; fine pores remain bump detail. This supersedes v11's flat cutaway decision, following the newest brief. Cavity bump is reduced to avoid doubling the geometric relief. Sauce has weaker clearcoat/specular wash.
- Cheese now accumulates irreversible damage above an individually seeded yield length, with a hard extension limit. Secondary fibers and membrane bridges fail sooner; surviving primaries take additional load. A seeded local neck becomes thin before failure, then divides into two closed, damped fragments. Volume-like thinning and small attachment flares remain. Less excess particle-chain slack reduces knots. Local opposing forces are stronger while strands survive.
- Pointer displacement approaches a soft maximum smoothly. Camera target bias is capped at 0.42 world units and automatic pull framing only moves outward, by at most 1.65 units. Explicit orbit/zoom remains available.

Validation: production TypeScript/Vite build; closed volume/winding/holes tests; localized neck regression; fixed-step equivalence at 30/60/90/120 Hz; mobile pointer ownership and pinch; deformation, topping orientation and thickness tests; collision/drop/stack/push tests; preset stress tests. The integrated crust-grab test holds still for three seconds and measures approximately 0.79 world units of extra gravitational sag, with about 0.053 units of grab error. A gradual reference pull decreases from seven connections to four, three, two and zero; secondaries fail first. Sustained above-yield tension also fails without further movement. These are solver measurements, not GPU frame-rate measurements.

Browser/GPU visual inspection remains unavailable because the required control-browser skill is absent in this environment; the Sites preview instructions do not permit substituting another browser automation route. Orbit screenshots, WebGPU shader execution and device FPS are not claimed as verified. Material realism still requires visual review on the published experience.

## v13 — baked crust and wet tomato material pass

Preserves UI, framing, lighting, mozzarella, physics and presets. Crust baking now layers broad wheat/gold regions, meso-scale caramel mottling, fine pores, flour and softly graduated brown-to-char leopard marks. Exposure uses crown orientation, inner/outer rim direction and seeded rim height; sheltered regions stay cream. Roughness distinguishes dry flour, smoother baked skin and matte char. Fine normal and bump detail are correlated with the crust texture and reduced in amplitude to retain inflated bread form.

Sauce uses correlated pulp, water and oil fields for deep tomato color, tiny surface relief and effective roughness approximately 0.22–0.49 (scalar 0.50 multiplied by its linear roughness map). Metalness is explicitly zero; IOR 1.4 and modest clearcoat supply dielectric wet highlights. A normal map sampled in the same coordinates as the pulp bump replaces unrelated repeated cheese noise. The hand-spread boundary varies by angle, tapers to 0.001 world units, and receives only 0.003 units of extra height variation. Layers remain closed and use the existing deformation mapping.

Fixed WebGPU SSS conversion dropping IOR, metalness and specular settings. Both paths now preserve the source material's dielectric response. Verified texture generation/opacity, effective sauce roughness, zero metalness, TypeScript/Vite build, WebGL shader injection and WebGPU material-property construction. Inspected generated crust and sauce color maps. GPU lighting and final rendered appearance remain unverified due to the unavailable required control-browser preview capability.

## v14 — adjustable mozzarella amount

Added MOZZARELLA AMOUNT (0–200%, default 100%) to the existing Material Properties slider stack. Physics specimen changes preserve this independent amount setting. A stable per-pizza bank of 43 irregular pools is progressively revealed, with modest size growth and a fractional final pool. At 100% the original 25-pool classic distribution is retained. Contour extraction continues to produce real separate volumes and naturally merged pools; there is no global white overlay.

Updates debounce for 120 ms during slider movement and apply on release. Only cheese geometry and its color/bump/roughness images rebuild. Existing texture identities survive so WebGPU scattering nodes update correctly. Old cheese geometry is disposed, raycast ownership is restored, locally anchored basil updates height, and slice deformation/transforms remain intact. Existing pull networks clear when their source material changes; remote detached slices do not acquire connections across empty space. Live metrics then report the actual regenerated network.

Pull candidates now require mozzarella at both actual boundary anchors. Sauce-only candidates are rejected entirely. Amount increases potential primary/secondary counts, branch and membrane probability, and captured connection strength. Anchors remain separated and membrane count stays capped at three per pull. Zero amount produces no visible mozzarella triangles or pull connections.

Validation: build; closed cheese-volume regression; amount tests at 0/65/100/160/200; every sampled anchor checked against the cheese field; deformation/transform preservation and old geometry disposal; GPU texture-identity refresh. For the deterministic test seed, coverage was 0/30/40/54/67%, and average direct strands across 18 varied pulls were 0/3.8/4.8/7.9/9.7. These are fixture statistics rather than universal per-pizza targets. Browser visual verification remains unavailable under the existing preview constraint.

## v15 — uneven baking, fine wet highlights, rounded mozzarella

Preserves dough/crust geometry, camera, input, physics solver and graphic layout. Broad periodic baking fields now span several large regions around the rim, with cream/wheat/gold/caramel variation and less uniform orange. Spot gradients start outside the brown core, have warped boundaries, and reserve the darkest tone for very small centers. Crust micro-bump/normal amplitude increases modestly without silhouette displacement.

Sauce effective roughness measures 0.20–0.44 in the fixture, metalness remains zero, and correlated pulp microdetail is stronger. Reduced clearcoat, water-like IOR and lower sauce scattering limit broad milky highlights; color-map values remain entirely tomato hues and are not derived from roughness. Final highlight appearance still needs browser visual review.

Mozzarella height now uses a smooth saturating mound instead of a clamped plateau, with fine folds/waviness and a thinner 0.002-unit melted perimeter. Closed contour geometry and actual-field anchors remain. The user's latest requested range replaces v14's range: 50–200%, default 100%, clamped in the shared amount setter as well as the UI. Extra cheese also enlarges initial membrane spans slightly, alongside existing density/branch/strength changes.

Verified production build, texture generation and roughness/metalness bounds, amount/anchor/coverage behavior, closed cheese surfaces and texture-identity refresh. Inspected the generated crust map. Runtime rendered appearance and GPU performance remain unverified under the existing unavailable-browser-preview limitation.

## v16 — independent mozzarella placement seed

Material Properties now includes a numeric MOZZARELLA SEED (0–999999) and SHUFFLE button. The default 0 preserves the current pizza's original placement. Seed changes regenerate the existing seeded pool bank and refresh cheese contours, textures, local topping height and pull eligibility through the same amount-update path. They preserve mozzarella amount, crust/baking seed, slice transforms, camera and physics properties. Reusing a mozzarella seed reproduces its placement on the same pizza. Desktop properties become scrollable on short viewports; the mobile panel remains below the interaction viewport.

Validated production build, deterministic seed restoration, placement changes, unchanged rim/amount, and the existing amount/anchor/coverage and mesh-replacement checks. Browser visual QA remains unavailable as previously documented.

## v17 — pulled-state cheese web and softer slice

Preserves the intact pizza, materials, controls, and layout. Pull topology now favors a sparse, varied network: the deterministic reference pull begins with five connections, with fewer primary paths and secondary fibers rather than a row of evenly spaced cables. Every strand receives independent thickness, curvature, lateral offset, sag, and strength. Closed strand meshes taper strongly from each mozzarella attachment through a fine central neck; thinner strands yield earlier. The existing fixed-step particles gain more gravity response and slack under extension, making long connections bow below the direct endpoint line.

Web bridges now begin close to their mozzarella source. Their independent damage narrows and contracts each membrane progressively, revealing its existing holes and leaving the strands to carry the remaining pull. Broken strands retain the existing damped recoil and closed fragment ends. Slice bending compliance is increased while stretch limiting and strong damping remain; deformable dough collision receives additional solver iterations. The sauce and cheese are lowered together over the thin center, and the visible sauce edge tapers to a very thin coating instead of a thick red wall.

Verification: production build and focused regressions for progressive strand failure, closed/tapered strand surfaces, deformable slice sag, layer thickness, collision, mozzarella amount/attachment validity, pointer interaction, and fixed-step timing. Browser appearance, GPU execution, touch hardware, and rendered frame rate remain unverified under the existing preview limitation.

## v18 — continuous resting pizza and physical cut release

Removed the independent angular insets from the dough, sauce, mozzarella, cornicione, crumb cutaways, flexible sheet and collision proxies. All slice sectors now use their exact shared boundary. The cut-edge perturbation is periodic at 0/360 degrees, so the final seam uses the same geometry and noise as every other join. Resting meshes share global object-space texture coordinates; matching normals are averaged across coincident cut vertices. Normal welding runs only for slices in their home pose, so a moving slice reveals its real cut faces. The toppings remain driven by the shared world-space sauce and mozzarella fields.

Reduced collision restitution to a soft damped response, preventing contacts from adding energy to a lifted slice. Dough deflection telemetry now reports the angle implied by actual center droop over the slice span. Crust color variation shifts from a uniform orange-gold toward wheat, toasted gold and caramel while preserving the current blister pattern and underside treatment.

Validation: production build; a new six-slice geometry regression confirms aligned dough/sauce/mozzarella/crust edges to under 0.0001 world units, aligned resting normals, and a visible gap after slice displacement. The held-slice test reports 0.79 units of center sag with zero measured drift in the other five slices. Existing cheese, collision, drop/stack, reset, amount/anchor, input and fixed-timestep tests were also run; hardware rendering and browser visual QA remain unverified.

## v19 — subdivided blister-form cornicione

The crust remains the same diameter and keeps the current thin center and slice logic. Its parametric cornicione mesh is sampled at 180 circumferential by 96 cross-section subdivisions per slice. A seeded field of 76 overlapping medium blisters plus sparse folds now displaces the actual crust surface and affects both its height and outer profile. Broad low-frequency rim lobes, varying cross-section width/height, crown flattening, leaning and collapsed spans break the continuous hose-like silhouette without replacing the existing scene or interaction.

Leopard marks are fewer than the preceding version and most are positioned near the generated blister field. The crust material samples that same field and actual rim height, increasing bake exposure at raised forms while leaving sheltered and recessed areas lighter. The texture's top-side mask now follows the rim's parametric orientation. No extra geometry noise was added to stand in for shape.

Validation: production build; deterministic form checks for width, height and silhouette variation; 17,557 cornicione vertices per slice; fixed-step physics and progressive cheese-break regression; resting seam alignment and displaced-slice gap regression. Browser-rendered appearance and device performance remain unverified under the existing preview limitation.

## v21 — rebaked golden cornicione

Corrected the crust palette so its common bake range is warm wheat and golden beige instead of pale ivory. The low-frequency bake field transitions from lighter sheltered folds through toasted yellow-gold to caramel; existing leopard marks keep their graduated brown-to-char centers. Roughness now varies more clearly between dry flour, smooth blister crowns and matte char. The underside material remains separate and the sauce, center, dimensions, physics and interaction are unchanged.

Raised the seeded blister geometry from a few-millimeter relief to a mostly modest field with rare larger domes. These forms and the existing broader lobes/folds are sampled by the same world-space fields across every resting slice seam. The crust bake lookup is cached at 384×128, avoiding per-texel resampling of the geometry field.

Validation: production build; deterministic cornicione form/subdivision check; full physics and progressive cheese-failure suite; resting seam alignment and open-slice-gap test; `git diff --check`. Rendered appearance and device frame rate still need browser/hardware review.

## v22 — scanned baked-dough crust surface

Preserves the v21 cornicione silhouette, lobes, dents, subdivision, crumb, pizza dimensions and slice/physics behavior. Replaced the dominant synthetic crust albedo with a continuous 360-degree baked-skin scan derived from the user's supplied Neapolitan pizza reference. Its narrow photographic crop is unwrapped around the whole rim, seam-blended, and blended beneath the geometry-aware thermal palette so the reference's real pores, flour, blistering and leopard marks contribute without importing sauce, basil, or plate color into the crust. The existing blister/exposure field still drives broad browning and sparse extra spots; pale procedural speckle was removed from albedo.

Derived a restrained high-pass scan detail for the crust bump/normal layer and added dry-skin roughness variation. The same crust material now covers the cornicione crown, sides and underside, with a distinct procedural contact-bake pattern on the underside half. Slice seams retain globally continuous angular coordinates. Sauce, mozzarella, basil, lighting composition, UI and physics are unchanged.

Validation: production TypeScript/Vite build; deterministic cornicione subdivision/form checks; resting seam alignment and displaced-slice gap regression. GPU-rendered material appearance and hardware performance still need browser/device review.

## v23 — high-heat blister and color pass

Uses the latest supplied Neapolitan pizza image as the thermal reference. Preserves the main cornicione silhouette, pizza scale, crumb and all interaction systems, with only restrained mid-frequency cross-section variation added to the rim so neighboring spans flatten, swell and pinch slightly differently. Browning now varies across a broader wheat-to-caramel base, includes a denser mix of sharp and soft leopard marks, and biases the larger/darker blisters toward the existing relief geometry. Very dark centers are limited to a small subset of spots; sparse dry flour traces and matte roughness variation break up the baked skin. The same global angular UVs remain continuous across slices, with the scanned skin detail retained on the inner wall.

Validation: production build; cornicione width/height/subdivision checks; resting seam and displaced-slice gap regression; `git diff --check`. Rendered appearance still needs browser/device review.

## v24 — coordinated crust, tomato and mozzarella reference materials

Uses the September 30 14:30 supplied reference for the three exterior food materials. A new 1536×192 narrow baked-skin strip replaces the previous crust photograph crop. It contains only the outer cornicione, with the source's real flour, grain and clustered oven blisters; toppings, background and branding are excluded. A seed-derived angular offset and the existing geometry-aware bake field vary its application while keeping global coordinates continuous across resting slices. The photo blend now retains low-chroma dark blister centers, which the previous chroma gate had incorrectly discarded. Wheat/cream, golden beige and caramel ranges replace the more consistently orange base. The photographed strip fades into the lower contact-bake surface rather than ending at a hard material boundary.

Tomato and mozzarella receive a compact 256×128 high-pass detail atlas extracted from isolated tomato-pulp and creamy-cheese regions of the same reference. These are photograph-derived surface cues, not measured/scanned PBR maps. Their broad lighting and photographic color are removed; rotated, warped samples drive restrained microrelief. All albedo, roughness and normals are baked into the existing global 512×512 surface maps. Seed-stable noise/detail is cached once, reducing amount/placement refresh work without changing distribution or physics.

Sauce uses richer red-to-red-orange colors with separate pulp/water/roughness masks and zero metalness. Effective roughness in the deterministic fixture spans 0.21–0.42. Mozzarella has creamy opaque centers, warmer thinner perimeters, sparse toast and localized whey/oil sheen; effective roughness spans 0.28–0.47. Its normal now derives from its own thickness-masked surface detail instead of generic repeating strand noise. Amount and seed changes refresh albedo, bump, roughness and normal images while retaining all four GPU texture identities. Scattering strengths/tints for crust, tomato and cheese are tuned to retain material separation and thickness-dependent backlighting; the light rig and exposure remain unchanged.

Validation: production TypeScript/Vite build; generated albedo/roughness/normal inspection; dielectric and roughness bounds; no white/desaturated tomato pixels; restrained normal amplitudes; changed pool maps and preserved GPU texture objects after an amount/seed update; amount/coverage and mozzarella-only pull-anchor regression; resting seam and lifted gap regression; `git diff --check`. The texture refresh fixture measured 184 ms in the local CPU run, not a browser/device performance claim. The supervised preview runs, but its exact browser route is blocked by the environment. GPU-rendered appearance, orbit views and frame rate remain unverified.

## v48 — boundary extrusion corruption repair

The v47 extrusion replaced attributes on the same BufferGeometry while Three's WebGPU RenderObject caches its attribute bindings. It also left collapsed indexed strips behind after disposal, scaled the far boundary away from the target, deformed already-deformed anchor coordinates twice, and allowed appended faces to index past the slice's rest-position buffer during grabbing.

Primary extensions now have an explicit lifecycle in `BoundaryExtrusion.ts`. Adding/removing an extension replaces the entire geometry and disposes the previous allocation; live vertex buffers and tearing index capacity remain fixed between topology changes. Removal repacks surviving extensions; final removal restores the exact original index list and vertex count. Roots reuse actual surface vertex IDs and open the corresponding cheese sidewalls, while endpoint rows match the neighbor's top and underside. Material identity is unchanged; source/target UV and thickness attributes are inherited. New pull faces are excluded from slice grabbing.

Each short mozzarella edge region feeds up to four closed, subdivided ribbon lanes. Unequal pinching opens gaps progressively; broader roots and delayed thinning retain visible mass. Lane strength, neck location, curvature and tearing differ. Individual tears are persistent, sealed, and recoil; once the solver breaks, the two visual fragments sample separate particle curves so no triangles span the broken constraint. Rendering never changes solver particles. Crust geometry, texture bindings, lighting, dough physics, controls and UI are unchanged.

Validation: `node scripts/test-regressions.mjs boundary-extrusion dough-cloth simulation-timing input slice-seams`, TypeScript/Vite production build, and `git diff --check`. Boundary regression covers four pull/tear/dispose/reset cycles, finite attributes/indices, exact destination positions, shared roots, no render-to-solver writes, persistent tears, safe ray hits, removal compaction, exact rest restoration and unchanged crust. CPU geometry inspection was performed; the available browser has no usable WebGPU/WebGL context, so device rendering and photographic reference matching remain unverified. The older `collisions-camera` suite fails its swept-particle height assertion on both the untouched v47 baseline and the edited source; no collision-solver changes were made in this repair.

## v49 — remove the comb-shaped pull

The v48 screenshot exposed a shape problem: one uniformly spaced source-grid edge fed each narrow ribbon, so the whole pull retained a comb silhouette. The surface interpolation now redistributes flow into unequal load-bearing widths independently of source tessellation. Adjacent lanes meet outside staggered lens-shaped apertures, producing connected root regions and branching/rejoining paths rather than full-length parallel slots. Openings take material from both neighboring paths in proportion to their widths. Source IDs/UVs and the v48 geometry lifecycle fixes remain.

Broad extrusion strength is now derived from its active boundary span count rather than the obsolete tiny string-radius estimate. Necking begins later relative to rupture, and the bridge body keeps more thickness at moderate separation. No crust, texture, lighting, UI, camera or slice-solver changes.

Validation: focused medium-separation shape fixture (unequal widths, both open and joined sections, no premature primary rupture), pull/tear/reset geometry regression, production build and diff check. CPU mesh views were inspected from two angles. GPU material/lighting appearance remains unverified in this environment.

## Slice weight and settling correction

- Removed per-strand rigid-body velocity impulses. Cheese now applies only a small local force to the deformable sheet, capped across the whole slice at 0.16 normalized force units per fixed step. Sleeping slices are not woken by residual cheese.
- Assigned 65% normalized mass to the stiff rim and 35% to the thin center. Center particle masses follow tributary triangle area; the rim center of mass follows sampled rim width/height. Integration rotates around this mass center without moving the visible rest geometry.
- Sheet constraint reactions now reach the rim after release. Off-center ground impulses create tipping torque, with bounded contact friction and rolling dissipation. No forced upright/flat rotation is applied.
- Supported nearly-flat slices tolerate low contact-solver jitter when entering sleep. Airborne/tilted slices retain the stricter existing threshold.
- Validation: slice-settling (opposite release tilts, finite ground contact, force cap, mass distribution, sleeping cheese, held crust control and center sag), dough-cloth, multi-slice, simulation-timing and performance-equivalence pass. TypeScript/production build pass. The existing collisions-camera suite passes drop/stack/push checks but fails its fixed-height swept-particle assertion on both unchanged v55 and this source. Browser-rendered behavior was not visually verified in this pass.

## v57 — verified review follow-up

- Particle CCD now chooses the earliest entry across all candidate convex proxies before modifying the trajectory. It retains tangential velocity for the next step instead of advancing untested residual motion. This fixes the overlapping-crust downward ejection; changing the old 0.88 factor alone did not fix it.
- Secondary ribbon batches have thin paired skins and sealed perimeter/end edges. Perforated membranes now seal every outer/hole contour; point-touching triangle fans are removed before extrusion so walls stay manifold. Tear-bucket rebuilds remain infrequent; normal updates honor active draw ranges.
- Center-grab feedback uses center/rim mass ratio rather than the legacy fixed 0.09 multiplier, resolving the settling assertion without relaxing its velocity threshold.
- Repaired stale test fixtures: rebuild mozzarella after changing amount; replace old tube indexing with closed-ribbon volume/UV/neck/batch checks; use actual inner-wall samples and the current crumb perimeter; allow distinct pull topologies to share a connection count. Crust geometry was not increased to satisfy an obsolete vertex budget.
- Added `npm test` discovery with nonzero failure exit, explicit esbuild dev dependency, Node-safe reduced-motion import, README and GitHub CI. No licensing terms were selected on the owner's behalf.
- Full result: 19/19 test files pass; TypeScript and production build pass. The suite covers all 15 membrane tear buckets, collider order independence, underside sweeps, local sag, release settling, 30/60/90/120 Hz behavior, mobile geometry, seams and optimized-path equivalence. CPU fixture measured median 6.46 ms / p95 12.15 ms in this environment; this is not a GPU or mobile-device FPS measurement. Browser visual QA remains unverified.

### v58 — cheese collision velocity regression

The v57 swept-contact response reconstructed Verlet history from the full attempted displacement, including movement rejected by collision. Repeated cheese constraint passes reinjected that motion and caused strands to scatter. Use only displacement actually travelled up to the first contact when preserving tangential motion. Earliest-contact collision selection, closed ribbon/membrane surfaces, materials, and slice mass/settling fixes remain unchanged.

Added `cheese-collision-stability`: a gradual crust grab with collision enabled, checking bridge excursion, particle velocity, network length, and surviving connections. Before the fix this fixture reached 4.59 units off the bridge and 549.5 units/s; after the fix it stays below 0.27 units and 35 units/s. These are solver-space regression metrics, not a claim of visual or device performance validation.

### v59 — local gap bridges, preserved resting surface

Replaced weighted per-sample strand spawning with contiguous cheese-covered cut intervals. Long intervals are partitioned into local roots no wider than 0.44 scene units (26.4 mm), and each root has 2–4 weighted ribbon paths independent of boundary sample count. No secondary comb or cross-region membrane is spawned. The shared global cheese field, albedo, UVs, and mozzarella material remain the source of truth.

Extensions now append closed, embedded root skins without deleting any original mozzarella faces. Their index ranges remain inactive below a 0.018-unit gap. Original positions and triangle indices remain unchanged at rest and restore exactly after release/reset. Each bridge uses the existing viscous spine plus a 3×10 damped surface lattice for transverse motion, gravity, restrained bending, and collision; the renderer interpolates that surface into the existing subdivided ribbon mesh. Continuous necking, lens-shaped perforations, independent lane thresholds, and clumping remain. Basil initial height now uses the actual local cheese/sauce field.

Validation includes unchanged resting indices/vertices, local field-covered roots, no duplicate region bridges, bounded triangle span, measurable sag, exact embedded destination attachment, closed extension surfaces, local tears, and unchanged crust geometry/material references. Browser/WebGPU visual QA is unavailable in this session; CPU geometry diagnostics do not prove final shader appearance or device FPS.
