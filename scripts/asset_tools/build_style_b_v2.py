"""Build the Style B v2 heart, servant and start-area production slice.

The checked-in masters are authored with ImageGen. This script performs only
deterministic crops, alpha-safe normalisation and preview composition so the
runtime assets can be reproduced without changing the artwork.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public" / "assets" / "generated" / "style-b-v2"
SOURCE = OUTPUT / "sources"


def ensure_dirs() -> None:
    for folder in ("heart", "characters", "decor"):
        (OUTPUT / folder).mkdir(parents=True, exist_ok=True)


def visible_crop(image: Image.Image) -> Image.Image:
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise RuntimeError("Crop contains no visible pixels")
    return image.crop(bounds)


def crop_cell(
    sheet: Image.Image,
    columns: int,
    rows: int,
    column: int,
    row: int,
    *,
    gutter: int = 0,
) -> Image.Image:
    left = round(column * sheet.width / columns) + (gutter if column else 0)
    right = round((column + 1) * sheet.width / columns) - (gutter if column + 1 < columns else 0)
    top = round(row * sheet.height / rows) + (gutter if row else 0)
    bottom = round((row + 1) * sheet.height / rows) - (gutter if row + 1 < rows else 0)
    return visible_crop(sheet.crop((left, top, right, bottom)))


def crop_fraction(image: Image.Image, box: tuple[float, float, float, float]) -> Image.Image:
    left, top, right, bottom = box
    return visible_crop(image.crop((
        round(left * image.width),
        round(top * image.height),
        round(right * image.width),
        round(bottom * image.height),
    )))


def normalise(
    sprite: Image.Image,
    canvas_size: tuple[int, int],
    path: Path,
    *,
    padding: tuple[int, int] = (4, 4),
    align_bottom: bool = False,
) -> Image.Image:
    width, height = canvas_size
    pad_x, pad_y = padding
    scale = min((width - pad_x * 2) / sprite.width, (height - pad_y * 2) / sprite.height)
    dimensions = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
    sprite = sprite.resize(dimensions, Image.Resampling.LANCZOS)
    sprite = sprite.filter(ImageFilter.UnsharpMask(radius=0.48, percent=112, threshold=2))
    canvas = Image.new("RGBA", canvas_size)
    x = (width - dimensions[0]) // 2
    y = height - pad_y - dimensions[1] if align_bottom else (height - dimensions[1]) // 2
    canvas.alpha_composite(sprite, (x, y))
    canvas.save(path, optimize=True)
    return canvas


def build_heart() -> dict[str, Image.Image]:
    sheet = Image.open(SOURCE / "heart-building-master-alpha.png").convert("RGBA")
    # The master intentionally uses generous unequal spacing. Explicit regions
    # preserve the base stairs and keep all four architecture parts isolated.
    regions = {
        "base": ((0.07, 0.06, 0.50, 0.57), (256, 192), (5, 5)),
        "backplate": ((0.50, 0.01, 0.89, 0.58), (192, 192), (4, 4)),
        "core": ((0.15, 0.58, 0.50, 0.96), (96, 96), (4, 3)),
        "pulpit": ((0.52, 0.58, 0.83, 0.97), (160, 112), (4, 4)),
    }
    built: dict[str, Image.Image] = {}
    for name, (box, size, padding) in regions.items():
        built[name] = normalise(
            crop_fraction(sheet, box),
            size,
            OUTPUT / "heart" / f"{name}.png",
            padding=padding,
            align_bottom=name in {"backplate", "core", "pulpit"},
        )
    return built


def build_characters() -> dict[str, Image.Image]:
    sheet = Image.open(SOURCE / "servants-master-alpha.png").convert("RGBA")
    built: dict[str, Image.Image] = {}
    for column, name in enumerate(("worker", "guard", "archer")):
        built[name] = normalise(
            crop_cell(sheet, 3, 1, column, 0, gutter=4),
            (96, 96),
            OUTPUT / "characters" / f"{name}.png",
            padding=(3, 2),
            align_bottom=True,
        )
    return built


def build_decor() -> dict[str, Image.Image]:
    sheet = Image.open(SOURCE / "start-decor-master-alpha.png").convert("RGBA")
    names = (
        ("lamp", "banner", "rack"),
        ("cart", "supplies", "notice-board"),
        ("fungus-small", "fungus-medium", "grotto-station"),
    )
    built: dict[str, Image.Image] = {}
    for row in range(3):
        for column in range(3):
            name = names[row][column]
            built[name] = normalise(
                crop_cell(sheet, 3, 3, column, row, gutter=5),
                (96, 96),
                OUTPUT / "decor" / f"{name}.png",
                padding=(3, 3),
                align_bottom=True,
            )
    return built


def make_preview(
    heart: dict[str, Image.Image],
    characters: dict[str, Image.Image],
    decor: dict[str, Image.Image],
) -> None:
    preview = Image.new("RGBA", (900, 520), "#071427")
    draw = ImageDraw.Draw(preview)
    draw.rounded_rectangle((24, 24, 470, 316), radius=20, fill="#15263d", outline="#d8a532", width=2)
    draw.rounded_rectangle((492, 24, 876, 316), radius=20, fill="#102c38", outline="#55c9a2", width=2)

    preview.alpha_composite(heart["base"].resize((300, 225), Image.Resampling.LANCZOS), (96, 72))
    preview.alpha_composite(heart["backplate"].resize((168, 168), Image.Resampling.LANCZOS), (162, 56))
    preview.alpha_composite(heart["core"].resize((70, 70), Image.Resampling.LANCZOS), (211, 114))
    preview.alpha_composite(heart["pulpit"].resize((112, 78), Image.Resampling.LANCZOS), (189, 208))

    for image, position, size in (
        (decor["fungus-small"], (520, 85), (82, 82)),
        (decor["fungus-medium"], (620, 72), (126, 126)),
        (decor["grotto-station"], (748, 78), (100, 100)),
        (decor["lamp"], (520, 206), (72, 72)),
        (decor["banner"], (618, 198), (82, 82)),
        (decor["rack"], (732, 198), (96, 96)),
    ):
        preview.alpha_composite(image.resize(size, Image.Resampling.LANCZOS), position)

    for index, name in enumerate(("worker", "guard", "archer")):
        x = 96 + index * 130
        preview.alpha_composite(characters[name].resize((108, 108), Image.Resampling.LANCZOS), (x, 372))
    for index, name in enumerate(("cart", "supplies", "notice-board")):
        x = 514 + index * 122
        preview.alpha_composite(decor[name].resize((104, 104), Image.Resampling.LANCZOS), (x, 372))

    preview.save(OUTPUT / "style-b-v2-preview.png", optimize=True)


def main() -> None:
    ensure_dirs()
    heart = build_heart()
    characters = build_characters()
    decor = build_decor()
    make_preview(heart, characters, decor)


if __name__ == "__main__":
    main()
