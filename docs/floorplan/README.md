# Local system map

The optional Floorplan map covers this repository only: GitHub collection and filters, AI personalization, local media rendering, tests, and GitHub workflows. Canonical usage and privacy guidance live in [the project README](../../README.md) and [the skill](../../SKILL.md).

With the Floorplan skill installed, ask your agent to generate or refresh a map of this repository. The installed skill's scan, describe, build, and refresh scripts write the local interactive map at `floorplan/index.html`. Run `node floorplan/serve.mjs` from the repository root to open an already generated map. Use the installed skill's incremental refresh workflow after changing the collector, AI helper, or renderer.

Generated maps, caches, and worksheets stay local and are not committed. Never put raw activity reports, private repository identities, or credentials in map descriptions.
