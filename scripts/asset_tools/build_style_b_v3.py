"""Build Style B v3 terrain relief, environmental decals and heart mount."""

from pathlib import Path
import shutil

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public" / "assets" / "generated" / "style-b-v3"
SOURCE = OUTPUT / "sources"
V2 = ROOT / "public" / "assets" / "generated" / "style-b-v2"
V1_TERRAIN = ROOT / "public" / "assets" / "generated" / "style-b-v1" / "terrain"


def ensure_dirs() -> None:
    for folder in ("terrain", "walls", "decals", "heart"):
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
    visible: bool = True,
) -> Image.Image:
    left = round(column * sheet.width / columns) + (gutter if column else 0)
    right = round((column + 1) * sheet.width / columns) - (gutter if column + 1 < columns else 0)
    top = round(row * sheet.height / rows) + (gutter if row else 0)
    bottom = round((row + 1) * sheet.height / rows) - (gutter if row + 1 < rows else 0)
    cell = sheet.crop((left, top, right, bottom))
    return visible_crop(cell) if visible else cell


def normalise(
    sprite: Image.Image,
    size: tuple[int, int],
    path: Path,
    *,
    padding: tuple[int, int] = (2, 2),
    align_bottom: bool = False,
) -> Image.Image:
    width, height = size
    pad_x, pad_y = padding
    scale = min((width - pad_x * 2) / sprite.width, (height - pad_y * 2) / sprite.height)
    dimensions = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
    sprite = sprite.resize(dimensions, Image.Resampling.LANCZOS)
    sprite = sprite.filter(ImageFilter.UnsharpMask(radius=0.45, percent=112, threshold=2))
    canvas = Image.new("RGBA", size)
    x = (width - dimensions[0]) // 2
    y = height - pad_y - dimensions[1] if align_bottom else (height - dimensions[1]) // 2
    canvas.alpha_composite(sprite, (x, y))
    canvas.save(path, optimize=True)
    return canvas


def build_walls() -> dict[str, Image.Image]:
    sheet = Image.open(SOURCE / "wall-kit-master-alpha.png").convert("RGBA")
    names = ("north", "east", "south", "west")
    built: dict[str, Image.Image] = {}
    for column, name in enumerate(names):
        straight = crop_cell(sheet, 4, 2, column, 0, gutter=6)
        if name in {"north", "south"}:
            left = round(straight.width * 0.31)
            right = round(straight.width * 0.69)
            straight = visible_crop(straight.crop((left, 0, right, straight.height)))
        else:
            top = round(straight.height * 0.25)
            bottom = round(straight.height * 0.75)
            straight = visible_crop(straight.crop((0, top, straight.width, bottom)))
        built[name] = normalise(straight, (48, 48), OUTPUT / "walls" / f"{name}.png", align_bottom=True)

    # The generated lower row is NE, SW, ES, WN. Keep this explicit: swapping
    # the two middle cells produces mirrored/missing-looking L corners in the
    # small neutral caverns.
    for column, name in ((0, "north-east"), (1, "south-west"), (2, "east-south"), (3, "west-north")):
        corner = crop_cell(sheet, 4, 2, column, 1, gutter=6)
        built[name] = normalise(corner, (64, 64), OUTPUT / "walls" / f"{name}.png", align_bottom=True)
    return built


def seamless_surface(panel: Image.Image, band: int = 32) -> Image.Image:
    # Feather only the opposing outer edge bands into a common value. This
    # keeps the authored macro composition intact and avoids kaleidoscopic
    # mirroring while still making the 16x16 runtime atlas repeat cleanly.
    side = min(panel.width, panel.height)
    panel = ImageOps.fit(panel, (side, side), method=Image.Resampling.LANCZOS)
    surface = panel.resize((512, 512), Image.Resampling.LANCZOS)
    width, height = surface.size
    for offset in range(band):
        t = offset / max(1, band - 1)
        t = t * t * (3 - 2 * t)
        left = surface.crop((offset, 0, offset + 1, height))
        right = surface.crop((width - 1 - offset, 0, width - offset, height))
        average = Image.blend(left, right, 0.5)
        surface.paste(Image.blend(average, left, t), (offset, 0))
        surface.paste(Image.blend(average, right, t), (width - 1 - offset, 0))
    for offset in range(band):
        t = offset / max(1, band - 1)
        t = t * t * (3 - 2 * t)
        top = surface.crop((0, offset, width, offset + 1))
        bottom = surface.crop((0, height - 1 - offset, width, height - offset))
        average = Image.blend(top, bottom, 0.5)
        surface.paste(Image.blend(average, top, t), (0, offset))
        surface.paste(Image.blend(average, bottom, t), (0, height - 1 - offset))
    return surface


def colorise_corridor(source: Image.Image) -> Image.Image:
    luminance = ImageOps.grayscale(source)
    result = ImageOps.colorize(
        luminance,
        black="#101827",
        mid="#313043",
        white="#82706d",
        midpoint=132,
    )
    return ImageEnhance.Contrast(result).enhance(1.06)


