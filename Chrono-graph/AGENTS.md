# ChronoGraph

3D retro voxel city visualizer for GitHub repository git history.

## Stack
- Vite
- React 18 / 19 + TypeScript
- Three.js + @react-three/fiber + @react-three/drei
- Tailwind CSS
- Zustand
- Client-side only (no backend; GitHub REST API directly)

## Concept Mapping
- **District / Island**: Top-level repository directory
- **Voxel Building**: File inside repository; height grows with lines changed / commit touches
- **Commit Event**: Building upgrade animation + ground pulse
- **Contributor Avatar**: 8-bit voxel avatar roaming inside dominant directory/territory
- **Timeline Player**: Step-by-step or continuous historical playback from first commit to HEAD

## Directory Layout
- `src/data/`: GitHub API client, commit parser, mock repos, layout precomputation
- `src/world/`: Three.js / R3F scene, islands, voxel buildings, avatars, ground grid, camera
- `src/ui/`: Repo input modal, playback controls, inspector HUD, contributor list
- `src/store/`: Zustand stores (repo state, playback state, visual settings)
- `scripts/`: Dev & generator helper scripts

## Code Style & Conventions
- Pure TypeScript, strict typing, no `any`.
- Functional components with React hooks.
- Colocate 3D shaders or instance buffers where applicable for high voxel performance (instanced meshes).
- Minimal external dependencies.
