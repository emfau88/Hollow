# Style B Golden-v1 wall asset contract

Golden-v1 is an opt-in art prototype for the existing orthogonal wall topology.
It changes no map, digging, pathfinding, camera or frame-selection semantics.

## Projection and pivot

- Projection is orthogonal, screen-aligned top-down with asymmetric 2.5D relief.
  It is not isometric: grid X is screen-right and grid Y is screen-down.
- Every runtime frame is `96 x 96` RGBA with its logical edge midpoint or grid
  vertex at `(48, 48)`. Phaser origin remains `(0.5, 0.5)`.
- A logical tile edge runs from pixel 32 to 64. Straight modules must cover
  2 px past both endpoints (`30..66`) so adjacent modules meet without a gap.
- Shadows may extend beyond hard material, but never beyond the safe envelopes
  enforced by `scripts/asset_tools/pack_style_b_golden_v1.py`.
- Critical lines are at least 2 final pixels. Mortar, cracks and highlights
  smaller than 2 px are non-semantic because zoom 0.72 makes them subpixel.

The target mockup's headquarters north wall occupies roughly 34 vertical pixels
(about 20 px pale cap plus 14 px dark facade) at its native `1672 x 941` frame.
Golden-v1 therefore restores substantial facade depth instead of the active V7
north edge's 17 px alpha bounding-box height.

## Fixed 4 x 4 topology atlas

The cell order is row-major and cannot change:

| row | column 1 | column 2 | column 3 | column 4 |
|---|---|---|---|---|
| 1 | 0 north edge | 1 east edge | 2 south edge | 3 west edge |
| 2 | 4 convex NW | 5 convex NE | 6 convex SE | 7 convex SW |
| 3 | 8 concave NW | 9 concave NE | 10 concave SE | 11 concave SW |
| 4 | 12 diagonal NW-SE | 13 diagonal NE-SW | 14 empty | 15 empty |

`convex NW` means NW is the only open-floor quadrant. `concave NW` means NW is
the only closed-rock quadrant. A diagonal name identifies its two open-floor
quadrants. X/Y and quadrant semantics are screen-space, not world-space prose.

Frames 4-7 and 8-11 must have four genuinely different alpha silhouettes.
Changing only texture inside one repeated square or oval is a contract failure.
Each corner has a compact center and shoulders toward exactly its two incident
wall arms:

- NW: north + west;
- NE: north + east;
- SE: south + east;
- SW: south + west.

Convex modules are substantial oriented outer pillars/elbows. Concave modules
are lower inset fillets with an oriented notch toward the open floor; they are
not recolored convex pillars. Natural and corridor families obey the same rule.

Frame 12 is one connected `\` seal and frame 13 one connected `/` seal. Two
unconnected dots are not sufficient. Frames 14 and 15 are fully transparent.
L, T and X corridor junctions are assembled from these edges and vertex frames;
there is no extra T/X frame in the immutable 16-frame runtime contract.

## Family geometry

- **Built room:** one large readable stone block per 32 px run; 14-16 px cap,
  12-16 px north facade, 16-20 px south facade, and coherent east/west cheeks.
  Convex corners use full Covenant brass posts; concave corners use compact pale
  masonry with little or no brass.
- **Fortified chamber:** the same architectural mass as built walls, without
  Covenant gold. Cooler gray-green stone and restrained metal ties distinguish it.
- **Natural cavern:** irregular but connected boulders. Every orientation must
  differ; variation comes from stone silhouette as well as texture. No repeated
  identical oval at all eight corner slots.
- **Corridor:** a low lip, not compressed room masonry. Its hard depth is about
  10-14 px and its joints 12-18 px, leaving at least 16 px of visually clear
  floor in a one-tile passage at world zoom 1.0.

## Light, material and color

All frames share one screen-space key light from upper left. Upper and left
bevels receive the strongest highlight. Contact shadows fall 2-4 px right and
4-6 px down. North, east, south and west are separately authored under this
fixed light; rotating one painted direction is forbidden.

Suggested ramps, aligned to the production frame and existing theme palette:

| role | dark | middle | highlight/accent |
|---|---|---|---|
| built cap | `#554B42` | `#A89D82` | `#F2DDB0` |
| built face | `#181521` | `#403044` | `#795C6B` |
| Covenant brass | `#6B3E0C` | `#D8A532` | `#FFDC7A` |
| fortified cap | `#26363C` | `#718184` | `#B7C2B9` |
| fortified face | `#111B25` | `#283844` | `#52636B` |
| natural cap | `#15333D` | `#527D72` | `#ABC18E` |
| corridor cap | `#172A37` | `#566F77` | `#9EAFAA` |
| contact shadow | `#050D18` | 55-75% alpha | down-right only |

