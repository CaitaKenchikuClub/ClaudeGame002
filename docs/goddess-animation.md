# 女神さま 透過処理と簡易アニメーション

一枚絵のまま「Live2D風」に少しだけ動かすための素材と仕組みです。
検証ページ `lab/goddess.html` での確認を経て、**ゲーム本体に組み込み済み**です（下の「本体への組み込み」）。

---

## 第1段階：既存素材の調査結果

### 使用している画像

| ファイル | サイズ | 容量 | 使っている場所 | 内容 |
|---|---|---|---|---|
| `assets/world.webp` | 768×1376 | 191KB | `style.css` の `body::before`（ぼかした背景） | 添付の元絵を再圧縮したもの（非可逆） |
| `assets/goddess.webp` | 376×480 | 64KB | `index.html` の `#goddess`（ステージの女神さま） | 元絵から楕円にぼかし切り抜き。**背景つき** |
| `assets/goddess_face.webp` | 160×160 | 8KB | favicon、モーダルの丸アイコン | 顔まわりを丸く切り抜き。背景つき |

※元のPNG/WebP（添付画像そのもの）はリポジトリに入っていなかったため、
今回 `assets/source/original_artwork.webp`（768×1376、SHA-256 `945db8df…a32c`）として**無加工で**保存しました。

### キャラクター画像の表示箇所

- `index.html` 52行目：`<img id="goddess" src="assets/goddess.webp">`（`#goddess-wrap` の中）
- `style.css` 58〜60行目：`#goddess` に CSS アニメーション `float`（上下動）と、魔法時の `castpose`
- `game.js`
  - 344〜349行目 `castMagic()`：`#goddess` に `cast` クラスを付ける／`centerOf(goddess)` でキラキラの発生位置を取る
  - 688行目：`#goddess` のクリックで `castMagic()`

### 背景とキャラクターの分離が必要な箇所

- **必要**：ステージの `assets/goddess.webp`。楕円のぼかしで切っているので、周囲に空・雲・きゅうりが残っています。
- 不要：`assets/world.webp`（ページ全体のぼかし背景。背景として使っているのでそのままでよい）
- 不要：`assets/goddess_face.webp`（丸いアイコンとして使うので背景つきのままで自然）

### 差し替えに必要な変更（本体への組み込み時）

1. `index.html`：`<img id="goddess">` を、アニメ用の入れ物 `<div id="goddess">` に変更し、`anim/goddess-anim.css` / `anim/goddess-anim.js` を読み込む
2. `style.css`：`#goddess` の `float` / `castpose` アニメーションを外す（上下動は新しい仕組みが担当。二重にかかるのを防ぐ）
3. `game.js`：
   - 起動時に `GoddessAnim.loadSkin('assets/skins/default/skin.json')` → `new GoddessAnim.Animator($('#goddess'), { skin })`
   - クリック処理は `goddess:tap` イベント（または今までどおり click）で `castMagic()` を呼ぶ
   - `castMagic()` の `cast` クラス付与を `ga.react()` に置き換える
   - `centerOf($('#goddess'))` は入れ物の div でもそのまま動く
4. 読み込みに失敗したときは今の `goddess.webp` を表示するフォールバックを残す

### 既存のゲーム機能・セーブデータへの影響

- セーブデータ（localStorage の `kyuuri-megami-save-v1`）には画像の情報は入っていないため、**差し替えても影響なし**。
- 将来スキンを選べるようにする場合は、セーブに `skin: 'default'` を追加するだけ。
  読み込み時に `Object.assign(defaultState(), 保存データ)` しているので、古いセーブでも自動で `'default'` になります。
- 検証ページ `lab/goddess.html` は localStorage / sessionStorage を一切使いません（テストで確認済み）。

---

## 第2段階：透過画像（実施済み）

| | |
|---|---|
| 出力 | `assets/skins/default/base.png`（387×450、透過PNG、マスター） |
| 使ったツール | rembg + **isnet-anime**（アニメ絵向けの切り抜きAI）、numpy / scipy / Pillow |
| 再現スクリプト | `tools/cutout_refine.py` |

手順と、注意点への対策：

1. 元絵から女神さま周辺をクロップ（元絵は読み取りのみ）
2. isnet-anime でマスクを推定
   - 結果：ほぼきれいだが、**右上の淡い髪の毛先が半透明**になり、**足元に雲のかけら**が残った
3. **線画で囲まれた領域ごとの投票**で補正：濃い輪郭線で区切られた領域ごとに、AIマスクの平均が25%以上なら前景にする
   - 髪の毛先は輪郭線で囲まれているので、領域ごと不透明に戻る → 髪の欠け・不自然な切り抜きを防止
   - 前景に接する輪郭線は前景に含める → 輪郭の欠けを防止
4. いちばん大きなかたまりだけ残す → 背景の雲・星・きらめきのかけらを除去
5. 縁を約1pxだけなめらかにし、半透明の縁の色を内側の色に置き換え → 背景色（空色・ピンク）の残留を防止
6. 余白10pxでトリミング（このキャンバスサイズを、まばたき画像でも共通で使う）

確認方法：`lab/goddess.html` の「背景」でチェック柄・濃い色・緑・ゲーム背景に切り替えて縁を確認できます。

## 第3段階：まばたき素材（実施済み）

**重要な発見**：この女神さまは元絵の時点で**にっこり閉じ目（^ ^）**です。
「開いた目 → 閉じた目」のまばたきは、目を描き足さないと作れません（＝顔立ちが変わる）。

そこで、顔を描き直さない最小限の方針として：

