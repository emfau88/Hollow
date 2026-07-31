"""Build the first production slice for the Style B visual theme.

Imagegen is used only for the authored character/prop masters. This script
performs deterministic cropping, scale normalisation and terrain grading so
the exact same runtime assets can be rebuilt from the checked-in sources.
"""

from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[2]
GENERATED = ROOT / "public" / "assets" / "generated"
SOURCE = GENERATED / "style-b-v1" / "sources"
OUTPUT = SOURCE.parent
TERRAIN_SOURCE = GENERATED / "terrain-v3"


def ensure_dirs() -> None:
    for folder in ("terrain", "characters", "props", "resources"):
        (OUTPUT / folder).mkdir(parents=True, exist_ok=True)


def crop_cell(sheet: Image.Image, columns: int, rows: int, column: int, row: int) -> Image.Image:
    left = round(column * sheet.width / columns)
    right = round((column + 1) * sheet.width / columns)
    top = round(row * sheet.height / rows)
    bottom = round((row + 1) * sheet.height / rows)
    cell = sheet.crop((left, top, right, bottom))
    bounds = cell.getchannel("A").getbbox()
    if bounds is None:
        raise RuntimeError(f"No visible pixels in cell {column}, {row}")
    return cell.crop(bounds)


def normalise_sprite(
    sprite: Image.Image,
    size: int,
    path: Path,
    *,
    padding: int,
    align_bottom: bool = False,
) -> Image.Image:
    scale = min((size - padding * 2) / sprite.width, (size - padding * 2) / sprite.height)
    dimensions = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
    sprite = sprite.resize(dimensions, Image.Resampling.LANCZOS)
    sprite = sprite.filter(ImageFilter.UnsharpMask(radius=0.55, percent=118, threshold=2))
    canvas = Image.new("RGBA", (size, size))
    x = (size - dimensions[0]) // 2
    y = size - padding - dimensions[1] if align_bottom else (size - dimensions[1]) // 2
    canvas.alpha_composite(sprite, (x, y))
    canvas.save(path, optimize=True)
    return canvas


def colorise_surface(filename: str, output_name: str, shadows: str, midtones: str, highlights: str) -> Image.Image:
    source = Image.open(TERRAIN_SOURCE / filename).convert("RGBA")
    alpha = source.getchannel("A")
    luminance = ImageOps.grayscale(source)
    graded = ImageOps.colorize(luminance, shadows, highlights, mid=midtones, midpoint=126).convert("RGBA")
    graded.putalpha(alpha)
    graded = ImageEnhance.Contrast(graded).enhance(1.04)
    graded.save(OUTPUT / "terrain" / output_name, optimize=True)
    return graded


def build_terrain() -> list[Image.Image]:
    surfaces = [
        colorise_surface("rock-top.png", "rock-top.png", "#071427", "#1f3557", "#486589"),
        colorise_surface("rock-basalt.png", "rock-basalt.png", "#08111f", "#192a45", "#354865"),
        colorise_surface("rock-damp.png", "rock-damp.png", "#09202c", "#244958", "#4d807d"),
        colorise_surface("rock-roots.png", "rock-roots.png", "#0b1727", "#2e3850", "#6d684f"),
        colorise_surface("rock-earth.png", "rock-earth.png", "#111625", "#3f312b", "#785943"),
        colorise_surface("raw-floor.png", "raw-floor.png", "#0b1b2c", "#234052", "#4b6f74"),
        colorise_surface("claimed-corridor.png", "claimed-corridor.png", "#15182a", "#3c3147", "#80666b"),
        colorise_surface("claimed-floor.png", "claimed-floor.png", "#19172c", "#483550", "#97746f"),
    ]
    colorise_surface("wall-edge.png", "wall-edge.png", "#111b2d", "#647086", "#e8d9af")
    colorise_surface("wall-corner.png", "wall-corner.png", "#111b2d", "#647086", "#e8d9af")
    colorise_surface("claimed-border.png", "claimed-border.png", "#5a3510", "#d19a2a", "#ffe091")
    colorise_surface("enemy-border.png", "enemy-border.png", "#4a1720", "#c14b4f", "#ff9b82")
    return surfaces


def build_characters() -> dict[str, Image.Image]:
    sheet = Image.open(SOURCE / "characters-alpha.png").convert("RGBA")
    worker = crop_cell(sheet, 3, 1, 1, 0)
    # The heart anchor slightly crosses the conceptual column boundary in the
    # generated master. Trim that disconnected sliver before normalising the
    # worker; the authored pickaxe begins comfortably farther to the right.
    worker = worker.crop((52, 0, worker.width, worker.height))
    return {
        "heart": normalise_sprite(crop_cell(sheet, 3, 1, 0, 0), 256, OUTPUT / "characters" / "heart.png", padding=8),
        "worker": normalise_sprite(worker, 96, OUTPUT / "characters" / "worker.png", padding=3, align_bottom=True),
        "guard": normalise_sprite(crop_cell(sheet, 3, 1, 2, 0), 96, OUTPUT / "characters" / "guard.png", padding=3, align_bottom=True),
    }


def build_props_and_resources() -> dict[str, Image.Image]:
    sheet = Image.open(SOURCE / "props-resources-alpha.png").convert("RGBA")
    assets = {
        "storage": (0, 0, "props", 96),
        "cauldron": (1, 0, "props", 96),
        "workbench": (2, 0, "props", 96),
        "fungus-cluster": (0, 1, "resources", 96),
        "iron-vein": (1, 1, "resources", 96),
        "essence-seal": (2, 1, "resources", 96),
    }
    built: dict[str, Image.Image] = {}
    for name, (column, row, folder, size) in assets.items():
        built[name] = normalise_sprite(
            crop_cell(sheet, 3, 2, column, row),
            size,
            OUTPUT / folder / f"{name}.png",
            padding=3,
        )

    depleted = ImageOps.grayscale(built["iron-vein"]).convert("RGBA")
    depleted = ImageOps.colorize(depleted.getchannel("R"), "#101827", "#697486").convert("RGBA")
    depleted.putalpha(built["iron-vein"].getchannel("A").point(lambda value: round(value * 0.66)))
    depleted.save(OUTPUT / "resources" / "iron-vein-depleted.png", optimize=True)
    built["iron-vein-depleted"] = depleted
    return built


def make_preview(surfaces: list[Image.Image], characters: dict[str, Image.Image], assets: dict[str, Image.Image]) -> None:
    preview = Image.new("RGBA", (640, 320), "#08172c")
    for index, surface in enumerate((surfaces[0], surfaces[5], surfaces[7])):
        swatch = surface.crop((0, 0, 128, 128)).resize((192, 112), Image.Resampling.LANCZOS)
        preview.alpha_composite(swatch, (24 + index * 200, 20))
    x_positions = [22, 138, 236, 334, 432, 530]
    for x, image in zip(x_positions, (
        characters["heart"].resize((108, 108), Image.Resampling.LANCZOS),
        characters["worker"],
        characters["guard"],
        assets["storage"],
        assets["cauldron"],
        assets["fungus-cluster"],
    )):
        preview.alpha_composite(image, (x, 174))
    preview.save(OUTPUT / "style-b-v1-preview.png", optimize=True)


def main() -> None:
    ensure_dirs()
    surfaces = build_terrain()
    characters = build_characters()
    assets = build_props_and_resources()
    make_preview(surfaces, characters, assets)


if __name__ == "__main__":
    main()
