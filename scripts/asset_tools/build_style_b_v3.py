"""Build Style B v3 terrain relief, environmental decals and heart mount."""

from pathlib import Path
import shutil

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


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


def crop_source_sheet_cell(
    sheet: Image.Image,
    columns: int,
    rows: int,
    column: int,
    row: int,
    *,
    gutter: int = 10,
) -> Image.Image:
    """Crop an ImageGen source cell while removing its authored separators."""
    left = round(column * sheet.width / columns) + gutter
    right = round((column + 1) * sheet.width / columns) - gutter
    top = round(row * sheet.height / rows) + gutter
    bottom = round((row + 1) * sheet.height / rows) - gutter
    return visible_crop(sheet.crop((left, top, right, bottom)))


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
    sheet = Image.open(SOURCE / "wall-kit-master-v4-alpha.png").convert("RGBA")
    built: dict[str, Image.Image] = {}

    # Every 96px frame is anchored to a grid EDGE or grid VERTEX, never to an
    # open tile centre. Runtime topology therefore decides geometry, while this
    # source sheet contributes only the painted material and fixed perspective.
    frame_size = 96

    def edge_module(column: int, horizontal: bool) -> Image.Image:
        source = crop_source_sheet_cell(sheet, 4, 2, column, 0)
        if horizontal:
            source = visible_crop(source.crop((
                round(source.width * 0.39), 0,
                round(source.width * 0.61), source.height,
            )))
            dimensions = (36, 58)
        else:
            source = visible_crop(source.crop((
                0, round(source.height * 0.39),
                source.width, round(source.height * 0.61),
            )))
            dimensions = (42, 36)
        source = ImageOps.fit(source, dimensions, method=Image.Resampling.LANCZOS)
        source = source.filter(ImageFilter.UnsharpMask(radius=0.42, percent=116, threshold=2))
        canvas = Image.new("RGBA", (frame_size, frame_size))
        # The authored wall face hangs below the edge in screen space. Vertical
        # modules keep their own left/right face and are never rotated copies.
        x = (frame_size - source.width) // 2
        y = 30 if horizontal else (frame_size - source.height) // 2
        canvas.alpha_composite(source, (x, y))
        return canvas

    for name, column, horizontal in (
        ("north", 0, True),
        ("east", 1, False),
        ("south", 2, True),
        ("west", 3, False),
    ):
        module = edge_module(column, horizontal)
        module.save(OUTPUT / "walls" / f"{name}-v5.png", optimize=True)
        built[name] = module

    # The generated V-shaped corner looked attractive in isolation but cannot
    # meet orthogonal grid edges without two diagonal stone wings protruding.
    # Extract the square end pillar from the straight authored wall instead.
    horizontal_strip = crop_source_sheet_cell(sheet, 4, 2, 0, 0)
    pillar_source = visible_crop(horizontal_strip.crop((
        0,
        0,
        round(horizontal_strip.width * 0.205),
        horizontal_strip.height,
    )))

    def joint_module() -> Image.Image:
        source = ImageOps.fit(pillar_source, (32, 58), method=Image.Resampling.LANCZOS)
        source = source.filter(ImageFilter.UnsharpMask(radius=0.42, percent=116, threshold=2))
        canvas = Image.new("RGBA", (frame_size, frame_size))
        canvas.alpha_composite(source, ((frame_size - source.width) // 2, 30))
        return canvas

    built["convex"] = joint_module()
    # Inward corners and diagonal contacts are sealed by the overlapping edge
    # modules. A second post at each one-field passage mouth created the
    # doubled columns and apparent barriers visible in excavation screenshots.
    built["concave"] = Image.new("RGBA", (frame_size, frame_size))
    built["diagonal"] = Image.new("RGBA", (frame_size, frame_size))
    built["empty"] = Image.new("RGBA", (frame_size, frame_size))
    for name in ("convex", "concave", "diagonal"):
        built[name].save(OUTPUT / "walls" / f"{name}-v5.png", optimize=True)

    # Compact passage walls keep their stone lip but use less than half the
    # visual depth. Opposing sides of a 32px tunnel therefore retain a clear
    # walkable strip instead of overlapping into a solid masonry platform.
    for name in ("north", "east", "south", "west"):
        source = visible_crop(built[name])
        horizontal = name in ("north", "south")
        dimensions = (36, 25) if horizontal else (25, 36)
        source = ImageOps.fit(source, dimensions, method=Image.Resampling.LANCZOS)
        source = source.filter(ImageFilter.UnsharpMask(radius=0.36, percent=118, threshold=2))
        canvas = Image.new("RGBA", (frame_size, frame_size))
        x = (frame_size - source.width) // 2
        y = 37 if horizontal else (frame_size - source.height) // 2
        canvas.alpha_composite(source, (x, y))
        built[f"compact-{name}"] = canvas
        canvas.save(OUTPUT / "walls" / f"compact-{name}-v5.png", optimize=True)

    frame_order = (
        "north", "east", "south", "west",
        "convex", "concave", "diagonal", "empty",
        "compact-north", "compact-east", "compact-south", "compact-west",
    )

    def make_atlas(frames: dict[str, Image.Image], path: Path) -> None:
        atlas = Image.new("RGBA", (frame_size * 4, frame_size * 3))
        for index, name in enumerate(frame_order):
            atlas.alpha_composite(frames[name], ((index % 4) * frame_size, (index // 4) * frame_size))
        atlas.save(path, optimize=True)

    make_atlas(built, OUTPUT / "walls" / "wall-atlas-v5.png")

    def neutralise(sprite: Image.Image) -> Image.Image:
        alpha = sprite.getchannel("A")
        luminance = ImageOps.grayscale(sprite.convert("RGB"))
        neutral = ImageOps.colorize(
            luminance,
            black="#0b1720",
            mid="#4f6267",
            white="#b4c2bc",
            midpoint=126,
        ).convert("RGBA")
        neutral.putalpha(alpha)
        return ImageEnhance.Contrast(neutral).enhance(1.06)

    neutral_frames = {name: neutralise(image) for name, image in built.items()}
    make_atlas(neutral_frames, OUTPUT / "walls" / "wall-atlas-neutral-v5.png")
    return built


def build_corridor_walls(room_walls: dict[str, Image.Image]) -> dict[str, Image.Image]:
    """Build a low, direction-consistent rock lip for every dug passage."""
    frame_size = 96
    source = visible_crop(room_walls["north"])
    # Only the pale cap belongs to the corridor family. The dark plum masonry
    # below it is a room facade and caused horizontal passages to be roughly
    # 60% darker than their vertical counterparts when it was compressed.
    cap = visible_crop(source.crop((0, 0, source.width, round(source.height * 0.42))))
    cap = ImageOps.fit(cap, (36, 11), method=Image.Resampling.LANCZOS)
    alpha = cap.getchannel("A")
    luminance = ImageOps.grayscale(cap.convert("RGB"))
    cap = ImageOps.colorize(
        luminance,
        black="#24353b",
        mid="#77898b",
        white="#c1cbc5",
        midpoint=124,
    ).convert("RGBA")
    cap.putalpha(alpha)
    cap = cap.filter(ImageFilter.UnsharpMask(radius=0.34, percent=118, threshold=2))

    horizontal = cap
    vertical = cap.rotate(90, expand=True, resample=Image.Resampling.BICUBIC)

    def module(sprite: Image.Image) -> Image.Image:
        canvas = Image.new("RGBA", (frame_size, frame_size))
        x = (frame_size - sprite.width) // 2
        y = (frame_size - sprite.height) // 2
        shadow_alpha = sprite.getchannel("A").filter(ImageFilter.GaussianBlur(radius=1.15))
        shadow_alpha = shadow_alpha.point(lambda value: round(value * 0.42))
        shadow = Image.new("RGBA", sprite.size, (6, 15, 22, 0))
        shadow.putalpha(shadow_alpha)
        canvas.alpha_composite(shadow, (x + 2, y + 4))
        canvas.alpha_composite(sprite, (x, y))
        return canvas

    built = {
        "north": module(horizontal),
        "east": module(vertical),
        "south": module(horizontal),
        "west": module(vertical),
    }
    for name, image in built.items():
        image.save(OUTPUT / "walls" / f"corridor-{name}-v6.png", optimize=True)

    atlas = Image.new("RGBA", (frame_size * 4, frame_size))
    for index, name in enumerate(("north", "east", "south", "west")):
        atlas.alpha_composite(built[name], (index * frame_size, 0))
    atlas.save(OUTPUT / "walls" / "corridor-wall-atlas-v6.png", optimize=True)
    return built


def build_architecture_v7() -> None:
    """Build complete, projection-locked wall families and doorway sills.

    The topology atlas has four edge frames, four oriented outer corners, four
    oriented inner corners and two diagonal contacts. All shapes are exact and
    deterministic; painted source images contribute material only.
    """
    frame_size = 96
    terrain_sheet = Image.open(SOURCE / "terrain-materials-master.png").convert("RGB")
    masonry_material = terrain_sheet.crop((0, terrain_sheet.height // 2, terrain_sheet.width // 2, terrain_sheet.height))
    natural_material = Image.open(SOURCE / "natural-cavern-material-v7.png").convert("RGB")

    palettes = {
        "built": {
            "cap": ("#554b42", "#b7a77f", "#ead7ab"),
            "face": ("#181521", "#403044", "#795c6b"),
            "accent": "#c9942d",
            "shadow": (5, 13, 24, 150),
        },
        "fortified": {
            "cap": ("#26363c", "#718184", "#b7c2b9"),
            "face": ("#111b25", "#283844", "#52636b"),
            "accent": "#667d7b",
            "shadow": (4, 13, 20, 150),
        },
        "natural": {
            "cap": ("#15333d", "#527d72", "#abc18e"),
            "face": ("#0a1b28", "#254850", "#4d7164"),
            "accent": "#6e9a75",
            "shadow": (3, 18, 25, 155),
        },
        "corridor": {
            "cap": ("#172a37", "#566f77", "#9eafaa"),
            "face": ("#091724", "#263e4a", "#506973"),
            "accent": "#72898b",
            "shadow": (3, 12, 21, 132),
        },
    }

    def material_patch(source: Image.Image, index: int, palette: tuple[str, str, str]) -> Image.Image:
        crop_size = min(source.width, source.height, 420)
        max_x = max(1, source.width - crop_size)
        max_y = max(1, source.height - crop_size)
        left = (index * 173) % max_x
        top = (index * 251) % max_y
        patch = source.crop((left, top, left + crop_size, top + crop_size)).resize(
            (frame_size, frame_size), Image.Resampling.LANCZOS,
        )
        luminance = ImageEnhance.Contrast(ImageOps.grayscale(patch)).enhance(0.88)
        return ImageOps.colorize(
            luminance,
            black=palette[0],
            mid=palette[1],
            white=palette[2],
            midpoint=126,
        ).convert("RGBA")

    def paint_layer(
        canvas: Image.Image,
        mask: Image.Image,
        source: Image.Image,
        index: int,
        palette: tuple[str, str, str],
    ) -> None:
        material = material_patch(source, index, palette)
        material.putalpha(ImageChops.multiply(material.getchannel("A"), mask))
        canvas.alpha_composite(material)

    def shadow_layer(canvas: Image.Image, mask: Image.Image, color: tuple[int, int, int, int]) -> None:
        blurred = mask.filter(ImageFilter.GaussianBlur(1.4))
        alpha = blurred.point(lambda value: round(value * color[3] / 255))
        shadow = Image.new("RGBA", (frame_size, frame_size), (*color[:3], 0))
        shadow.putalpha(alpha)
        canvas.alpha_composite(shadow)

    def rect_mask(box: tuple[int, int, int, int], radius: int = 2) -> Image.Image:
        mask = Image.new("L", (frame_size, frame_size))
        ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)
        return mask

    def edge_module(family: str, side: str, index: int) -> Image.Image:
        natural = family == "natural"
        corridor = family == "corridor"
        source = natural_material if natural or corridor else masonry_material
        palette = palettes[family]
        canvas = Image.new("RGBA", (frame_size, frame_size))
        cap = Image.new("L", (frame_size, frame_size))
        face = Image.new("L", (frame_size, frame_size))
        cap_draw = ImageDraw.Draw(cap)
        face_draw = ImageDraw.Draw(face)

        if corridor:
            boxes = {
                "north": ((30, 45, 66, 50), (30, 50, 66, 53)),
                "east": ((46, 30, 51, 66), (42, 30, 46, 66)),
                "south": ((30, 46, 66, 51), (30, 42, 66, 46)),
                "west": ((45, 30, 50, 66), (50, 30, 54, 66)),
            }
            cap_box, face_box = boxes[side]
            cap_draw.rounded_rectangle(cap_box, radius=2, fill=255)
            face_draw.rounded_rectangle(face_box, radius=2, fill=185)
        elif natural:
            if side in ("north", "south"):
                center_y = 46 if side == "north" else 49
                for offset, radius in ((-13, 8), (0, 10), (13, 8)):
                    cap_draw.ellipse((48 + offset - radius, center_y - 6, 48 + offset + radius, center_y + 6), fill=255)
                face_box = (29, center_y + 3, 67, center_y + 10) if side == "south" else (29, center_y + 2, 67, center_y + 7)
            else:
                center_x = 46 if side == "west" else 50
                for offset, radius in ((-13, 8), (0, 10), (13, 8)):
                    cap_draw.ellipse((center_x - 6, 48 + offset - radius, center_x + 6, 48 + offset + radius), fill=255)
                face_box = (center_x + 2, 29, center_x + 9, 67) if side == "east" else (center_x - 9, 29, center_x - 2, 67)
            face_draw.rounded_rectangle(face_box, radius=4, fill=175)
        else:
            boxes = {
                "north": ((30, 42, 66, 50), (30, 50, 66, 54)),
                "east": ((46, 30, 54, 66), (54, 30, 61, 66)),
                "south": ((30, 43, 66, 51), (30, 51, 66, 64)),
                "west": ((42, 30, 50, 66), (35, 30, 42, 66)),
            }
            cap_box, face_box = boxes[side]
            cap_draw.rounded_rectangle(cap_box, radius=2, fill=255)
            face_draw.rounded_rectangle(face_box, radius=2, fill=235)

        shadow_layer(canvas, face.filter(ImageFilter.MaxFilter(3)), palette["shadow"])
        paint_layer(canvas, face, source, index + 31, palette["face"])
        paint_layer(canvas, cap, source, index, palette["cap"])

        details = ImageDraw.Draw(canvas)
        if side in ("north", "south"):
            details.line((48, 43 if not natural else 42, 48, 51 if not natural else 53), fill=(21, 29, 35, 92), width=1)
        else:
            details.line((43 if not natural else 42, 48, 53 if not natural else 54, 48), fill=(21, 29, 35, 92), width=1)
        if family in ("built", "fortified"):
            if side == "north": details.line((31, 43, 65, 43), fill=(247, 225, 178, 110), width=1)
            if side == "west": details.line((43, 31, 43, 65), fill=(235, 215, 171, 96), width=1)
        return canvas

    quadrant_order = ("northWest", "northEast", "southEast", "southWest")

    def joint_module(family: str, kind: str, orientation: str, index: int) -> Image.Image:
        natural = family == "natural"
        corridor = family == "corridor"
        source = natural_material if natural or corridor else masonry_material
        palette = palettes[family]
        canvas = Image.new("RGBA", (frame_size, frame_size))
        mask = Image.new("L", (frame_size, frame_size))
        draw = ImageDraw.Draw(mask)
        radius = 4 if corridor else 8 if natural else 7
        if kind == "diagonal":
            if orientation == "northWestSouthEast":
                centers = ((44, 44), (52, 52))
            else:
                centers = ((52, 44), (44, 52))
            for cx, cy in centers:
                draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=230)
        elif natural:
            draw.ellipse((48 - radius - 2, 48 - radius, 48 + radius + 2, 48 + radius), fill=255)
        else:
            draw.rounded_rectangle((48 - radius, 48 - radius, 48 + radius, 48 + radius), radius=3, fill=255)

        shadow_mask = Image.new("L", (frame_size, frame_size))
        shadow_mask.paste(mask, (2, 4))
        shadow_layer(canvas, shadow_mask, palette["shadow"])
        paint_layer(canvas, mask, source, index, palette["cap"])
        details = ImageDraw.Draw(canvas)
        if family == "built" and kind == "convex":
            details.rounded_rectangle((43, 43, 53, 53), radius=2, outline=palette["accent"], width=2)
            details.ellipse((47, 47, 49, 49), fill=(245, 213, 123, 220))
        elif family == "fortified" and kind == "convex":
            details.line((43, 48, 53, 48), fill=(156, 176, 169, 170), width=2)
        return canvas

    def make_family(family: str, output_name: str) -> Image.Image:
        frames: list[Image.Image] = []
        for index, side in enumerate(("north", "east", "south", "west")):
            frames.append(edge_module(family, side, index))
        for index, quadrant in enumerate(quadrant_order):
            frames.append(joint_module(family, "convex", quadrant, 20 + index))
        for index, quadrant in enumerate(quadrant_order):
            frames.append(joint_module(family, "concave", quadrant, 24 + index))
        frames.append(joint_module(family, "diagonal", "northWestSouthEast", 28))
        frames.append(joint_module(family, "diagonal", "northEastSouthWest", 29))
        frames.extend((Image.new("RGBA", (frame_size, frame_size)), Image.new("RGBA", (frame_size, frame_size))))
        atlas = Image.new("RGBA", (frame_size * 4, frame_size * 4))
        for frame, image in enumerate(frames):
            atlas.alpha_composite(image, ((frame % 4) * frame_size, (frame // 4) * frame_size))
        atlas.save(OUTPUT / "walls" / output_name, optimize=True)
        return atlas

    built = make_family("built", "wall-atlas-built-v7.png")
    fortified = make_family("fortified", "wall-atlas-fortified-v7.png")
    natural = make_family("natural", "wall-atlas-natural-v7.png")
    corridor = make_family("corridor", "wall-atlas-corridor-v7.png")

    def threshold_atlas(family: str, output_name: str) -> Image.Image:
        palette = palettes[family]
        source = natural_material if family == "natural" else masonry_material
        atlas = Image.new("RGBA", (frame_size * 4, frame_size))
        for index, side in enumerate(("north", "east", "south", "west")):
            canvas = Image.new("RGBA", (frame_size, frame_size))
            horizontal = side in ("north", "south")
            box = (30, 44, 66, 52) if horizontal else (44, 30, 52, 66)
            mask = rect_mask(box, 3 if family == "natural" else 2)
            shadow = Image.new("L", (frame_size, frame_size))
            shadow.paste(mask, (1, 3))
            shadow_layer(canvas, shadow, palette["shadow"])
            paint_layer(canvas, mask, source, 40 + index, palette["cap"])
            details = ImageDraw.Draw(canvas)
            if family == "built":
                if horizontal:
                    details.ellipse((32, 47, 35, 50), fill=palette["accent"])
                    details.ellipse((61, 47, 64, 50), fill=palette["accent"])
                else:
                    details.ellipse((47, 32, 50, 35), fill=palette["accent"])
                    details.ellipse((47, 61, 50, 64), fill=palette["accent"])
            atlas.alpha_composite(canvas, (index * frame_size, 0))
        atlas.save(OUTPUT / "walls" / output_name, optimize=True)
        return atlas

    built_threshold = threshold_atlas("built", "threshold-built-v7.png")
    natural_threshold = threshold_atlas("natural", "threshold-natural-v7.png")

    preview = Image.new("RGBA", (frame_size * 4, frame_size * 6), (7, 20, 39, 255))
    for row, atlas in enumerate((built, fortified, natural, corridor)):
        preview.alpha_composite(atlas.crop((0, 0, frame_size * 4, frame_size)), (0, row * frame_size))
    preview.alpha_composite(built_threshold, (0, frame_size * 4))
    preview.alpha_composite(natural_threshold, (0, frame_size * 5))
    preview.save(OUTPUT / "walls" / "architecture-v7-preview.png", optimize=True)


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
        preview.alpha_composite(walls["north"], (x, 268))
    for y in range(300, 485, 32):
        preview.alpha_composite(walls["west"], (40, y))
    preview.alpha_composite(walls["convex"], (40, 268))
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
    build_corridor_walls(walls)
    build_architecture_v7()
    terrain = build_terrain()
    decals = build_decals()
    heart = build_heart_mount()
    make_preview(terrain, walls, decals, heart)


if __name__ == "__main__":
    main()