- まばたきフレーム = **笑い目のカーブ（^ ^）がふっと平らな閉じ目（‿ ‿）になる**
- 変更は目の矩形2か所（約21×15px と 27×15px）の中だけ
  1. 目の線を周りの肌色で塗りつぶし（OpenCV inpaint）
  2. 元の線の色・太さに合わせて、閉じ目の線とまつげを描き直す
- スクリプト `tools/make_blink.py` が「矩形の外の画素が1つも変わっていない」ことを自動チェック
- `blink.png` は `base.png` と**同じ 387×450 キャンバス・同じ位置**

実行時は `tools/build_skin.py` が `blink.png` と `base.png` の差分を取り、
**目元だけを残した上乗せ用画像** `blink.webp`（2KB）を作ります。
`base` の上に重ねて表示するので、切り替えても位置がずれません（ブラウザ上で目元以外の変化がないことを確認済み）。

### 手作業が必要になるもの

- **開いた目のまばたきが欲しい場合**：イラストレーターに「目を開いた版」を描いてもらう必要があります。
  `base.png` をレイヤーの下に敷き、**同じキャンバスサイズ・位置のまま目元だけ**描いて書き出せば、
  そのまま `base`（開き目）として使え、今の `base.png` を `blink`（閉じ目）にできます。
- 新しい衣装のスキンを作るとき（下記）。

## 第4段階：簡易アニメーション（検証ページで実装済み）

検証ページ：`lab/goddess.html`（GitHub Pages では `…/ClaudeGame002/lab/goddess.html`）

| 動き | 内容 |
|---|---|
| 上下動 | 6px 幅、片道3.4秒 |
| 傾き | ±1.2°、片道5.6秒（上下動と周期をずらし、同じ動きの繰り返しに見えないように） |
| 呼吸 | 足元を支点に縦1.2%だけ伸び縮み（2.8秒） |
| まばたき | 2.2〜6.5秒のランダム間隔、0.12秒。18%の確率で2回続けて |
| タップ反応 | ぴょんと縮んで跳ねる（0.52秒）＋にっこり目を閉じる。`goddess:tap` イベントを発行 |

軽さ・止め方：

- 動きは CSS アニメーション（`transform` だけ）で GPU 合成。毎フレームの JavaScript はゼロ
- JS はまばたき用の `setTimeout` 1本だけ
- `stop()` / `start()` で停止・再開（その場の姿勢で止まる）
- **タブが非表示**（visibilitychange）、**画面外**（IntersectionObserver）のときは自動で一時停止し、まばたきタイマーも止める
- 端末の「視差効果を減らす」設定では上下動・傾きを止める

## 第5段階：スキン対応（構造）

```
anim/
  goddess-anim.js      … アニメーション処理（画像の中身を知らない）
  goddess-anim.css
assets/skins/<スキン名>/
  skin.json            … キャンバスサイズ・画像ファイル・傾きの支点・動きの調整値
  base.png, blink.png  … マスター（透過PNG、同じキャンバスサイズ）
  base.webp, blink.webp… 実行用（tools/build_skin.py で生成）
assets/source/
  original_artwork.webp … 元絵（無加工）
tools/
  cutout_refine.py     … 背景除去
  make_blink.py        … まばたき差分（目元だけ変更）
  build_skin.py        … マスター → 実行用WebP
  make_test_skin.py    … 検証用の色ちがいスキン
lab/
  goddess.html         … 独立した検証ページ
  skins/recolor/       … 検証用スキン（本番では使わない）
```

### 新しい衣装スキンの追加手順

1. 透過PNGを2枚用意（**同じキャンバスサイズ・同じ位置**）
   - `base.png`：通常
   - `blink.png`：目元だけ変えたもの（なければ省略可。まばたきなしで動きます）
2. `assets/skins/<名前>/` に置き、`skin.json` を default からコピーして `id` / `name` / `size` を書き換え
   - 体の傾きの中心がずれる場合は `pivot`（0〜1の割合）を、動きの大きさは `motion` を調整
3. `python tools/build_skin.py assets/skins/<名前>` で実行用WebPを生成
4. 検証ページの `<select id="sel-skin">` に追加して確認

アニメーションのコードは変更不要です（検証ページの「テスト用（色ちがい）」スキンで、差し替えだけで同じ動きになることを確認済み）。

## 再生成のコマンド

```sh
pip install "rembg[cpu]" opencv-python-headless scipy pillow numpy
python tools/cutout_refine.py assets/source/original_artwork.webp assets/skins/default   # base.png
python tools/make_blink.py   assets/skins/default/base.png assets/skins/default/blink.png
python tools/build_skin.py   assets/skins/default
```
（`cutout_refine.py` は `base.png` のほか確認用のマスク画像も出力します）

## 本体への組み込み（実施済み）

- `index.html`：`#goddess` を `<div>` に変更、`anim/goddess-anim.css` / `.js` を読み込み、`base.webp` を preload
- `style.css`：旧 `float` / `castpose` アニメーションを削除。影（drop-shadow）は動かない `base` 画像だけにかけて、毎フレームの再描画を避ける
- `game.js`
  - `initGoddess()`：`assets/skins/default/skin.json` を読み込んでアニメ開始。読めないとき（file:// で開いた等）は旧 `goddess.webp` を表示して従来どおり動く
  - 女神さまのタップ（`goddess:tap`）で `castMagic()`。魔法ボタン・タップのどちらでも女神さまがぴょんと反応（`react()`）
  - ⚙️ せってい に「女神さまのアニメーション」オン／オフを追加
- セーブデータ：`goddessAnim: true`（アニメのオン／オフ）を1項目追加。古いセーブは自動で `true` になり、ほかの項目は変わりません
- スキンを変える場合は `game.js` の `GODDESS_SKIN` のパスを変えるだけ
- 旧 `assets/goddess.webp` はフォールバックと検証ページの比較用に残しています
