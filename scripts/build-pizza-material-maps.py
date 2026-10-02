"""Build repeatable, correlated material maps from ImageGen albedo sources.

The generated scans remain the sole artistic source. Height, tangent normal,
roughness and cavity are derived deterministically from their local contrast.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / "src/assets"
SOURCE = ROOT / "material-source"
OUT = ROOT / "material-maps"
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 1536


def make_seamless(array: np.ndarray, blend: float = .13) -> np.ndarray:
    height, width = array.shape[:2]
    shifted = np.roll(array, (height // 2, width // 2), axis=(0, 1)).astype(np.float32)
    original = array.astype(np.float32)
    y, x = np.mgrid[0:height, 0:width]
    sx = np.exp(-((x - width / 2) / (width * blend)) ** 2 * 3.3)
    sy = np.exp(-((y - height / 2) / (height * blend)) ** 2 * 3.3)
    weight = 1 - (1 - sx) * (1 - sy)
    if array.ndim == 3:
        weight = weight[..., None]
    return np.clip(shifted * (1 - weight) + original * weight, 0, 255).astype(np.uint8)


def load_tile(filename: str) -> np.ndarray:
    image = Image.open(SOURCE / filename).convert("RGB")
    image = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    pixels = np.asarray(image).astype(np.float32)
    if filename == "neapolitan-dough-base-source.png":
        # Remove the generated tile's excess amber cast while retaining baked gold.
        pixels[..., 0] *= .92
        pixels[..., 1] *= 1.015
        pixels[..., 2] *= 1.075
    return make_seamless(np.clip(pixels, 0, 255).astype(np.uint8))


def save_color(name: str, pixels: np.ndarray) -> None:
    Image.fromarray(pixels).save(OUT / f"{name}-albedo.webp", "WEBP", quality=91, method=6)


def save_map(name: str, key: str, pixels: np.ndarray) -> None:
    image = Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8))
    image.save(OUT / f"{name}-{key}.webp", "WEBP", quality=95, method=6)


def build_maps(name: str, color: np.ndarray) -> None:
    rgb = color.astype(np.float32) / 255
    luma = rgb[..., 0] * .2126 + rgb[..., 1] * .7152 + rgb[..., 2] * .0722
    luma_image = Image.fromarray((luma * 255).astype(np.uint8))
    blur_fine = np.asarray(luma_image.filter(ImageFilter.GaussianBlur(2.2)), np.float32) / 255
    blur_broad = np.asarray(luma_image.filter(ImageFilter.GaussianBlur(12)), np.float32) / 255
    fine = luma - blur_fine
    broad = blur_fine - blur_broad

    if name == "crust":
        height = 128 + fine * 260 + broad * 80
        roughness = .86 + np.clip(-broad, 0, .12) * .75 + np.clip(fine, 0, .10) * .30
        char = (rgb[..., 0] < .29) & (rgb[..., 1] < .19)
        roughness = np.where(char, .93, roughness)
        roughness = roughness - .035
        normal_strength = 5.0
    elif name == "sauce":
        height = 128 + fine * 300 + broad * 65
        watery = np.clip(-broad * 5, 0, 1)
        pulp = np.clip(np.abs(fine) * 9, 0, 1)
        roughness = .39 - watery * .12 + pulp * .055
        normal_strength = 4.0
    else:
        height = 128 + fine * 340 + broad * 72
        thin_melt = np.clip((.75 - rgb[..., 0]) * 2, 0, 1)
        gloss = np.clip((rgb[..., 0] - .82) * 4, 0, 1)
        roughness = .53 - thin_melt * .13 - gloss * .025 + np.clip(np.abs(fine) * 5, 0, 1) * .045
        normal_strength = 4.0

    height = np.clip(height, 1, 254).astype(np.float32)
    dy, dx = np.gradient(height / 255)
    nx, ny = -dx * normal_strength, dy * normal_strength
    nz = np.ones_like(nx)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack(((nx / length * .5 + .5) * 255,
                       (ny / length * .5 + .5) * 255,
                       (nz / length * .5 + .5) * 255), axis=-1)
    cavity = np.clip((blur_broad - luma) * 1.8, 0, .28)
    ao = 255 * (1 - cavity)

    save_map(name, "height", height)
    Image.fromarray(np.clip(normal, 0, 255).astype(np.uint8)).save(
        OUT / f"{name}-normal.webp", "WEBP", quality=96, method=6)
    save_map(name, "roughness", np.clip(roughness, .22, .96) * 255)
    save_map(name, "ao", ao)


for source, name in (("neapolitan-dough-base-source.png", "crust"),
                     ("crushed-tomato-source.png", "sauce"),
                     ("melted-mozzarella-source.png", "mozzarella")):
    tile = load_tile(source)
    save_color(name, tile)
    build_maps(name, tile)

char = load_tile("neapolitan-leopard-mask-source.png")
gray = char[..., 0] * .2126 + char[..., 1] * .7152 + char[..., 2] * .0722
# White is unmarked dough; dark is an irregular char blister with gray halos.
char_mask = np.clip((gray - 55) / (95 - 55), 0, 1) * 255
Image.fromarray(char_mask.astype(np.uint8)).save(
    OUT / "crust-char-mask.webp", "WEBP", quality=84, method=6)

print(f"Built {len(list(OUT.glob('*.webp')))} maps ({sum(p.stat().st_size for p in OUT.glob('*.webp')):,} bytes)")
