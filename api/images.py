import io

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_INPUT_BYTES = 8 * 1024 * 1024
MAX_STORED_BYTES = 2 * 1024 * 1024
MAX_SIDE = 1280


def sanitize_image(raw: bytes) -> tuple[bytes, int, int]:
    """Re-encodes an uploaded crop as WebP: applies the EXIF rotation, drops all
    metadata (EXIF, GPS, ICC) and downsizes to MAX_SIDE. The original is discarded."""
    if len(raw) > MAX_INPUT_BYTES:
        raise HTTPException(413, "Immagine troppo grande (max 8 MB)")
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(415, "Formato immagine non supportato")
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    clean = Image.new(img.mode, img.size)
    clean.paste(img)
    out = io.BytesIO()
    quality = 82
    clean.save(out, "WEBP", quality=quality, method=4)
    while out.tell() > MAX_STORED_BYTES and quality > 40:
        quality -= 12
        out = io.BytesIO()
        clean.save(out, "WEBP", quality=quality, method=4)
    return out.getvalue(), clean.width, clean.height
