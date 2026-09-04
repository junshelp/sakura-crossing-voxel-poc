# Voxel Crossing PoC Product Requirements Document

Status: Ready for implementation planning

## Problem Statement

I want to know whether the visual language of Sakura Crossing can be translated
into a voxel style before committing to a full production rewrite. The current
reference demonstrates a rich Japanese suburban world, but its many procedural
meshes, materials, generated signs, outlines, and post-processing passes create a
large content codebase and a draw-call-bound renderer. A voxel appearance alone
does not guarantee simpler code or better performance; a naive cube-per-object
implementation could be substantially worse.

I need a small but representative experiment that answers two questions with
evidence: whether the crossing still has a convincing identity in voxel form,
and whether a correctly batched voxel renderer reduces rendering cost against a
fair conventional baseline. Code volume should be measured, but it is a secondary
indicator rather than the main success criterion.

## Solution

Build the Voxel Crossing PoC as an independent public web project. It will present
one Miniature Crossing Slice on a spherical planet and allow the evaluator to
switch between Baseline Mode and Voxel Mode without changing the simulation,
camera, collision, interactions, or scene population.

Both modes will consume one Shared Scene Specification. Baseline Mode will render
the slice with conventional Three.js primitives. Voxel Mode will render the same
semantic content using palette-indexed Voxel Assets compiled into Voxel Chunks by
a tested Greedy Mesh pipeline. Planet surface, roads, rails, and wires will remain
Continuous Infrastructure so that voxel styling does not compromise curvature or
functional geometry.

The application will include an interactive exploration mode and a deterministic
Benchmark Run. The benchmark will measure renderer work and frame-time
distributions under identical conditions. The experiment succeeds only when it
earns Visual Acceptance, maintains Functional Parity, and achieves the agreed
performance thresholds.

## User Stories

