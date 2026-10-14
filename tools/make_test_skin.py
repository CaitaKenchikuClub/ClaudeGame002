"""検証用の「色ちがいスキン」を作る（スキン差し替えの動作確認専用。本番素材ではありません）

  python tools/make_test_skin.py assets/skins/default WORK_DIR
  python tools/build_skin.py WORK_DIR
  → WORK_DIR の skin.json と *.webp を lab/skins/recolor/ へコピー
肌・ほっぺ・口などのピンク〜赤系は残し、髪や服の色相だけを回します。
"""
import sys, os, json
import numpy as np
from PIL import Image

def main(src, out):
    os.makedirs(out, exist_ok=True)
    meta = json.load(open(os.path.join(src, 'skin.json'), encoding='utf-8'))
    for key, name in meta['masters'].items():
        im = Image.open(os.path.join(src, name)).convert('RGBA')
        a = np.array(im)
        hsv = np.array(im.convert('RGB').convert('HSV')).astype(int)
        h = hsv[:, :, 0]
        keep = (h < 30) | (h > 228)          # 肌・ほっぺ・口（ピンク〜赤〜オレンジ）
        hsv[:, :, 0] = np.where(keep, h, (h + 105) % 256)
        rgb = np.array(Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB'))
        Image.fromarray(np.dstack([rgb, a[:, :, 3]]), 'RGBA').save(os.path.join(out, name))
    meta.update(id='test-recolor', name='テスト用スキン（色ちがい）', credit='検証用。default スキンの色相を変えただけの仮素材')
    meta['motion'] = dict(meta['motion'], bobPx=8, tiltDeg=1.8)
    json.dump(meta, open(os.path.join(out, 'skin.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
