from pathlib import Path
from PIL import Image
import numpy as np

source = Path('/home/ubuntu/Lahza/logo-concept-4.png')
out = Path('/home/ubuntu/Lahza/client/public/assets/lahza-logo-option-4-header.png')
image = Image.open(source).convert('RGBA')
# The primary option-four lockup occupies the upper portion of the concept board.
crop = image.crop((120, 70, 1800, 720))
pix = np.array(crop)
rgb = pix[:, :, :3].astype(np.int16)
# Remove the cream board while preserving antialiased logo edges.
distance = np.linalg.norm(rgb - np.array([255, 248, 241], dtype=np.int16), axis=2)
alpha = np.clip((distance - 7) * 20, 0, 255).astype(np.uint8)
pix[:, :, 3] = np.maximum(pix[:, :, 3], alpha)
result = Image.fromarray(pix, 'RGBA')
result.thumbnail((1000, 360), Image.Resampling.LANCZOS)
out.parent.mkdir(parents=True, exist_ok=True)
result.save(out, format='PNG', optimize=True)
print(f'{out} {result.size} {out.stat().st_size} bytes')