1. As a product owner, I want a small representative experiment, so that I can decide whether a full voxel production direction deserves investment.
2. As a product owner, I want visual quality and performance treated as co-primary outcomes, so that the decision is not distorted by optimizing only one dimension.
3. As a product owner, I want code volume reported as a secondary metric, so that apparent source reduction does not override player-facing quality or runtime cost.
4. As an evaluator, I want to open a shareable browser build, so that I can review the experiment without a local development setup.
5. As an evaluator, I want to switch instantly between Baseline Mode and Voxel Mode, so that differences are easy to perceive.
6. As an evaluator, I want both modes to start from the same camera position, so that the comparison is visually fair.
7. As an evaluator, I want a fixed comparison camera route, so that repeated reviews show the same compositions.
8. As an evaluator, I want the active rendering mode clearly identified, so that screenshots and measurements cannot be confused.
9. As an evaluator, I want the scene to read as a Japanese suburban railway crossing in blossom season, so that the voxel treatment retains the intended identity.
10. As an evaluator, I want recognizable road, rail, shop, housing, utility, and vegetation silhouettes, so that the test covers more than a generic block environment.
11. As an evaluator, I want a visible spherical horizon and looping railway, so that compatibility with the upstream planet concept is demonstrated.
12. As a player, I want first-person walking and mouse look, so that I can judge the scene from normal exploration distance.
13. As a player, I want collision to behave identically in both modes, so that a visual switch never changes traversable space.
14. As a player, I want the crossing barriers to lower before the train arrives, so that the central scene behaves believably.
15. As a player, I want the warning lights to operate with the crossing sequence, so that animation and emissive detail are represented.
16. As a player, I want a two-car train to travel around the planet, so that moving geometry and spherical placement are exercised.
17. As a player, I want to call the train from a relay box, so that a complete interaction-to-simulation path can be tested quickly.
18. As a player, I want to use a vending machine and see a dispensed drink, so that close-range interaction with a Voxel Asset is represented.
19. As a player, I want prompts for available interactions, so that the proof can be explored without reading developer instructions.
20. As a technical artist, I want a canonical 0.25 m voxel grid, so that assets share a consistent visual scale.
21. As a technical artist, I want major building dimensions aligned to 0.5 m increments, so that large forms remain legible and economical.
22. As a technical artist, I want a small named palette, so that color relationships remain intentional and material count stays bounded.
23. As a technical artist, I want one compact pixel-sign atlas, so that the shop and vending machine can carry identity without many unique materials.
24. As a technical artist, I want Continuous Infrastructure rules, so that rails, wires, roads, and the planet are not damaged by stylistic purity.
25. As a technical artist, I want transparent and emissive palette roles to be explicit, so that windows and warning lights do not create arbitrary material variants.
26. As a developer, I want one Shared Scene Specification, so that placements and gameplay contracts cannot drift between renderers.
27. As a developer, I want Voxel Assets to contain no gameplay behavior, so that visual data can be compiled and tested independently.
28. As a developer, I want hidden voxel faces removed, so that invisible geometry does not consume triangles.
29. As a developer, I want compatible exposed faces merged by Greedy Mesh, so that voxel styling reduces draw calls and vertex work.
30. As a developer, I want chunk-boundary faces handled correctly, so that seams and duplicate internal faces do not appear between chunks.
31. As a developer, I want a hard rule prohibiting one Three.js mesh per voxel, so that a naive implementation cannot satisfy the PRD.
32. As a developer, I want deterministic seeds for scene dressing and animation timing, so that benchmark runs are reproducible.
33. As a developer, I want the flat authored coordinates projected onto the sphere through one isolated module, so that world builders remain unaware of planet math.
34. As a developer, I want small animated rigs seated rigidly on the planet, so that crossing pivots and vending interactions survive projection.
35. As a performance engineer, I want a warm-up period before measurement, so that shader compilation and startup transients do not pollute results.
36. As a performance engineer, I want p50 and p95 frame times, so that averages do not hide stutter.
37. As a performance engineer, I want draw calls, triangles, textures, and shader programs recorded, so that performance changes can be explained.
38. As a performance engineer, I want optional GPU timer data when the browser supports it, so that CPU and GPU effects can be distinguished.
39. As a performance engineer, I want benchmark results exportable as JSON, so that evidence can be reviewed and compared outside the running app.
40. As a performance engineer, I want the viewport and device-pixel ratio normalized during Benchmark Runs, so that mode comparisons are not biased by resolution.
41. As a maintainer, I want a documented Reference Profile, so that primary acceptance numbers have reproducible context.
42. As a maintainer, I want automated checks for the Greedy Mesh and planet projection contracts, so that optimization work cannot silently corrupt geometry.
43. As a maintainer, I want browser smoke tests for both modes, so that the deployed experiment does not regress to a blank or non-interactive scene.
44. As a maintainer, I want upstream attribution and license terms included, so that selective reuse of the MIT source remains clear.
45. As a maintainer, I want the upstream stock audio excluded, so that the proof has no unresolved audio redistribution rights.
46. As a maintainer, I want automated static deployment from the default branch, so that the reviewed build corresponds to repository history.
47. As a decision maker, I want a concise final evidence report, so that I can choose continue, revise, or reject without interpreting raw telemetry alone.

## Implementation Decisions

