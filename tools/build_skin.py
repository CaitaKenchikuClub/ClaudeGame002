"""スキンの実行用素材を作る（PNGマスター → 軽量WebP）

  python tools/build_skin.py assets/skins/default

skin.json の masters (透過PNG) から frames (WebP) を書き出します。
  - base  : 色は品質92の非可逆、アルファは可逆（輪郭が欠けない）
  - blink : 可逆WebP。base と違う画素の範囲（+余白2px）だけを残した「上乗せ用」画像。
            キャンバスサイズは base と同じなので、重ねるだけで位置が完全に一致し、
            目元以外は base がそのまま見えます（圧縮ノイズのちらつきが出ません）。
PNGマスターは読み取りのみで、変更しません。
"""
import sys, os, json
import numpy as np
from PIL import Image

def main(skin_dir):
    meta = json.load(open(os.path.join(skin_dir, 'skin.json'), encoding='utf-8'))
    masters, frames = meta['masters'], meta['frames']
    base = Image.open(os.path.join(skin_dir, masters['base'])).convert('RGBA')
    assert list(base.size) == meta['size'], f"skin.json size {meta['size']} と base {base.size} が違います"
    base.save(os.path.join(skin_dir, frames['base']), quality=92, alpha_quality=100, method=6)

    for name in [k for k in masters if k != 'base']:
        img = Image.open(os.path.join(skin_dir, masters[name])).convert('RGBA')
        assert img.size == base.size, f'{name} のキャンバスサイズが base と違います（位置がずれます）'
        a, b = np.array(base), np.array(img)
        diff = np.any(a != b, axis=2)
        ys, xs = np.where(diff)
        if not len(xs):
            print(name, ': base と同じ画像です'); continue
        x0, y0 = max(0, xs.min() - 2), max(0, ys.min() - 2)
        x1, y1 = min(base.width, xs.max() + 3), min(base.height, ys.max() + 3)
        out = np.zeros_like(b)
        out[y0:y1, x0:x1] = b[y0:y1, x0:x1]
        Image.fromarray(out, 'RGBA').save(os.path.join(skin_dir, frames[name]), lossless=True, method=6)
        print(name, 'overlay bbox', (int(x0), int(y0), int(x1), int(y1)))
    for k, v in frames.items():
        print(k, v, os.path.getsize(os.path.join(skin_dir, v)), 'bytes')

if __name__ == '__main__':
    main(sys.argv[1])
