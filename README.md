# Sakura Crossing Voxel PoC

A miniature voxel-style railway-crossing proof of concept with deterministic
Baseline/Voxel A/B benchmarking.

The project will test whether a 60 x 60 m playable slice can preserve the visual
identity and interactions of a Japanese suburban crossing while reducing draw
calls and frame time through palette-based voxel chunks, hidden-face removal,
greedy meshing, and a simplified render pipeline.

Planning starts in [the product requirements document](docs/voxel-crossing-poc-prd.md).

## Upstream attribution

The concept and selected architectural ideas are derived from
[Kenton-GMI/sakura-crossing](https://github.com/Kenton-GMI/sakura-crossing),
which is distributed under the MIT License. This repository will selectively
reimplement only the systems required by the proof of concept; it will not copy
the upstream audio asset.

## Status

Planning. No runtime implementation has been added yet.
