"""Build the Style B worker's pivot-stable walk and digging animation sheet.

The ImageGen masters are deliberately kept as equal-cell sheets. Frames are
never resized to their visible bounding boxes: a raised or extended pickaxe
would otherwise change the character scale. Instead every source cell uses one
common scale, then the navy helmet centre and planted boot line are aligned to
fixed runtime anchors.
"""

from collections import deque
from pathlib import Path
from statistics import median

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public" / "assets" / "generated" / "style-b-worker-v1"
SOURCE = OUTPUT / "sources"
FRAME = 96
BODY_X = 48
FOOT_Y = 76


def crop_cell(sheet: Image.Image, column: int, row: int) -> Image.Image:
    left = round(column * sheet.width / 4)
    right = round((column + 1) * sheet.width / 4)
    top = round(row * sheet.height / 3)
    bottom = round((row + 1) * sheet.height / 3)
    return keep_largest_component(sheet.crop((left, top, right, bottom)))


def keep_largest_component(image: Image.Image) -> Image.Image:
    """Remove disconnected fragments bleeding in from neighbouring cells."""
    width, height = image.size
    alpha = image.getchannel("A")
    opaque = bytearray(1 if value > 24 else 0 for value in alpha.getdata())
    visited = bytearray(width * height)
    largest: list[int] = []

    for start, present in enumerate(opaque):
        if not present or visited[start]:
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
                if opaque[neighbour] and not visited[neighbour]:
                    visited[neighbour] = 1
                    queue.append(neighbour)
        if len(component) > len(largest):
            largest = component

    if not largest:
        raise RuntimeError("Animation cell contains no connected sprite")
    keep = bytearray(width * height)
    for index in largest:
        keep[index] = 1
    source_alpha = list(alpha.getdata())
    cleaned_alpha = Image.new("L", image.size)
    cleaned_alpha.putdata([value if keep[index] else 0 for index, value in enumerate(source_alpha)])
    cleaned = image.copy()
    cleaned.putalpha(cleaned_alpha)
    return cleaned


def place_equal_cell(cell: Image.Image) -> Image.Image:
    """Scale the complete source cell, preserving animation-space geometry."""
    scale = min(86 / cell.width, 86 / cell.height)
    size = (max(1, round(cell.width * scale)), max(1, round(cell.height * scale)))
    resized = cell.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (FRAME, FRAME))
    canvas.alpha_composite(resized, ((FRAME - size[0]) // 2, (FRAME - size[1]) // 2))
    return canvas


def helmet_center(image: Image.Image) -> float:
    points: list[int] = []
    for y in range(FRAME):
        for x in range(FRAME):
            red, green, blue, alpha = image.getpixel((x, y))
            if alpha < 150:
                continue
            # The helmet is the only broad, saturated navy mass in the sprite.
            if blue > 34 and blue > red * 1.22 and blue > green * 1.06 and red < 100:
                points.append(x)
    if points:
        return float(median(points))
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise RuntimeError("Animation cell contains no visible pixels")
    return (bounds[0] + bounds[2] - 1) / 2


def planted_foot_y(image: Image.Image, body_x: float, direction_row: int) -> int:
    candidates: list[int] = []
    for y in range(FRAME // 2, FRAME):
        for x in range(FRAME):
            red, green, blue, alpha = image.getpixel((x, y))
            if alpha < 150:
                continue
            # Warm dark pixels describe boots. Excluding the centre/front or
            # far-right action lane prevents a lowered wooden handle from being
            # mistaken for the planted-foot baseline.
            warm_dark = red > green * 1.12 and green > blue * 1.18 and red < 190
            if not warm_dark:
                continue
            offset = x - body_x
            in_boot_lane = -28 <= offset <= 18 if direction_row == 2 else 8 <= abs(offset) <= 29
            if in_boot_lane:
                candidates.append(y)
    if candidates:
        return max(candidates)

    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise RuntimeError("Animation cell contains no visible pixels")
    return bounds[3] - 1


def translate(image: Image.Image, dx: int, dy: int) -> Image.Image:
    moved = Image.new("RGBA", image.size)
    moved.alpha_composite(image, (dx, dy))
    return moved


def normalise_frame(cell: Image.Image, direction_row: int) -> tuple[Image.Image, tuple[float, int]]:
    frame = place_equal_cell(cell)
    centre = helmet_center(frame)
    foot = planted_foot_y(frame, centre, direction_row)
    frame = translate(frame, round(BODY_X - centre), FOOT_Y - foot)
    frame = frame.filter(ImageFilter.UnsharpMask(radius=0.42, percent=108, threshold=2))

    # Recheck the body anchor after the integer translation. These are the
    # invariants that prevent animation-induced position jitter in Phaser.
    checked_centre = helmet_center(frame)
    checked_foot = planted_foot_y(frame, checked_centre, direction_row)
    if abs(checked_centre - BODY_X) > 1.25 or abs(checked_foot - FOOT_Y) > 1:
        raise RuntimeError(
            f"Unstable frame anchor: helmet={checked_centre:.2f}, foot={checked_foot}"
        )
    bounds = frame.getchannel("A").getbbox()
    if bounds is None or bounds[0] <= 0 or bounds[1] <= 0 or bounds[2] >= FRAME or bounds[3] >= FRAME:
        raise RuntimeError(f"Frame clips its 96px safe area: {bounds}")
    return frame, (checked_centre, checked_foot)


def make_preview(sheet: Image.Image) -> None:
    scale = 2
    margin = 18
    preview = Image.new("RGBA", (FRAME * 4 * scale + margin * 2, FRAME * 6 * scale + margin * 2), "#071427")
    enlarged = sheet.resize((sheet.width * scale, sheet.height * scale), Image.Resampling.NEAREST)
    preview.alpha_composite(enlarged, (margin, margin))
    draw = ImageDraw.Draw(preview)
    for row in range(7):
        y = margin + row * FRAME * scale
        draw.line((margin, y, preview.width - margin, y), fill=(216, 165, 50, 75), width=1)
    for column in range(5):
        x = margin + column * FRAME * scale
        draw.line((x, margin, x, preview.height - margin), fill=(216, 165, 50, 55), width=1)
    preview.save(OUTPUT / "worker-animation-preview.png", optimize=True)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    walk = Image.open(SOURCE / "worker-walk-master-alpha.png").convert("RGBA")
    dig = Image.open(SOURCE / "worker-dig-master-alpha.png").convert("RGBA")
    runtime = Image.new("RGBA", (FRAME * 4, FRAME * 6))
    diagnostics: list[str] = []

    for action_index, (action, master) in enumerate((("walk", walk), ("dig", dig))):
        for row, direction in enumerate(("down", "up", "side")):
            output_row = action_index * 3 + row
            for column in range(4):
                frame, anchor = normalise_frame(crop_cell(master, column, row), row)
                runtime.alpha_composite(frame, (column * FRAME, output_row * FRAME))
                diagnostics.append(
                    f"{action}-{direction}-{column}: body={anchor[0]:.1f}, foot={anchor[1]}"
                )

    runtime.save(OUTPUT / "worker-animation.png", optimize=True)
    make_preview(runtime)
    print("\n".join(diagnostics))
    print(f"Wrote {OUTPUT / 'worker-animation.png'} ({runtime.width}x{runtime.height})")


if __name__ == "__main__":
    main()