Cap and facade of one block must share stone seams and material identity. They
must not be unrelated random crops. Avoid one-pixel noise, uniformly repeated
cracks, baked circular room light and black halos in transparent pixels.

## Threshold atlases

There are two `384 x 96` atlases, four `96 x 96` frames in N/E/S/W order:

- `threshold-built.png`: low Covenant sill, 36 px long, 8-12 px thick, pale
  stone/brass end fasteners, no blocking facade and no freestanding posts.
- `threshold-natural.png`: low irregular stone/root transition, 36-40 px long,
  10-14 px thick, no gold, optional restrained moss. It must read as a biome
  transition while leaving the passage open.

Both threshold families use the same `(48,48)` pivot and light direction as the
walls. N/S and E/W are separately lit, not runtime rotations.

## Chroma source and packing

ImageGen source sheets use one flat opaque `#FF00FF` background, including all
gutters. No texture, gradient, color spill or shadow may touch the background.
Reserve cells contain only `#FF00FF`. The old V4 chroma fluctuates around
`#F30AE5`; Golden-v1 deliberately uses exact `#FF00FF` for deterministic keying.

Runtime outputs live under:

`public/assets/generated/style-b-wall-prototypes/golden-v1/`

- `wall-atlas-built.png`
- `wall-atlas-fortified.png`
- `wall-atlas-natural.png`
- `wall-atlas-corridor.png`
- `threshold-built.png`
- `threshold-natural.png`
- `occlusion-atlas-built.png`
- `occlusion-atlas-fortified.png`
- `occlusion-atlas-natural.png`
- `occlusion-atlas-corridor.png`

The first prototype deliberately duplicates built art into fortified and
corridor art into natural when those dedicated source sheets are omitted. Any
still-missing pair is emitted as a transparent placeholder. Occlusion atlases
are also emitted as transparent `384 x 384` placeholders: front-facade pixels
cannot be separated robustly from one flattened painted sheet, and a false
occlusion mask is more damaging than a temporarily empty one. The Golden theme
does not load these placeholders; its optional high-depth layer is activated
only after hand-authored masks pass visual acceptance.

Pack one or more source sheets with:

```powershell
python scripts/asset_tools/pack_style_b_golden_v1.py `
  --built docs/art-source/style-b-wall-prototypes/golden-v1/built-sheet-master-v2.png `
  --built-frame-10 docs/art-source/style-b-wall-prototypes/golden-v1/built-concave-se-master.png `
  --corridor docs/art-source/style-b-wall-prototypes/golden-v1/corridor-sheet-master.png `
  --corridor-frame-11 docs/art-source/style-b-wall-prototypes/golden-v1/corridor-concave-sw-master.png `
  --threshold-built docs/art-source/style-b-wall-prototypes/golden-v1/threshold-built-master.png `
  --threshold-natural docs/art-source/style-b-wall-prototypes/golden-v1/threshold-natural-master.png
```

The two single-frame overrides are optional in the general tool, but required
for the checked-in first-generation masters: ImageGen painted the original
built frame 10 and corridor frame 11 as three-arm junctions instead of the
required concave SE/SW elbows. Overrides are Chroma-keyed, pivot-fitted and
validated with the same contract as their parent sheets.

For a `1254 x 1254` ImageGen sheet, rounded cell boundaries produce alternating
313/314 px cells automatically. The default `--source-gutter 8` discards white
grid lines, Chroma is removed, only the largest connected object is retained,
and residual magenta spill is removed after downsampling. Straight frames fill
directional outside-the-floor envelopes; joints are scaled about the authored
cell-center pivot. Increase the gutter only if a generated white line is wider
than 8 source pixels.

The packer refuses empty required frames, non-empty reserves, identical corner
alpha masks, missing arm contacts, wrong diagonals and safe-envelope overflow.

## Golden acceptance assemblies

Before promotion, render each family over a checker/floor at zoom 0.72, 0.88 and
1.06 in: a rectangular room, horizontal and vertical one-tile passages, a
two-tile passage, four L turns, four T junctions, one cross, both diagonal
contacts and every built/natural threshold orientation. Acceptance requires:

- no pinholes, doubled posts, free-floating dots or Chroma fringe;
- no facade overlap that closes a one-tile corridor;
- clearly different convex and concave readings in all four orientations;
- cap/facade seams and the upper-left light remain continuous across modules;
- the built north wall remains materially legible at zoom 0.72;
- no active frame relies on a one-pixel critical highlight.
