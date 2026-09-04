# Sakura Crossing Voxel PoC

Sakura Crossing Voxel PoC is a deliberately small, playable experiment that
tests whether a Japanese suburban railway-crossing scene can retain its identity
in a voxel style while using less rendering work than a conventional procedural
Three.js representation.

## Language

**Voxel Crossing PoC**:
The complete experiment: one shared playable scene, two rendering modes, and a
deterministic benchmark used to decide whether voxel production should continue.
_Avoid_: voxel remake, full game, Minecraft clone

**Miniature Crossing Slice**:
The approximately 60 x 60 m populated area around one railway crossing. It
contains only the content needed to exercise architecture, thin infrastructure,
vegetation, animation, collision, and interaction.
_Avoid_: full town, district, level one

**Shared Scene Specification**:
The deterministic semantic description of entities, transforms, colliders,
interactions, palette roles, and animation hooks used by both rendering modes.
It is the source of truth for parity; it does not prescribe final geometry.
_Avoid_: voxel map, render scene, level file

**Baseline Mode**:
The conventional Three.js primitive renderer for the Shared Scene Specification.
It provides a fair local comparison and is not intended to reproduce every
detail of the upstream project.
_Avoid_: original mode, anime mode, legacy mode

**Voxel Mode**:
The renderer that compiles voxel assets into batched chunk meshes while sharing
the same simulation, camera, collision, and interactions as Baseline Mode.
_Avoid_: Minecraft mode, low-quality mode

**Voxel Asset**:
A palette-indexed sparse occupancy description aligned to the canonical 0.25 m
grid. It describes visual content and does not own gameplay behavior.
_Avoid_: cube collection, block prefab

**Voxel Chunk**:
A bounded section of a Voxel Asset compiled as a rendering and culling unit.
No runtime Three.js mesh may be created per occupied voxel.
_Avoid_: cube, tile, region

**Greedy Mesh**:
The exposed surface mesh produced by removing hidden faces and merging adjacent
coplanar faces with compatible palette and transparency properties.
_Avoid_: cube batching, instancing pass

**Continuous Infrastructure**:
Long, thin, curved, or safety-critical geometry that remains continuous rather
than voxelized, including the planet surface, road surface, rails, and wires.
_Avoid_: exception assets, non-voxel leftovers

**Functional Parity**:
The requirement that Baseline Mode and Voxel Mode expose the same traversable
space, colliders, interactions, deterministic train state, and camera route.
Visual geometry may differ, but gameplay results may not.
_Avoid_: pixel-perfect parity, visual match

**Benchmark Run**:
A seeded, fixed-resolution, fixed-camera measurement session with a warm-up and
sample window. It records frame-time distributions and renderer work for both
modes under equivalent conditions.
_Avoid_: FPS check, eyeballing performance

**Reference Profile**:
The documented browser, hardware, viewport, device-pixel ratio, and power state
used for the primary Benchmark Run. Secondary profiles are informative unless a
specific acceptance threshold names them.
_Avoid_: developer machine, target device

**Visual Acceptance**:
A human review that confirms the scene still reads as a Japanese suburban
crossing in blossom season, with recognizable hierarchy and silhouettes. It is
separate from automated rendering checks.
_Avoid_: screenshot test, art complete

## Example Dialogue

Developer: "Can the voxel renderer define its own colliders?"
Domain expert: "No. Functional Parity comes from the Shared Scene Specification;
both rendering modes consume the same colliders and interactions."

Developer: "Should the rails be made from tiny cubes?"
Domain expert: "No. Rails are Continuous Infrastructure because their length,
curvature, and safety relationship to the train matter more than voxel purity."

Developer: "Does a higher FPS automatically prove the experiment?"
Domain expert: "No. The Voxel Crossing PoC needs both measurable benchmark gains
and Visual Acceptance."
