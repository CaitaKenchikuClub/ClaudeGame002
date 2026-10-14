"""まばたき用フレームの作成（目元だけを最小限に変更）

base.png と同じキャンバスサイズ・同じ位置で blink.png を書き出します。
顔全体は描き直さず、EYES で指定した矩形の中の「目の線」だけを
  1) 周囲の肌色で塗りつぶし（OpenCV inpaint）
  2) 少し平らで、わずかに下がった閉じ目の線を描き直す
という手順で置き換えます。矩形の外の画素は1つも変わりません（最後に検証します）。

※この女神さまは元絵が「にっこり閉じ目（^ ^）」なので、まばたきは
  「笑い目のカーブがふっと平らになる」表現にしています。
  目を開いた差分が必要な場合は、イラストレーターによる手描きが必要です（README参照）。

使い方: python tools/make_blink.py assets/skins/default/base.png assets/skins/default/blink.png
"""
import sys
import numpy as np
import cv2
from PIL import Image, ImageDraw

# base.png 座標系での目の矩形 (x0, y0, x1, y1) と、描き直す閉じ目の線
EYES = [
    # 左目（画面左）：外側(左)にまつげ。ゆるい「‿」カーブの閉じ目
    dict(rect=(128, 94, 149, 109), line=[(132, 102.6), (136, 104.4), (140, 105.0), (144, 104.4), (147.5, 102.8)],
         lashes=[((132, 102.6), (129.2, 101.2)), ((132.6, 103.4), (129.6, 104.6))]),
    # 右目（画面右）：外側(右)にまつげ
    dict(rect=(168, 93, 195, 108), line=[(172, 102.2), (176.5, 104.0), (181, 104.6), (185.5, 104.0), (190, 102.0)],
         lashes=[((190, 102.0), (193.2, 100.4)), ((189.6, 102.8), (193.0, 104.0))]),
]
LINE_COLOR = (112, 64, 128, 255)
SS = 8  # アンチエイリアス用の拡大率

def main(src, dst):
    base = Image.open(src).convert('RGBA')
    arr = np.array(base)
    rgb = arr[:, :, :3].copy()
    luma = rgb.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)

    # 1) 目の線（肌より暗い画素）だけを塗りつぶす
    mask = np.zeros(luma.shape, np.uint8)
    for e in EYES:
        x0, y0, x1, y1 = e['rect']
        sub = luma[y0:y1, x0:x1] < 222
        mask[y0:y1, x0:x1] = sub.astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    keep = np.zeros_like(mask)
    for e in EYES:
        x0, y0, x1, y1 = e['rect']
        keep[y0:y1, x0:x1] = 255
    mask &= keep
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    filled = cv2.cvtColor(cv2.inpaint(bgr, mask, 4, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    out = arr.copy()
    out[:, :, :3] = np.where(mask[:, :, None] > 0, filled, rgb)

    # 2) 閉じ目の線を高解像度で描いて縮小（なめらかな線にする）
    H, W = luma.shape
    layer = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for e in EYES:
        pts = [(x * SS, y * SS) for x, y in e['line']]
        d.line(pts, fill=LINE_COLOR, width=int(3.0 * SS), joint='curve')
        for p in (pts[0], pts[-1]):
            r = 1.3 * SS
            d.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=LINE_COLOR)
        for (ax, ay), (bx, by) in e['lashes']:
            d.line([(ax * SS, ay * SS), (bx * SS, by * SS)], fill=LINE_COLOR, width=int(1.6 * SS))
    layer = np.array(layer.resize((W, H), Image.LANCZOS))
    layer[:, :, 3] = np.where(keep > 0, layer[:, :, 3], 0)  # 矩形の外には描かない
    layer = Image.fromarray(layer, 'RGBA')
    res = Image.fromarray(out, 'RGBA')
    res.alpha_composite(layer)

    # 3) 検証：矩形の外が1画素も変わっていないこと
    a, b = np.array(base), np.array(res)
    diff = np.any(a != b, axis=2)
    diff[keep > 0] = False
    assert not diff.any(), f'目の矩形の外が {int(diff.sum())} 画素変化しています'
    assert res.size == base.size
    res.save(dst, optimize=True)
    print('blink written', dst, res.size)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