- The project is a new public GitHub repository licensed under MIT, with clear attribution to the upstream Sakura Crossing project. Upstream audio will not be copied.
- The proof is a standalone web application using Three.js and a lightweight build tool. It selectively reimplements only the architecture required by the experiment rather than importing the complete upstream source tree.
- The populated Miniature Crossing Slice is approximately 60 x 60 m and is authored near the equator of a radius-160 m planet. The railway remains an approximately 1,005 m closed loop around the sphere.
- The content inventory is fixed: one operating crossing, one two-car train, one curved road and footway, one corner shop, two distinct houses, one interactive vending machine, one interactive relay box, utility poles and wires, fencing, four to six cherry trees with restrained petals, one parked bicycle or vehicle, and first-person traversal.
- Mountains, lake, canal, tunnels, school, shrine, additional districts, rideable bike, music system, and large content generators are excluded from the slice.
- The Shared Scene Specification is the single source of truth for stable entity identifiers, semantic kinds, transforms, palette roles, colliders, interactions, animation bindings, deterministic seeds, and benchmark camera markers.
- Simulation and gameplay consume the Shared Scene Specification directly. Renderer adapters receive visual descriptions but do not own colliders, interaction ranges, or train logic.
- Baseline Mode and Voxel Mode are mutually exclusive visual adapters over the same live world state. Switching modes preserves player position, camera, train offset, barrier state, and interaction state.
- Baseline Mode uses conventional procedural primitives with modest material reuse. It is a fair local control for this Miniature Crossing Slice, not a claim to reproduce the full upstream renderer.
- Voxel Mode uses a canonical 0.25 m grid. Large architectural dimensions align to 0.5 m increments, while close details may use the canonical grid. Finer ad hoc voxel sizes are not permitted.
- Voxel Assets are sparse, palette-indexed data with asset-local origins and explicit opaque, transparent, and emissive roles. Gameplay logic is forbidden in asset data.
- Voxel Assets compile into 32 x 32 x 32 Voxel Chunks. The compiler removes internal faces, resolves occupancy across chunk boundaries, merges compatible coplanar faces, and emits indexed buffer data with bounds and material groups.
- No occupied voxel creates an individual runtime Three.js mesh. Opaque voxel surfaces use a shared palette material with vertex color or palette lookup. Transparent surfaces are isolated into a bounded secondary material path. Emissive details share a bounded palette role.
- Pixel signage uses a single compact nearest-filtered atlas. Unique Canvas textures per sign are outside the experiment.
- Continuous Infrastructure includes the planet surface, road and footway surfaces, rails, overhead wires, and any other long thin curve whose functional shape would be compromised by grid cubes.
- The planet projection remains an isolated post-build transformation. Static mesh vertices are projected from flat authored coordinates; small animated rigs are rigidly seated in the local surface basis; the train is bent once and advances by rotation around the planet axis.
- The train and crossing are driven by deterministic train offset rather than independent timers. The relay interaction advances the train to a known approach position for immediate testing.
- The renderer defaults to a simplified direct pipeline. Voxel Mode does not use the upstream depth-ink pass, inverted-hull outlines, supersampled half-float targets, or FXAA. A single lightweight color-grade pass may be retained only if visual review demonstrates that palette and lighting alone are insufficient.
- Lighting uses a bounded shared setup for both modes. The comparison must not give Voxel Mode a cheaper shadow configuration unless the difference is explicitly reported as part of the voxel production strategy.
- The interactive HUD exposes mode, interaction prompt, frame-time summary, draw calls, and triangle count. Detailed telemetry may be expanded in a developer panel without covering the scene.
- A Benchmark Run uses a deterministic seed, fixed camera route, 1600 x 900 internal viewport, device-pixel ratio 1, a five-second warm-up, and a thirty-second sample per mode. The same application session measures both modes in alternating order to reduce environmental bias.
- Benchmark output records Reference Profile metadata, application commit, mode, p50 and p95 frame time, mean frame time, draw calls, triangles, texture count, shader program count, world-build time, and optional disjoint GPU timer measurements. Results can be downloaded as JSON.
- Code line count, generated mesh bytes, Voxel Asset bytes, production bundle size, and world-build time are reported as explanatory metrics. Code reduction is not an acceptance gate because content can move from source code into data without reducing total complexity.
- Primary technical acceptance requires Voxel Mode to reduce median draw calls by at least 50 percent against Baseline Mode and improve p95 frame time by at least 20 percent on the documented Reference Profile. A secondary profile must not regress by more than 10 percent without an explained browser or GPU constraint.
- Product acceptance additionally requires Functional Parity, no visible chunk seams or missing faces during the fixed camera route, and explicit Visual Acceptance from a human reviewer.
- If Visual Acceptance passes but performance thresholds fail, the conclusion is to revise meshing, batching, materials, or benchmark design before expanding content. If performance passes but Visual Acceptance fails, the conclusion is to revise voxel scale, palette, silhouettes, or hybrid exceptions. The full world must not be started until both pass.
- Static deployment is automated from the default branch through GitHub Pages. Deployment is part of implementation readiness, but custom domains, analytics, and external backend services are unnecessary.

