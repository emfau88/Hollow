"""Pack and validate Golden-v1 Style-B wall prototype sheets.

This tool does not create wall art. It converts externally authored chroma-key
contact sheets into the exact Phaser atlas layout used by the prototype theme.

Wall input: a square 4x4 sheet, row-major, with equal square cells.
Threshold input: either a 4x1 strip or a square 2x2 sheet (N, E, S, W).
Background: flat #ff00ff. Near-magenta antialias pixels are keyed softly.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from collections import deque
from math import sqrt
from pathlib import Path

from PIL import Image, ImageChops


FRAME = 96
ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DEFAULT = ROOT / "public" / "assets" / "generated" / "style-b-wall-prototypes" / "golden-v1"
FAMILIES = ("built", "fortified", "natural", "corridor")
FRAME_NAMES = (
    "north",
    "east",
    "south",
    "west",
    "convex-north-west",
    "convex-north-east",
    "convex-south-east",
    "convex-south-west",
    "concave-north-west",
    "concave-north-east",
    "concave-south-east",
    "concave-south-west",
    "diagonal-north-west-south-east",
    "diagonal-north-east-south-west",
    "reserve-1",
    "reserve-2",
)


@dataclass(frozen=True)
class SafeEnvelope:
    left: int
    top: int
    right: int
    bottom: int

    def contains(self, bbox: tuple[int, int, int, int]) -> bool:
        left, top, right, bottom = bbox
        return left >= self.left and top >= self.top and right <= self.right and bottom <= self.bottom


ROOM_EDGE_SAFE = (
    SafeEnvelope(22, 12, 74, 58),
    SafeEnvelope(38, 22, 84, 74),
    SafeEnvelope(22, 38, 74, 86),
    SafeEnvelope(12, 22, 58, 74),
)
ROOM_JOINT_SAFE = SafeEnvelope(22, 22, 74, 78)
NATURAL_SAFE = SafeEnvelope(20, 20, 76, 80)
CORRIDOR_EDGE_SAFE = (
    SafeEnvelope(24, 34, 72, 66),
    SafeEnvelope(32, 24, 64, 72),
    SafeEnvelope(24, 34, 72, 66),
    SafeEnvelope(32, 24, 64, 72),
)
CORRIDOR_JOINT_SAFE = SafeEnvelope(30, 30, 66, 70)
THRESHOLD_SAFE = (
    SafeEnvelope(24, 36, 72, 64),
    SafeEnvelope(34, 24, 66, 72),
    SafeEnvelope(24, 36, 72, 64),
    SafeEnvelope(34, 24, 66, 72),
)

# Target material bounds are deliberately smaller than the safe envelopes.
# The difference is reserved for Lanczos antialiasing and down-right shadows.
ROOM_EDGE_TARGET = (
    SafeEnvelope(28, 18, 68, 56),
    SafeEnvelope(40, 28, 78, 68),
    SafeEnvelope(28, 40, 68, 80),
    SafeEnvelope(18, 28, 56, 68),
)
ROOM_CONVEX_TARGET = SafeEnvelope(31, 29, 67, 71)
ROOM_CONCAVE_TARGET = SafeEnvelope(33, 31, 65, 69)
ROOM_DIAGONAL_TARGET = SafeEnvelope(32, 31, 66, 69)
NATURAL_EDGE_TARGET = (
    SafeEnvelope(26, 31, 70, 69),
    SafeEnvelope(29, 26, 69, 70),
    SafeEnvelope(26, 31, 70, 71),
    SafeEnvelope(27, 26, 67, 70),
)
NATURAL_CONVEX_TARGET = SafeEnvelope(29, 28, 69, 72)
NATURAL_CONCAVE_TARGET = SafeEnvelope(31, 30, 67, 70)
NATURAL_DIAGONAL_TARGET = SafeEnvelope(30, 29, 68, 71)
CORRIDOR_EDGE_TARGET = (
    SafeEnvelope(28, 39, 68, 59),
    SafeEnvelope(38, 28, 58, 68),
    SafeEnvelope(28, 37, 68, 59),
    SafeEnvelope(38, 28, 58, 68),
)
CORRIDOR_CONVEX_TARGET = SafeEnvelope(35, 33, 61, 65)
CORRIDOR_CONCAVE_TARGET = SafeEnvelope(37, 35, 59, 63)
CORRIDOR_DIAGONAL_TARGET = SafeEnvelope(35, 33, 61, 65)
THRESHOLD_TARGET = (
    SafeEnvelope(28, 41, 68, 57),
    SafeEnvelope(40, 28, 56, 68),
    SafeEnvelope(28, 39, 68, 57),
    SafeEnvelope(40, 28, 56, 68),
)


def chroma_key(image: Image.Image, inner: float, outer: float) -> Image.Image:
    """Turn #ff00ff and its antialias fringe into alpha.

    The distance ramp intentionally also accepts the slightly noisy magenta of
    ImageGen outputs. Source alpha, when present, is multiplied into the key.
    """
    rgba = image.convert("RGBA")
    keyed: list[tuple[int, int, int, int]] = []
    for red, green, blue, source_alpha in rgba.getdata():
        # ImageGen often paints a one-pixel hot-pink rim where the opaque
        # sprite meets the key color. Euclidean distance alone leaves that rim
        # partly visible. Golden-v1 art has no bright magenta material, so this
        # high-saturation key family can be removed decisively without touching
        # the much darker plum masonry.
        magenta_dominance = min(red, blue) - green
        if red > 140 and blue > 140 and magenta_dominance > 90:
            keyed.append((0, 0, 0, 0))
            continue
        distance = sqrt((255 - red) ** 2 + green**2 + (255 - blue) ** 2)
        if distance <= inner:
            key_alpha = 0
        elif distance >= outer:
            key_alpha = 255
        else:
            key_alpha = round(255 * (distance - inner) / (outer - inner))
        output_alpha = round(source_alpha * key_alpha / 255)
        keyed.append((red, green, blue, output_alpha) if output_alpha else (0, 0, 0, 0))
    result = Image.new("RGBA", rgba.size)
    result.putdata(keyed)
    return result


def premultiplied_resize(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Resize RGBA without pulling chroma RGB into transparent edges."""
    return image.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA")


