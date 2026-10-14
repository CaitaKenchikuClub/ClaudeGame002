"""女神さま立ち絵の背景除去（再現用スクリプト）

元画像(assets/source/original_artwork.webp)は読み取りのみ。上書きしません。

手順:
  1. 元画像から女神さま周辺をクロップ（座標は CROP_BOX）
  2. rembg の isnet-anime モデルで初期マスクを推定
  3. 線画（濃い輪郭線）で囲まれた領域ごとに、モデルのマスク平均で前景/背景を投票
     → 淡い髪の毛先や、背景色に近い髪の内側が半透明になる問題を補正
  4. 最大連結成分だけ残して、背景の雲や星のかけらを除去
  5. 縁を 1px 程度アンチエイリアスし、背景色の残留(フリンジ)を輪郭色側に寄せる

使い方:
  pip install "rembg[cpu]" scipy pillow numpy
  python tools/cutout_refine.py assets/source/original_artwork.webp OUT_DIR
出力: OUT_DIR/base.png（透過PNG・トリミング済み）, OUT_DIR/mask_model.png, OUT_DIR/mask_final.png
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

CROP_BOX = (190, 360, 620, 900)   # 元画像(768x1376)上の女神さま周辺
LINE_LUMA = 150                   # これより暗い画素を線画(境界)として扱う
VOTE = 0.25                       # 領域内のモデルマスク平均がこれ以上なら前景

def main(src, out):
    os.makedirs(out, exist_ok=True)
    im = Image.open(src).convert('RGB').crop(CROP_BOX)
    rgb = np.asarray(im).astype(np.float32)

    from rembg import remove, new_session
    model = remove(im, session=new_session('isnet-anime'), only_mask=True)
    model.save(os.path.join(out, 'mask_model.png'))
    m = np.asarray(model.convert('L')).astype(np.float32) / 255

    luma = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    line = ndi.binary_dilation(luma < LINE_LUMA, iterations=1)

    # 線画で区切られた領域ごとに前景/背景を投票
    lab, n = ndi.label(~line)
    idx = np.arange(1, n + 1)
    mean = ndi.mean(m, lab, idx)
    fg_lab = np.zeros(n + 1, bool); fg_lab[1:] = mean >= VOTE
    fg = fg_lab[lab]
    fg |= m > 0.85                                    # モデルが確信している所は残す

    # 前景に接する線画（輪郭線）を前景へ
    fg |= line & ndi.binary_dilation(fg, iterations=3)

    # 最大連結成分のみ（背景の雲・星・きらめきのかけらを除去）
    lab2, n2 = ndi.label(fg)
    sizes = ndi.sum(fg, lab2, range(1, n2 + 1))
    fg = lab2 == (1 + int(np.argmax(sizes)))
    fg = ndi.binary_fill_holes(fg) if FILL_HOLES else fg
    fg = ndi.binary_opening(fg, iterations=1) | (fg & (m > 0.5))  # 1px のトゲを除去

    # アンチエイリアス：わずかにぼかして、内側は不透明のまま
    a = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    a = np.asarray(a).astype(np.float32) / 255
    a = np.clip((a - 0.15) / 0.7, 0, 1)

    # フリンジ除去：半透明の縁の色を、内側の近い前景画素の色に置き換える
    solid = a > 0.98
    _, (iy, ix) = ndi.distance_transform_edt(~solid, return_indices=True)
    edge = (a > 0) & ~solid
    rgb2 = rgb.copy()
    rgb2[edge] = rgb[iy[edge], ix[edge]]

    outimg = Image.fromarray(np.dstack([rgb2, a * 255]).astype(np.uint8), 'RGBA')
    # 余白 PAD px を残してトリミング（キャンバスサイズはここで確定し、まばたき画像も同じサイズで作る）
    ys, xs = np.where(a > 0)
    box = (int(xs.min()) - PAD, int(ys.min()) - PAD, int(xs.max()) + 1 + PAD, int(ys.max()) + 1 + PAD)
    outimg.crop(box).save(os.path.join(out, 'base.png'), optimize=True)
    Image.fromarray((a * 255).astype(np.uint8)).crop(box).save(os.path.join(out, 'mask_final.png'))
    print('regions', n, 'fg px', int(fg.sum()), 'trim box (crop coords)', box, 'size', outimg.crop(box).size)

FILL_HOLES = False
PAD = 10

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
