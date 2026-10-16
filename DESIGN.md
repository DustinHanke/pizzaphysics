# Pizza Physics visual contract

## 1. Atmosphere and identity
An editorial food experiment around a live, deformable Neapolitan pizza. The supplied food photographs guide materials and light, not page layout or exact pizza geometry. Keep the existing interface and physics. The signature is dry, irregular leopard crust against moist tomato and creamy molten mozzarella.

## 2. Color
Existing interface tokens: ink `#332b25`, muted `#81776c`, accent `#a93d29`, line `#d9d1c4`, paper `#f4f0e7`. Scene: charcoal `#171513`, floor `#25211d`. Key `#fff5e7`, fill `#e8efff`, rim `#ffe0b3`, hemisphere sky `#fff4e3`, ground `#4a4440`. Food albedo stays warm but light must not bleach the tomato or make the dough orange. Cream centers transition to golden melt edges; char remains almost black.

## 3. Typography
Preserve DM Sans UI, Georgia editorial headings, IBM Plex Mono measurements. Existing sizes: wordmark 42/38/34px, controls heading 47/43px, body 12–18px, telemetry 32/27/25px, metadata 8–11px. No typography changes in this material pass.

## 4. Spacing and layout
Preserve the 1660px max-width editorial grid, 280px control column, 34px gutter, desktop 42px side padding. Existing breakpoints: 1150, 900, 480px; stacked controls below 900px. Canvas responds to its container. QA widths: 375, 768, 1280px.

## 5. Components
Existing primitives: scene canvas, range control row, seed input, action button, measurements, collapsible controls. Preserve hover, focus, active/pressed and expanded states. Scene remains real Three.js geometry with shared physically based materials; no photographic pizza overlay. Material maps must follow the pizza through orbiting, lifting and stretching. Cheese pools and strands share their optical profile.

## 6. Motion and interaction
Preserve drag-to-pull, empty-space orbit, wheel/pinch zoom, hold, reset, keyboard manipulation and seed/amount regeneration. Keep current reduced-motion rules. Rendering changes must not alter simulation timing or add per-frame texture work.

## 7. Depth and surface
One dominant upper-left key with restrained neutral fill and warm edge light. Exposure 0.98, environment 0.22, key 2.6 at (-5, 6, -3), fill 0.18, rim 0.45, hemisphere 0.08. Keep shadow coverage for lifted slices; PCF shadow texels soften contact edges.

Dry crust: roughness about 0.8–1, tiny pores and char detail, no coat. Tomato: effective roughness 0.28–0.48, water/oil reflections, nonmetallic IOR 1.36. Cheese: effective roughness 0.26–0.48, IOR 1.42, subtle coat, milky centers and warm edges. Scattering is a restrained backlight response, not a global diffuse glow. Separate spatial height from color detail; avoid deriving only high-pass relief that erases larger surface variation. Normal strength must remain the same after amount/seed refresh.

## 8. Accessibility constraints and scope
Preserve keyboard controls, visible focus, canvas accessible description and reduced-motion support. Existing small metadata text and physically simplified cheese silhouettes are outside this lighting/material pass. Photographs are qualitative material references, not a promise of offline-render photorealism. Validate responsive rendering, normal view, orbit, lifted slice, reset and material regeneration. No new accessibility debt is introduced by changing scene materials.

## 9. Basil
Three leaves remain a small central garnish, attached to their owning slices. Sweet-basil blades have broad ovate shoulders, tapered tips, gently scalloped margins, a raised midrib and curved branching veins. Use slight seeded asymmetry, cupping and tip curl; preserve thin silhouettes. Blade lengths about 0.64 scene units with smaller third leaf; half-width about 0.19. Short petioles converge toward the center. Green albedo ranges from deep leaf green (roughly RGB 37/87/20) to warmer vein green (roughly 79/125/35), with restrained waxy highlights: IOR 1.43, effective roughness 0.35–0.53, coat 0.12. Fine relief follows the vein network, without baked white highlights. Texture/geometry generation happens at construction, with existing cloth attachment and scattering preserved. Food references remain qualitative, not exact pixel targets.
