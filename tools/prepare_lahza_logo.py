from pathlib import Path
from PIL import Image
import numpy as np

source = Path('/home/ubuntu/Lahza/logo-concept-4.png')
out = Path('/home/ubuntu/Lahza/client/public/assets/lahza-logo-option-4-light.png')
image = Image.open(source).convert('RGBA')
arr = np.array(image)
rgb = arr[:, :, :3].astype(np.int16)
# The generated board uses a near-cream background. Keep only the dark/orange logo pixels.
mask = (rgb.min(axis=2) < 220) | ((rgb[:, :, 0] - rgb[:, :, 1] > 28) & (rgb[:, :, 0] > 180))
ys, xs = np.where(mask)
if len(xs) == 0:
    raise RuntimeError('Logo pixels were not found')
pad = 28
left, right = max(0, xs.min() - pad), min(image.width, xs.max() + pad + 1)
top, bottom = max(0, ys.min() - pad), min(image.height, ys.max() + pad + 1)
crop = image.crop((left, top, right, bottom))
pix = np.array(crop)
crgb = pix[:, :, :3].astype(np.int16)
# Make only the cream background transparent while preserving logo edges.
cream = np.linalg.norm(crgb - np.array([255, 248, 241], dtype=np.int16), axis=2)
alpha = np.clip((cream - 8) * 18, 0, 255).astype(np.uint8)
pix[:, :, 3] = np.maximum(pix[:, :, 3], alpha)
result = Image.fromarray(pix, 'RGBA')
result.thumbnail((1200, 500), Image.Resampling.LANCZOS)
out.parent.mkdir(parents=True, exist_ok=True)
result.save(out, format='PNG', optimize=True)
print(f'{out} {result.size} {out.stat().st_size} bytes')
