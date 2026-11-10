# Atlas helpers for render_kit.py: alpha crops, convex hulls, shelf packing and WebP output.
import bpy
import numpy as np

ALPHA_MIN = 0.02
PAD = 4


def load_rgba(path: str, width: int, height: int) -> np.ndarray:
    """A rendered PNG as a top-row-first float RGBA array."""
    img = bpy.data.images.load(path)
    try:
        return np.array(img.pixels[:], dtype=np.float32).reshape(height, width, 4)[::-1].copy()
    finally:
        bpy.data.images.remove(img)


def alpha_box(*layers: np.ndarray):
    """Union bounding box [x0, y0, x1, y1) of every non-empty layer, padded; None when all are empty."""
    mask = np.zeros(layers[0].shape[:2], dtype=bool)
    for layer in layers:
        mask |= layer[:, :, 3] > ALPHA_MIN
    ys, xs = np.nonzero(mask)
    if xs.size == 0:
        return None, mask
    h, w = mask.shape
    box = [max(0, xs.min() - PAD), max(0, ys.min() - PAD), min(w, xs.max() + PAD + 1), min(h, ys.max() + PAD + 1)]
    return [int(v) for v in box], mask


def convex_hull(mask: np.ndarray, limit: int = 24) -> list:
    """Monotone-chain hull of the mask's pixel corners, simplified to at most `limit` points (frame px)."""
    # The hull only depends on each row's leftmost and rightmost pixel corners
    rows = np.nonzero(mask.any(axis=1))[0]
    pts = set()
    for y in rows:
        xs = np.nonzero(mask[y])[0]
        for x in (int(xs.min()), int(xs.max()) + 1):
            pts.update({(x, int(y)), (x, int(y) + 1)})
    pts = sorted(pts)

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    def chain(points):
        out = []
        for p in points:
            while len(out) >= 2 and cross(out[-2], out[-1], p) <= 0:
                out.pop()
            out.append(p)
        return out

    lower, upper = chain(pts), chain(reversed(pts))
    hull = lower[:-1] + upper[:-1]
    while len(hull) > limit:  # drop the vertex whose removal loses the least area
        areas = [abs(cross(hull[i - 1], hull[i], hull[(i + 1) % len(hull)])) for i in range(len(hull))]
        hull.pop(int(np.argmin(areas)))
    cx, cy = np.mean(hull, axis=0)
    # Push every vertex out by PAD so the simplified hull still contains the whole picture
    return [[float(round(x + PAD * np.sign(x - cx), 1)), float(round(y + PAD * np.sign(y - cy), 1))] for x, y in hull]


def shelf_pack(sizes: dict, width: int = 2048, gap: int = 2) -> tuple[dict, int]:
    """Places each (w, h) crop, tallest first; returns {key: (x, y)} and the atlas height."""
    x = y = shelf = 0
    slots = {}
    for key in sorted(sizes, key=lambda k: -sizes[k][1]):
        w, h = sizes[key]
        if x + w > width:
            x, y, shelf = 0, y + shelf + gap, 0
        slots[key] = (x, y)
        x += w + gap
        shelf = max(shelf, h)
    return slots, y + shelf


def save_webp(pixels: np.ndarray, path: str, quality: int = 88) -> None:
    """Writes a top-row-first RGBA array as WebP through Blender's own encoder."""
    h, w = pixels.shape[:2]
    img = bpy.data.images.new('kit_atlas', w, h, alpha=True)
    try:
        img.pixels = pixels[::-1].ravel()
        img.file_format = 'WEBP'
        img.save(filepath=path, quality=quality)
    finally:
        bpy.data.images.remove(img)
