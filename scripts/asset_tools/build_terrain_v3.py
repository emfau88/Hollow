from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps


ROOT = Path(__file__).resolve().parents[2]
TERRAIN = ROOT / "public" / "assets" / "generated" / "terrain-v3"
PROPS = ROOT / "public" / "assets" / "generated" / "room-props-v3"
TERRAIN_SOURCE = TERRAIN / "sources"
PROP_SOURCE = PROPS / "sources"

TILE = 32
SHEET_TILES = 16


def save_surface(source: str, output: str, brightness: float, contrast: float, saturation: float) -> Image.Image:
    image = Image.open(TERRAIN_SOURCE / source).convert("RGB")
    image = ImageEnhance.Brightness(image).enhance(brightness)
    image = ImageEnhance.Contrast(image).enhance(contrast)
    image = ImageEnhance.Color(image).enhance(saturation)
    image = image.resize((TILE * SHEET_TILES, TILE * SHEET_TILES), Image.Resampling.LANCZOS)
    image.save(TERRAIN / output, optimize=True)
    return image


def trim_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Asset has no opaque pixels")
    return rgba.crop(bbox)


def fit_inside(image: Image.Image, size: tuple[int, int], anchor: str = "center") -> Image.Image:
    fitted = ImageOps.contain(trim_alpha(image), size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    if anchor == "top":
        position = ((size[0] - fitted.width) // 2, 0)
    elif anchor == "top-right":
        position = (size[0] - fitted.width, 0)
    else:
        position = ((size[0] - fitted.width) // 2, (size[1] - fitted.height) // 2)
    canvas.alpha_composite(fitted, position)
    return canvas


def cool_stone(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    rgb = ImageEnhance.Color(rgba.convert("RGB")).enhance(0.18)
    cool = Image.new("RGB", rgb.size, (116, 126, 132))
    rgb = Image.blend(rgb, cool, 0.10)
    return Image.merge("RGBA", (*rgb.split(), alpha))


def central_strip(image: Image.Image, left: float = 0.25, right: float = 0.75) -> Image.Image:
    trimmed = trim_alpha(image)
    x0 = round(trimmed.width * left)
    x1 = round(trimmed.width * right)
    return trim_alpha(trimmed.crop((x0, 0, x1, trimmed.height)))


def quadrant(image: Image.Image, column: int, row: int) -> Image.Image:
    width, height = image.size
    return image.crop(
        (
            column * width // 2,
            row * height // 2,
            (column + 1) * width // 2,
            (row + 1) * height // 2,
        )
    )


def prop_cell(image: Image.Image, column: int, row: int) -> Image.Image:
    width, height = image.size
    return image.crop(
        (
            column * width // 3,
            row * height // 2,
            (column + 1) * width // 3,
            (row + 1) * height // 2,
        )
    )


def build_edges() -> dict[str, Image.Image]:
    source = Image.open(TERRAIN_SOURCE / "edges-and-borders-alpha.png").convert("RGBA")

    straight = central_strip(quadrant(source, 0, 0), 0.2, 0.8)
    edge = fit_inside(straight, (TILE, 12), "top")
    edge_canvas = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    edge_canvas.alpha_composite(edge, (0, 0))

    corner_source = trim_alpha(quadrant(source, 1, 0))
    corner = fit_inside(corner_source, (TILE, 22), "top-right")
    corner_canvas = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    corner_canvas.alpha_composite(corner, (0, 0))

    claim_source = central_strip(quadrant(source, 0, 1), 0.12, 0.42)
    claim = fit_inside(claim_source, (TILE, 5), "top")
    claim_canvas = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    claim_canvas.alpha_composite(claim, (0, 2))

    enemy_source = central_strip(quadrant(source, 1, 1), 0.12, 0.42)
    enemy = fit_inside(enemy_source, (TILE, 5), "top")
    enemy_canvas = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    enemy_canvas.alpha_composite(enemy, (0, 2))

    outputs = {
        "wall-edge.png": cool_stone(edge_canvas),
        "wall-corner.png": cool_stone(corner_canvas),
        "claimed-border.png": claim_canvas,
        "enemy-border.png": enemy_canvas,
    }
    for name, image in outputs.items():
        image.save(TERRAIN / name, optimize=True)
    return outputs


def build_props() -> dict[str, Image.Image]:
    source = Image.open(PROP_SOURCE / "room-props-alpha.png").convert("RGBA")
    specs = {
        "bed.png": (0, 0, (30, 46)),
        "cauldron.png": (1, 0, (42, 42)),
        "furnace.png": (2, 0, (42, 48)),
        "workbench.png": (0, 1, (48, 36)),
        "prison-gate.png": (1, 1, (48, 40)),
        "storage.png": (2, 1, (42, 42)),
    }
    outputs: dict[str, Image.Image] = {}
    for name, (column, row, size) in specs.items():
        image = fit_inside(prop_cell(source, column, row), size)
        image.save(PROPS / name, optimize=True)
        outputs[name] = image
    return outputs


def make_preview(
    surfaces: list[Image.Image],
    edges: dict[str, Image.Image],
    props: dict[str, Image.Image],
) -> None:
    terrain_preview = Image.new("RGB", (448, 176), (10, 11, 14))
    for index, image in enumerate(surfaces):
        enlarged = image.resize((128, 128), Image.Resampling.NEAREST)
        terrain_preview.paste(enlarged, (16 + index * 144, 16))
    for index, image in enumerate(edges.values()):
        enlarged = image.resize((64, 64), Image.Resampling.NEAREST)
        terrain_preview.paste(enlarged, (16 + index * 104, 112), enlarged)
    terrain_preview.save(TERRAIN / "terrain-v3-preview.png", optimize=True)

    props_preview = Image.new("RGBA", (288, 144), (10, 11, 14, 255))
    for index, image in enumerate(props.values()):
        column = index % 3
        row = index // 3
        enlarged = ImageOps.contain(image, (80, 56), Image.Resampling.NEAREST)
        x = column * 96 + (96 - enlarged.width) // 2
        y = row * 72 + (72 - enlarged.height) // 2
        props_preview.alpha_composite(enlarged, (x, y))
    props_preview.save(PROPS / "room-props-v3-preview.png", optimize=True)


def main() -> None:
    TERRAIN.mkdir(parents=True, exist_ok=True)
    PROPS.mkdir(parents=True, exist_ok=True)

    rock = save_surface("rock-top-master.png", "rock-top.png", 1.02, 0.98, 0.66)
    raw = save_surface("raw-floor-master.png", "raw-floor.png", 0.97, 0.98, 0.58)
    claimed = save_surface("claimed-floor-master.png", "claimed-floor.png", 0.99, 0.90, 0.72)
    edges = build_edges()
    props = build_props()
    make_preview([rock, raw, claimed], edges, props)


if __name__ == "__main__":
    main()
