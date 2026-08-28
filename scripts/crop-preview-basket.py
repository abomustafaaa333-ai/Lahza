from pathlib import Path
from PIL import Image

src = Image.open('/home/ubuntu/Lahza/design-preview-01.png').convert('RGB')
# منطقة سلة التسوق والعناصر المحيطة بها داخل لوحة الخدمات في المعاينة الأولى
crop = src.crop((790, 390, 1435, 920))
Path('/home/ubuntu/Lahza/client/public/assets').mkdir(parents=True, exist_ok=True)
crop.save('/home/ubuntu/Lahza/client/public/assets/lahza-hero-shopping-basket.jpg', quality=94, optimize=True)
