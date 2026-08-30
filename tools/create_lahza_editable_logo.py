from pathlib import Path
from xml.sax.saxutils import escape
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

OUT = Path('/home/ubuntu/Lahza/lahza-logo-editable.svg')
FONT = '/usr/share/fonts/truetype/noto/NotoKufiArabic-ExtraBold.ttf'
font = TTFont(FONT)
cmap = {}
for table in font['cmap'].tables:
    cmap.update(table.cmap)
hmtx = font['hmtx'].metrics
head = font['head']
hhea = font['hhea']
upem = head.unitsPerEm
scale = 190 / upem

font_data = Path(FONT).read_bytes()
hb_face = hb.Face(font_data)
hb_font = hb.Font(hb_face)
hb_font.scale = (upem, upem)

def arabic_paths(word, fill, x_right, baseline, height_scale=1.0):
    buffer = hb.Buffer()
    buffer.add_str(word)
    buffer.guess_segment_properties()
    hb.shape(hb_font, buffer)
    infos = buffer.glyph_infos
    positions = buffer.glyph_positions
    local_scale = scale * height_scale
    # HarfBuzz returns Arabic glyphs in RTL visual order; place them from the right edge leftward.
    x = x_right
    paths = []
    glyph_set = font.getGlyphSet()
    for info, position in zip(infos, positions):
        gname = font.getGlyphOrder()[info.codepoint]
        advance = position.x_advance * local_scale
        x -= advance
        pen = SVGPathPen(glyph_set)
        glyph_set[gname].draw(pen)
        d = pen.getCommands()
        tx = x + position.x_offset * local_scale
        ty = baseline - position.y_offset * local_scale
        paths.append(f'<path d="{d}" transform="translate({tx:.2f},{ty:.2f}) scale({local_scale:.5f},-{local_scale:.5f})" fill="{fill}"/>')
    return '\n'.join(paths)

# Main wordmark: manually composed geometry follows the supplied reference.
word = arabic_paths('لحظة', '#08727A', 810, 380)
small_light = arabic_paths('لحظة', '#08727A', 380, 930, .22)
small_dark = arabic_paths('لحظة', '#FFFFFF', 1000, 930, .22)
small_mono = arabic_paths('لحظة', '#222222', 620, 930, .22)
label_light = arabic_paths('خلفية فاتحة', '#08727A', 485, 1000, .18)
label_dark = arabic_paths('خلفية داكنة', '#FFFFFF', 1065, 1000, .18)
label_mono = arabic_paths('أحادي اللون', '#222222', 1645, 1000, .18)

symbol = '''<g id="symbol-orange">
  <rect x="970" y="205" width="410" height="410" rx="94" fill="#FF742D"/>
  <path d="M1065 366h88M1047 419h106M1071 472h76" stroke="#FFFDF8" stroke-width="25" stroke-linecap="round"/>
  <path d="M1193 263c-79 0-143 64-143 143 0 107 143 211 143 211s143-104 143-211c0-79-64-143-143-143Z" fill="#FFFDF8"/>
  <circle cx="1193" cy="406" r="84" fill="#FF742D"/>
  <circle cx="1193" cy="406" r="13" fill="#08727A"/>
  <path d="M1193 406v-57M1193 406l47 30" stroke="#08727A" stroke-width="20" stroke-linecap="round"/>
</g>'''

# Usage examples use vector geometry only; all explanatory labels are path outlines generated from Arabic glyphs.
usage = f'''<g inkscape:groupmode="layer" inkscape:label="طرق استخدام الشعار" id="usage-layer">
  <rect x="70" y="760" width="520" height="270" rx="28" fill="#FFFDF8" stroke="#D8E7E5" stroke-width="4"/>
  <rect x="650" y="760" width="520" height="270" rx="28" fill="#173A3D"/>
  <rect x="1230" y="760" width="520" height="270" rx="28" fill="#F0F2F1" stroke="#D1D7D5" stroke-width="4"/>
  <g transform="translate(115,785) scale(.32)">{symbol}</g>
  <g transform="translate(695,785) scale(.32)">{symbol.replace('#FF742D','#FFFFFF').replace('#FFFDF8','#173A3D').replace('#08727A','#FFFFFF')}</g>
  <g transform="translate(1275,785) scale(.32)">{symbol.replace('#FF742D','#222222').replace('#FFFDF8','#F0F2F1').replace('#08727A','#F0F2F1')}</g>
  <g transform="translate(105,0)">{small_light}</g>
  <g transform="translate(685,0)">{small_dark}</g>
  <g transform="translate(1265,0)">{small_mono}</g>
  {label_light}
  {label_dark}
  {label_mono}
</g>'''

svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="1800" height="1100" viewBox="0 0 1800 1100" role="img" aria-labelledby="title desc">
  <title id="title">شعار لحظة — ملف فيكتور قابل للتعديل</title>
  <desc id="desc">كلمة لحظة والرمز مرسومان كمسارات فيكتور، مع طبقة منفصلة لأمثلة الاستخدام.</desc>
  <g inkscape:groupmode="layer" inkscape:label="الشعار الأساسي" id="logo-layer">
    {word}
    <path d="M145 355h140M110 420h210M145 485h140M175 545h70" stroke="#FF742D" stroke-width="25" stroke-linecap="round"/>
    <g transform="translate(-40,0)">{symbol}</g>
  </g>
  {usage}
</svg>
'''
OUT.write_text(svg, encoding='utf-8')
print(OUT)
print('wordmark paths:', svg.count('<path'))
print('contains text elements:', '<text' in svg)