def build_terrain() -> dict[str, Image.Image]:
    terrain_dir = OUTPUT / "terrain"
    for source in V1_TERRAIN.glob("*.png"):
        shutil.copy2(source, terrain_dir / source.name)

    sheet = Image.open(SOURCE / "terrain-materials-master.png").convert("RGB")
    panels: dict[str, Image.Image] = {}
    for name, column, row in (
        ("rock-top", 0, 0),
        ("raw-floor", 1, 0),
        ("claimed-floor", 0, 1),
        ("damp-floor", 1, 1),
    ):
        panel = crop_cell(sheet.convert("RGBA"), 2, 2, column, row, gutter=7, visible=False).convert("RGB")
        panels[name] = seamless_surface(panel)

    panels["claimed-corridor"] = colorise_corridor(panels["raw-floor"])
    damp_rock = ImageEnhance.Color(panels["damp-floor"]).enhance(0.72)
    damp_rock = ImageEnhance.Brightness(damp_rock).enhance(0.56)
    damp_rock = ImageEnhance.Contrast(damp_rock).enhance(1.1)
    panels["rock-damp"] = damp_rock

    for name, image in panels.items():
        image.save(terrain_dir / f"{name}.png", optimize=True)
    return panels


def build_decals() -> dict[str, Image.Image]:
    sheet = Image.open(SOURCE / "ground-decals-master-alpha.png").convert("RGBA")
    specs = (
        ("rubble", 0, 0, (128, 72)),
        ("excavation", 1, 0, (128, 96)),
        ("covenant-inlay", 2, 0, (128, 104)),
        ("moss", 0, 1, (128, 76)),
        ("spores", 1, 1, (128, 64)),
        ("puddle", 2, 1, (128, 96)),
    )
    built: dict[str, Image.Image] = {}
    for name, column, row, size in specs:
        built[name] = normalise(
            crop_cell(sheet, 3, 2, column, row, gutter=5),
            size,
            OUTPUT / "decals" / f"{name}.png",
            padding=(3, 3),
            align_bottom=True,
        )
    return built


def build_heart_mount() -> dict[str, Image.Image]:
    sheet = Image.open(SOURCE / "heart-mount-master-alpha.png").convert("RGBA")
    backplate = crop_cell(sheet, 2, 1, 0, 0, gutter=7)
    bezel = crop_cell(sheet, 2, 1, 1, 0, gutter=7)
    return {
        "backplate": normalise(backplate, (192, 192), OUTPUT / "heart" / "backplate.png", padding=(3, 3), align_bottom=True),
        "bezel": normalise(bezel, (96, 96), OUTPUT / "heart" / "bezel.png", padding=(3, 3)),
    }


def make_preview(
    terrain: dict[str, Image.Image],
    walls: dict[str, Image.Image],
    decals: dict[str, Image.Image],
    heart: dict[str, Image.Image],
) -> None:
    preview = Image.new("RGBA", (960, 560), "#071427")
    draw = ImageDraw.Draw(preview)
    for index, name in enumerate(("rock-top", "raw-floor", "claimed-floor", "damp-floor")):
        x = 24 + index * 232
        swatch = terrain[name].crop((52, 52, 460, 460)).resize((216, 190), Image.Resampling.LANCZOS)
        preview.alpha_composite(swatch.convert("RGBA"), (x, 22))

    # A small room corner demonstrates the overlap and visible wall face.
    room = terrain["claimed-floor"].crop((80, 80, 432, 432)).resize((290, 250), Image.Resampling.LANCZOS)
    preview.alpha_composite(room.convert("RGBA"), (40, 268))
    for x in range(72, 330, 32):
        preview.alpha_composite(walls["north"], (x, 250))
    for y in range(282, 485, 32):
        preview.alpha_composite(walls["west"], (24, y))
    preview.alpha_composite(walls["west-north"], (18, 244))
    preview.alpha_composite(decals["covenant-inlay"].resize((150, 122), Image.Resampling.LANCZOS), (110, 330))

    preview.alpha_composite(heart["backplate"].resize((190, 190), Image.Resampling.LANCZOS), (402, 274))
    core = Image.open(V2 / "heart" / "core.png").convert("RGBA").resize((72, 72), Image.Resampling.LANCZOS)
    preview.alpha_composite(core, (461, 329))
    preview.alpha_composite(heart["bezel"].resize((88, 88), Image.Resampling.LANCZOS), (453, 321))
    preview.alpha_composite(decals["moss"], (636, 286))
    preview.alpha_composite(decals["spores"], (664, 374))
    preview.alpha_composite(decals["puddle"], (786, 418))
    preview.save(OUTPUT / "style-b-v3-preview.png", optimize=True)


def main() -> None:
    ensure_dirs()
    walls = build_walls()
    terrain = build_terrain()
    decals = build_decals()
    heart = build_heart_mount()
    make_preview(terrain, walls, decals, heart)


if __name__ == "__main__":
    main()