## Testing Decisions

- Good automated tests assert externally observable contracts and invariant outputs rather than private helper calls or exact implementation structure. Geometry tests inspect emitted surfaces, bounds, winding, palette groups, and seam behavior; gameplay tests inspect public world state and interactions.
- The Greedy Mesh module receives the deepest unit coverage. Cases include empty chunks, one voxel, solid volumes, hollow volumes, adjacent palette regions, transparent boundaries, chunk-edge neighbors, negative coordinates, face winding, normal direction, merged quad coverage, and deterministic indexed output.
- Voxel Asset validation tests reject off-grid coordinates, unknown palette roles, duplicate occupancy, invalid bounds, and gameplay fields embedded in visual data.
- Planet projection tests verify radius, equatorial distance, longitude wrap continuity, local basis orthogonality, rigid seating, and preservation of animation pivots.
- Shared Scene Specification contract tests verify unique entity identifiers, deterministic generation, valid collider bounds, valid interaction targets, and complete renderer descriptions.
- Functional Parity integration tests build both renderers and verify that public entity identifiers, colliders, interaction labels, animation bindings, and scene bounds agree even though mesh topology differs.
- Train and crossing tests advance deterministic offsets through approach, closed, passing, clearing, and open states. The relay interaction must place the train at its defined approach state.
- Benchmark harness tests verify warm-up exclusion, sample duration handling, percentile calculations, alternating mode order, normalized viewport settings, required metadata, and JSON schema stability. CI does not assert absolute FPS or GPU time.
- Browser smoke tests load both modes, toggle between them without resetting shared state, traverse a short scripted path, activate the relay and vending interactions, observe a train pass, and complete a short diagnostic Benchmark Run.
- Visual regression tests use fixed cameras for gross failures such as blank output, missing chunks, broken projection, or incorrect mode activation. Pixel-perfect equality is not required across GPU vendors. Visual Acceptance remains a human decision recorded separately.
- Performance acceptance is evaluated on documented Reference and secondary profiles from production builds with inactive developer tools and stable power conditions. At least three Benchmark Runs per mode are retained; the median run determines the headline comparison.
- The upstream project has no general automated test suite, but it establishes useful prior art through numeric invariant checks for terrain safety, lake leakage, and tunnel clearance. This project follows that spirit by testing meshing, projection, and parity invariants as first-class behavior.

## Out of Scope

- Rebuilding or porting the complete Sakura Crossing town.
- Editable, destructible, or player-placeable voxels.
- Infinite procedural voxel terrain, streaming world generation, or networked chunks.
- NPCs, quests, inventory, economy, save progression, multiplayer, or backend services.
- Rideable vehicles, traffic simulation, or a full train timetable.
- Mountains, lake, canal, tunnels, school, shrine, festival ground, supermarket, library, onsen, and residential districts beyond the two sample houses.
- Mobile touch controls, VR controls, gamepad certification, or native application packaging.
- Full mobile-device performance certification; a secondary browser profile is informative for this proof.
- Final production art, exhaustive Japanese architectural authenticity review, localization, accessibility certification, or commercial audio.
- Pixel-perfect reproduction of the upstream cel-shaded presentation.
- Treating fewer JavaScript lines as proof of lower maintenance cost.

## Further Notes

- The experiment deliberately preserves the hardest architectural constraint,
  spherical projection, while shrinking content. A flat-only proof would postpone
  chunk seams, rigid seating, and latitude distortion risks until production.
- The Shared Scene Specification and Greedy Mesh compiler are the principal deep
  modules. They should expose small stable interfaces and remain usable without a
  browser renderer so that most correctness can be tested quickly.
- Thin Continuous Infrastructure is an intentional part of the voxel art
  direction, not a temporary shortcut. The goal is a coherent hybrid style, not
  universal conversion into cubes.
- Raw metrics and Visual Acceptance evidence should be committed or attached to
  the repository before a continue/revise/reject decision is recorded.
- Passing this PRD authorizes implementation planning for the Miniature Crossing
  Slice only. It does not authorize expansion to the full upstream world.
