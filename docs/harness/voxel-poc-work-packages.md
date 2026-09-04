# Voxel Crossing PoC Work Packages

## Dependency Graph

```text
W001 Scaffold and contracts
  -> W002 Voxel compiler
  -> W003 Spherical shared world
     -> W004 Baseline playable slice
     -> W005 Voxel playable slice
        -> W006 Functional interactions and parity
           -> W007 Benchmark, evidence, and delivery
```

Packages are deliberately sized for one bounded implementation worker turn plus
root-owned review. The root may split a package before assignment if its allowed
file set or acceptance criteria cannot stay focused.

## W001 — Executable Scaffold and Public Contracts

Goal: establish the smallest production-buildable application and the public
interfaces that later packages must preserve.

Deliverables:

- Three.js application scaffold with development, test, and production commands
- minimal visible boot scene and mode indicator
- Shared Scene Specification schema and deterministic sample fixture
- renderer-adapter contract with Baseline and Voxel placeholders
- test runner and browser smoke-test skeleton
- CI checks for unit tests and production build

Acceptance:

- clean install, unit test, and production build succeed
- browser smoke test confirms a non-blank page and mode label
- both placeholder adapters consume the same fixture
- no product content beyond a tracer scene

## W002 — Voxel Asset Validator and Greedy Mesh Compiler

Depends on: W001

Goal: implement the deepest isolated module before visual content depends on it.

Deliverables:

- canonical 0.25 m sparse Voxel Asset representation
- palette-role validation
- 32-cubed Voxel Chunk partitioning
- hidden-face removal across chunk boundaries
- deterministic Greedy Mesh output with opaque and transparent groups
- conversion from compiler buffers to Three.js geometry at the adapter boundary

Acceptance:

- tests cover empty, single, solid, hollow, palette boundary, transparency,
  negative coordinate, winding, normal, merge, and cross-chunk cases
- equivalent input ordering produces identical compiler output
- a solid rectangular volume emits only its six exterior merged surfaces
- source contains no loop that constructs a Three.js Mesh for every voxel

## W003 — Shared World, Continuous Infrastructure, and Planet Projection

Depends on: W002

Goal: establish the shared spherical world independently of either final visual
adapter.

Deliverables:

- radius-160 m planet basis and position mapping
- longitude wrapping and approximately 1,005 m equatorial railway loop
- flat-to-sphere projection for static geometry
- rigid seating for animated groups
- Shared Scene Specification for the fixed 60 x 60 m population footprint
- shared colliders, interaction targets, and benchmark camera markers
- Continuous Infrastructure tracer geometry for planet, road, rails, and wires

Acceptance:

- projection invariant tests pass at origin, wrap seam, and representative slice
  locations
- local surface bases are orthonormal within numeric tolerance
- renderer adapters do not own colliders or interaction definitions
- a fixed browser camera shows the curved horizon and closed rail loop geometry

## W004 — Baseline Mode Playable Slice

Depends on: W003

Goal: build a conventional procedural control scene from the shared specification.

Deliverables:

- operating crossing visual rig and two-car train visuals
- corner shop, two houses, vending machine, relay box, utilities, fencing,
  cherry trees, restrained petals, and one parked bicycle or vehicle
- shared lighting and palette roles
- first-person walking, mouse look, and collision
- fixed comparison cameras

Acceptance:

- the full content inventory is present with stable semantic identifiers
- the player can traverse the intended footway without clipping or leaving the
  approved footprint
- the scene reads as a Japanese suburban crossing in blossom season at the fixed
  cameras, pending human Visual Acceptance
- renderer telemetry is visible and capturable

## W005 — Voxel Mode Playable Slice

Depends on: W004

Goal: render the same Shared Scene Specification using Voxel Assets and Greedy
Mesh output while preserving Continuous Infrastructure.

Deliverables:

- Voxel Assets for shop, houses, vending machine, relay box, crossing equipment,
  train shell, vegetation, utilities where appropriate, and parked prop
- one nearest-filtered pixel-sign atlas
- shared opaque palette material plus bounded transparent/emissive paths
- mode switching without simulation or camera reset
- chunk bounds and frustum culling

Acceptance:

- all required semantic entities appear in Voxel Mode
- no visible missing faces or chunk seams at fixed cameras and traversal route
- mode switching preserves player and train state
- no per-voxel Mesh construction and no unique Canvas texture per sign
- initial telemetry demonstrates the expected batching direction; final threshold
  remains W007's responsibility

## W006 — Deterministic Simulation, Interactions, and Functional Parity

Depends on: W005

Goal: complete shared behavior and prove that renderer choice does not change it.

Deliverables:

- deterministic two-car train loop
- approach, closing, passing, clearing, and open crossing states
- relay interaction that places the train at a known approach offset
- vending interaction with visible dispensed-drink state
- shared interaction prompts and state-preserving mode toggle
- Functional Parity contract tests and browser scenario

Acceptance:

- state-transition tests cover every crossing phase
- both modes expose the same colliders, interactions, labels, animation bindings,
  and traversable results
- relay and vending browser interactions succeed in both modes
- toggling during an active crossing sequence does not reset or desynchronize it

## W007 — Benchmark Run, Evidence, and Delivery

Depends on: W006

Goal: turn the playable slice into a reproducible product decision.

Deliverables:

- fixed 1600 x 900, device-pixel-ratio-1 Benchmark Run
- five-second warm-up and thirty-second sample per alternating mode
- p50, p95, mean frame time and renderer-work metrics
- optional GPU timer query with graceful unsupported behavior
- JSON evidence export with Reference Profile and commit metadata
- production browser smoke test and deployment workflow
- final evidence report template with continue, revise, or reject outcomes

Acceptance:

- benchmark-harness unit tests validate exclusion, percentiles, ordering, and JSON
  schema
- three production Benchmark Runs per mode can be retained and compared
- Voxel Mode is evaluated against the PRD's draw-call and p95 thresholds
- technical results are separated from pending or approved Visual Acceptance
- deployment changes remain behind the repository-setting approval gate