def clean_chroma_fringe(image: Image.Image) -> Image.Image:
    """Remove residual saturated-magenta pixels after downsampling.

    ImageGen's key edge can be darker than the #ff00ff field, and Lanczos may
    reintroduce it at low alpha. The shipped palettes contain dark plum but no
    high-dominance magenta, which keeps this cleanup material-safe.
    """
    cleaned: list[tuple[int, int, int, int]] = []
    for red, green, blue, alpha in image.convert("RGBA").getdata():
        dominance = min(red, blue) - green
        if alpha < 8 or (red > 80 and blue > 80 and dominance > 45):
            cleaned.append((0, 0, 0, 0))
        else:
            cleaned.append((red, green, blue, alpha))
    result = Image.new("RGBA", image.size)
    result.putdata(cleaned)
    return result


def keep_primary_component(image: Image.Image, cutoff: int = 24) -> Image.Image:
    """Discard grid fragments, labels and ImageGen debris outside the main object."""
    width, height = image.size
    alpha = image.getchannel("A")
    present = bytearray(1 if value >= cutoff else 0 for value in alpha.getdata())
    visited = bytearray(width * height)
    largest: list[int] = []
    for start, occupied in enumerate(present):
        if not occupied or visited[start]:
            continue
        component: list[int] = []
        queue = deque([start])
        visited[start] = 1
        while queue:
            index = queue.popleft()
            component.append(index)
            x = index % width
            y = index // width
            for nx, ny in (
                (x - 1, y - 1), (x, y - 1), (x + 1, y - 1),
                (x - 1, y), (x + 1, y),
                (x - 1, y + 1), (x, y + 1), (x + 1, y + 1),
            ):
                if nx < 0 or ny < 0 or nx >= width or ny >= height:
                    continue
                neighbour = ny * width + nx
                if present[neighbour] and not visited[neighbour]:
                    visited[neighbour] = 1
                    queue.append(neighbour)
        if len(component) > len(largest):
            largest = component
    if not largest:
        return Image.new("RGBA", image.size)

    # Keep the source antialias fringe around the selected opaque component.
    xs = [index % width for index in largest]
    ys = [index // width for index in largest]
    left = max(0, min(xs) - 3)
    top = max(0, min(ys) - 3)
    right = min(width, max(xs) + 4)
    bottom = min(height, max(ys) + 4)
    result = Image.new("RGBA", image.size)
    result.alpha_composite(image.crop((left, top, right, bottom)), (left, top))
    return result


def target_envelope(family: str, index: int) -> SafeEnvelope:
    if family == "corridor":
        if index < 4:
            return CORRIDOR_EDGE_TARGET[index]
        if index < 8:
            return CORRIDOR_CONVEX_TARGET
        if index < 12:
            return CORRIDOR_CONCAVE_TARGET
        return CORRIDOR_DIAGONAL_TARGET
    if family == "natural":
        if index < 4:
            return NATURAL_EDGE_TARGET[index]
        if index < 8:
            return NATURAL_CONVEX_TARGET
        if index < 12:
            return NATURAL_CONCAVE_TARGET
        return NATURAL_DIAGONAL_TARGET
    if index < 4:
        return ROOM_EDGE_TARGET[index]
    if index < 8:
        return ROOM_CONVEX_TARGET
    if index < 12:
        return ROOM_CONCAVE_TARGET
    return ROOM_DIAGONAL_TARGET


def fit_about_pivot(
    image: Image.Image,
    source_pivot: tuple[float, float],
    target: SafeEnvelope,
) -> Image.Image:
    """Scale the isolated object while mapping the authored cell center to 48,48."""
    bbox = alpha_bbox(image)
    if bbox is None:
        return Image.new("RGBA", (FRAME, FRAME))
    pivot_x, pivot_y = source_pivot
    left_extent = max(1.0, pivot_x - bbox[0])
    right_extent = max(1.0, bbox[2] - pivot_x)
    top_extent = max(1.0, pivot_y - bbox[1])
    bottom_extent = max(1.0, bbox[3] - pivot_y)
    # ImageGen source modules are concept art, not metrically correct sprites:
    # horizontal walls in particular tend to be painted much wider than their
    # facade is deep. Fit each axis independently around the authored pivot so
    # the runtime target regains the intended 2.5D mass instead of collapsing
    # the facade to a thin rail.
    scale_x = min(
        (48 - target.left) / left_extent,
        (target.right - 48) / right_extent,
    )
    scale_y = min(
        (48 - target.top) / top_extent,
        (target.bottom - 48) / bottom_extent,
    )
    if scale_x <= 0 or scale_y <= 0:
        raise ValueError(f"Invalid target envelope {target}")

    resized = premultiplied_resize(
        image,
        (
            max(1, round(image.width * scale_x)),
            max(1, round(image.height * scale_y)),
        ),
    )
    scaled_pivot_x = pivot_x * resized.width / image.width
    scaled_pivot_y = pivot_y * resized.height / image.height
    visible = alpha_bbox(resized)
    if visible is None:
        return Image.new("RGBA", (FRAME, FRAME))
    crop = resized.crop(visible)
    destination_x = round(48 - scaled_pivot_x + visible[0])
    destination_y = round(48 - scaled_pivot_y + visible[1])
    canvas = Image.new("RGBA", (FRAME, FRAME))
    canvas.alpha_composite(crop, (destination_x, destination_y))
    return clean_chroma_fringe(canvas)


def fit_straight_edge(image: Image.Image, target: SafeEnvelope) -> Image.Image:
    """Fit a generated straight to its directional world-space envelope.

    Wall sprites are boundary anchored: north/west mass belongs mostly outside
    the open tile and south/east mass belongs on the opposite side. ImageGen
    centers the painted object, so mapping its source canvas center would close
    a one-tile passage. Straight frames instead fill an explicitly directional
    target bbox while their Phaser pivot remains the fixed frame center.
    """
    bbox = alpha_bbox(image)
    if bbox is None:
        return Image.new("RGBA", (FRAME, FRAME))
    crop = image.crop(bbox)
    resized = premultiplied_resize(
        crop,
        (target.right - target.left, target.bottom - target.top),
    )
    canvas = Image.new("RGBA", (FRAME, FRAME))
    canvas.alpha_composite(resized, (target.left, target.top))
    return clean_chroma_fringe(canvas)


def source_cell(sheet: Image.Image, columns: int, rows: int, index: int, gutter: int) -> tuple[Image.Image, tuple[float, float]]:
    column = index % columns
    row = index // columns
    raw_left = round(column * sheet.width / columns)
    raw_right = round((column + 1) * sheet.width / columns)
    raw_top = round(row * sheet.height / rows)
    raw_bottom = round((row + 1) * sheet.height / rows)
    left = raw_left + gutter
    right = raw_right - gutter
    top = raw_top + gutter
    bottom = raw_bottom - gutter
    if left >= right or top >= bottom:
        raise ValueError(f"Source gutter {gutter} consumes cell {index}")
    # The grid vertex remains the center of the original 313/314 px cell even
    # when white separator lines are trimmed from all four sides.
    pivot = ((raw_left + raw_right) / 2 - left, (raw_top + raw_bottom) / 2 - top)
    return sheet.crop((left, top, right, bottom)), pivot


def split_wall_sheet(
    path: Path,
    family: str,
    inner: float,
    outer: float,
    gutter: int,
) -> list[Image.Image]:
    sheet = Image.open(path).convert("RGBA")
    if sheet.width != sheet.height:
        raise ValueError(f"{path}: wall source must be a square 4x4 sheet; got {sheet.size}")
    frames: list[Image.Image] = []
    for index in range(16):
        cell, pivot = source_cell(sheet, 4, 4, index, gutter)
        keyed = keep_primary_component(chroma_key(cell, inner, outer))
        target = target_envelope(family, index)
        frames.append(
            fit_straight_edge(keyed, target)
            if index < 4
            else fit_about_pivot(keyed, pivot, target)
        )
    return frames


def split_threshold_sheet(path: Path, inner: float, outer: float, gutter: int) -> list[Image.Image]:
    sheet = Image.open(path).convert("RGBA")
    if sheet.width == sheet.height and sheet.width % 2 == 0:
        columns, rows = 2, 2
    elif sheet.width == sheet.height * 4:
        columns, rows = 4, 1
    else:
        raise ValueError(f"{path}: threshold source must be square 2x2 or 4x1; got {sheet.size}")
    frames: list[Image.Image] = []
    for index in range(4):
        cell, pivot = source_cell(sheet, columns, rows, index, gutter)
        keyed = keep_primary_component(chroma_key(cell, inner, outer))
        frames.append(fit_about_pivot(keyed, pivot, THRESHOLD_TARGET[index]))
    return frames


def single_wall_frame(
    path: Path,
    family: str,
    index: int,
    inner: float,
    outer: float,
) -> Image.Image:
    """Normalize one square correction master around its canvas-center pivot."""
    source = Image.open(path).convert("RGBA")
    if source.width != source.height:
        raise ValueError(f"{path}: correction source must be square; got {source.size}")
    keyed = keep_primary_component(chroma_key(source, inner, outer))
    return fit_about_pivot(
        keyed,
        (source.width / 2, source.height / 2),
        target_envelope(family, index),
    )


def alpha_bbox(frame: Image.Image, cutoff: int = 8) -> tuple[int, int, int, int] | None:
    return frame.getchannel("A").point(lambda value: 255 if value >= cutoff else 0).getbbox()


def mask_difference(left: Image.Image, right: Image.Image) -> bool:
    return ImageChops.difference(left.getchannel("A"), right.getchannel("A")).getbbox() is not None


def alpha_count(frame: Image.Image, box: tuple[int, int, int, int], cutoff: int = 64) -> int:
    return sum(value >= cutoff for value in frame.getchannel("A").crop(box).getdata())


def safe_envelope(family: str, index: int) -> SafeEnvelope:
    if family == "corridor":
        return CORRIDOR_EDGE_SAFE[index] if index < 4 else CORRIDOR_JOINT_SAFE
    if family == "natural":
        return NATURAL_SAFE
    return ROOM_EDGE_SAFE[index] if index < 4 else ROOM_JOINT_SAFE


def validate_wall_frames(family: str, frames: list[Image.Image]) -> list[str]:
    errors: list[str] = []
    for index, frame in enumerate(frames):
        bbox = alpha_bbox(frame)
        if index >= 14:
            if bbox is not None:
                errors.append(f"{family}:{index} {FRAME_NAMES[index]} must be completely empty; bbox={bbox}")
            continue
        if bbox is None:
            errors.append(f"{family}:{index} {FRAME_NAMES[index]} is empty")
            continue
        envelope = safe_envelope(family, index)
        if not envelope.contains(bbox):
            errors.append(f"{family}:{index} {FRAME_NAMES[index]} bbox={bbox} exceeds safe envelope={envelope}")

    for group, label in (((4, 5, 6, 7), "convex"), ((8, 9, 10, 11), "concave")):
        for offset, left in enumerate(group):
            for right in group[offset + 1 :]:
                if not mask_difference(frames[left], frames[right]):
                    errors.append(f"{family}:{label} frames {left}/{right} have identical alpha silhouettes")
    for convex, concave in zip(range(4, 8), range(8, 12)):
        if not mask_difference(frames[convex], frames[concave]):
            errors.append(f"{family}:convex/concave frames {convex}/{concave} have identical alpha silhouettes")
    if not mask_difference(frames[12], frames[13]):
        errors.append(f"{family}:diagonal frames 12/13 have identical alpha silhouettes")

    # Each oriented corner must actually reach its two incident edge arms.
    probes = {
        "north": (43, 30, 53, 42),
        "east": (54, 43, 66, 53),
        "south": (43, 54, 53, 66),
        "west": (30, 43, 42, 53),
    }
    arms = (
        ("north", "west"),
        ("north", "east"),
        ("south", "east"),
        ("south", "west"),
    )
    for base in (4, 8):
        for quadrant, expected in enumerate(arms):
            frame = frames[base + quadrant]
            for arm in expected:
                if alpha_count(frame, probes[arm]) < 4:
                    errors.append(f"{family}:{base + quadrant} {FRAME_NAMES[base + quadrant]} misses {arm} arm contact")

    diagonal_probes = (
        ((34, 34, 47, 47), (49, 49, 62, 62)),
        ((49, 34, 62, 47), (34, 49, 47, 62)),
    )
    for index, probes_pair in zip((12, 13), diagonal_probes):
        if any(alpha_count(frames[index], probe) < 4 for probe in probes_pair):
            errors.append(f"{family}:{index} {FRAME_NAMES[index]} does not span its named diagonal")
    return errors


def validate_threshold_frames(name: str, frames: list[Image.Image]) -> list[str]:
    errors: list[str] = []
    for index, frame in enumerate(frames):
        bbox = alpha_bbox(frame)
        if bbox is None:
            errors.append(f"threshold-{name}:{index} is empty")
        elif not THRESHOLD_SAFE[index].contains(bbox):
            errors.append(
                f"threshold-{name}:{index} bbox={bbox} exceeds safe envelope={THRESHOLD_SAFE[index]}"
            )
    return errors


def pack_wall(frames: list[Image.Image]) -> Image.Image:
    atlas = Image.new("RGBA", (FRAME * 4, FRAME * 4))
    for index, frame in enumerate(frames):
        atlas.alpha_composite(frame, ((index % 4) * FRAME, (index // 4) * FRAME))
    return atlas


def pack_threshold(frames: list[Image.Image]) -> Image.Image:
    atlas = Image.new("RGBA", (FRAME * 4, FRAME))
    for index, frame in enumerate(frames):
        atlas.alpha_composite(frame, (index * FRAME, 0))
    return atlas


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    for family in FAMILIES:
        parser.add_argument(f"--{family}", type=Path, help=f"4x4 chroma source for {family} walls")
    parser.add_argument("--threshold-built", type=Path, help="2x2 or 4x1 built-threshold chroma source")
    parser.add_argument("--threshold-natural", type=Path, help="2x2 or 4x1 natural-threshold chroma source")
    parser.add_argument("--built-frame-10", type=Path, help="optional square correction master for built concave SE")
    parser.add_argument("--corridor-frame-11", type=Path, help="optional square correction master for corridor concave SW")
    parser.add_argument("--output", type=Path, default=OUTPUT_DEFAULT)
    parser.add_argument("--key-inner", type=float, default=28.0)
    parser.add_argument("--key-outer", type=float, default=150.0)
    parser.add_argument(
        "--source-gutter",
        type=int,
        default=8,
        help="pixels trimmed from every generated cell edge to discard white grid lines",
    )
    parser.add_argument("--allow-contract-errors", action="store_true", help="write atlases even when validation fails")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.key_outer <= args.key_inner:
        raise ValueError("--key-outer must be greater than --key-inner")
    args.output.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []
    wall_frames: dict[str, list[Image.Image]] = {}
    threshold_frames: dict[str, list[Image.Image]] = {}

    for family in FAMILIES:
        source = getattr(args, family)
        if source is None:
            continue
        frames = split_wall_sheet(source, family, args.key_inner, args.key_outer, args.source_gutter)
        wall_frames[family] = frames

    corrections = (
        ("built", 10, args.built_frame_10),
        ("corridor", 11, args.corridor_frame_11),
    )
    for family, index, source in corrections:
        if source is None:
            continue
        if family not in wall_frames:
            raise ValueError(f"--{family}-frame-{index} requires --{family}")
        wall_frames[family][index] = single_wall_frame(
            source,
            family,
            index,
            args.key_inner,
            args.key_outer,
        )

    for family, frames in wall_frames.items():
        failures.extend(validate_wall_frames(family, frames))

    for name in ("built", "natural"):
        source = getattr(args, f"threshold_{name}")
        if source is None:
            continue
        frames = split_threshold_sheet(source, args.key_inner, args.key_outer, args.source_gutter)
        failures.extend(validate_threshold_frames(name, frames))
        threshold_frames[name] = frames

    if not wall_frames and not threshold_frames:
        raise ValueError("No input sheets supplied")
    if failures:
        print("Golden-v1 contract errors:")
        for failure in failures:
            print(f"- {failure}")
        if not args.allow_contract_errors:
            raise SystemExit(2)

    # Prototype runtime always receives all ten files. Until distinct art is
    # authored, fortified intentionally mirrors built and natural mirrors
    # corridor. A missing pair becomes a transparent placeholder, never a 404.
    if "built" in wall_frames and "fortified" not in wall_frames:
        wall_frames["fortified"] = [frame.copy() for frame in wall_frames["built"]]
    if "fortified" in wall_frames and "built" not in wall_frames:
        wall_frames["built"] = [frame.copy() for frame in wall_frames["fortified"]]
    if "corridor" in wall_frames and "natural" not in wall_frames:
        wall_frames["natural"] = [frame.copy() for frame in wall_frames["corridor"]]
    if "natural" in wall_frames and "corridor" not in wall_frames:
        wall_frames["corridor"] = [frame.copy() for frame in wall_frames["natural"]]

    empty_wall = Image.new("RGBA", (FRAME * 4, FRAME * 4))
    empty_threshold = Image.new("RGBA", (FRAME * 4, FRAME))
    pending: list[tuple[Path, Image.Image]] = []
    for family in FAMILIES:
        atlas = pack_wall(wall_frames[family]) if family in wall_frames else empty_wall.copy()
        pending.append((args.output / f"wall-atlas-{family}.png", atlas))
    for name in ("built", "natural"):
        atlas = pack_threshold(threshold_frames[name]) if name in threshold_frames else empty_threshold.copy()
        pending.append((args.output / f"threshold-{name}.png", atlas))

    # A flattened painted sheet does not robustly reveal which pixels belong to
    # a front facade. Empty occlusion atlases are safer than accidentally hiding
    # floors/units; hand-validated masks can replace them without runtime work.
    for family in FAMILIES:
        pending.append((args.output / f"occlusion-atlas-{family}.png", empty_wall.copy()))

    for path, atlas in pending:
        atlas.save(path, optimize=True)
        print(f"Wrote {path} ({atlas.width}x{atlas.height})")


if __name__ == "__main__":
    main()
