from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "generated" / "units-v1" / "sources"
OUTPUT = SOURCE.parent
CANVAS = 64
PADDING = 2


def export_sprite(sheet: Image.Image, box: tuple[int, int, int, int], name: str) -> None:
    cell = sheet.crop(box)
    alpha = cell.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise RuntimeError(f"No visible pixels found for {name}")
    sprite = cell.crop(bounds)
    scale = min((CANVAS - PADDING * 2) / sprite.width, (CANVAS - PADDING * 2) / sprite.height)
    size = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
    sprite = sprite.resize(size, Image.Resampling.LANCZOS).filter(ImageFilter.UnsharpMask(radius=0.6, percent=115, threshold=2))
    canvas = Image.new("RGBA", (CANVAS, CANVAS))
    canvas.alpha_composite(sprite, ((CANVAS - size[0]) // 2, CANVAS - PADDING - size[1]))
    canvas.save(OUTPUT / f"{name}.png", optimize=True)


def main() -> None:
    covenant = Image.open(SOURCE / "covenant-roster-alpha.png").convert("RGBA")
    cw, ch = covenant.size[0] // 3, covenant.size[1] // 2
    for name, column, row in [
        ("worker", 0, 0),
        ("guard", 1, 0),
        ("archer", 2, 0),
        ("hexbinder", 0, 1),
        ("inquisitor", 1, 1),
    ]:
        export_sprite(covenant, (column * cw, row * ch, (column + 1) * cw, (row + 1) * ch), name)

    underground = Image.open(SOURCE / "underground-roster-alpha.png").convert("RGBA")
    uw, uh = underground.size[0] // 3, underground.size[1]
    for name, column in [("crawler", 0), ("dwarf", 1), ("crossbow", 2)]:
        export_sprite(underground, (column * uw, 0, (column + 1) * uw, uh), name)

    inquisition = Image.open(SOURCE / "inquisition-roster-alpha.png").convert("RGBA")
    iw, ih = inquisition.size[0] // 2, inquisition.size[1] // 2
    for name, column, row in [
        ("adept", 0, 0),
        ("captain", 1, 0),
        ("scout", 0, 1),
        ("warden", 1, 1),
    ]:
        export_sprite(inquisition, (column * iw, row * ih, (column + 1) * iw, (row + 1) * ih), name)

    utility = Image.open(SOURCE / "utility-roster-alpha.png").convert("RGBA")
    tw, th = utility.size[0] // 3, utility.size[1] // 3
    for name, column, row in [
        ("item-ore", 0, 0),
        ("item-biomass", 1, 0),
        ("item-essence", 2, 0),
        ("item-metal", 0, 1),
        ("item-ration", 1, 1),
        ("item-armour", 2, 1),
        ("trap", 0, 2),
        ("prisoner", 1, 2),
    ]:
        export_sprite(utility, (column * tw, row * th, (column + 1) * tw, (row + 1) * th), name)


if __name__ == "__main__":
    main()
