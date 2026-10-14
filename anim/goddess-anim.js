/* GoddessAnim — 一枚絵キャラクター用の軽量待機アニメーション
 *
 * 画像素材（スキン）とアニメーション処理を分離しています。
 *   スキン = skin.json + 同じキャンバスサイズの透過画像（base と blink）
 *   この JS = 上下動・傾き・呼吸・まばたき・タップ反応だけを担当
 *
 * 使い方:
 *   const skin = await GoddessAnim.loadSkin('assets/skins/default/skin.json');
 *   const ga = new GoddessAnim.Animator(document.querySelector('#host'), { skin });
 *   ga.stop(); ga.start(); ga.blink(); ga.react(); await ga.setSkin(otherSkin); ga.destroy();
 *   host.addEventListener('goddess:tap', ...)   // タップされたとき
 *
 * 軽さのための工夫:
 *   - 動きは CSS アニメーション（transform のみ）。毎フレームの JS 処理はありません
 *   - まばたきは setTimeout を1本だけ。停止中・タブ非表示・画面外では止めます
 */
(function (global) {
  'use strict';

  const DEFAULT_MOTION = {
    bobPx: 6, bobSec: 3.4,          // 上下動の幅(px)と片道の秒数
    tiltDeg: 1.2, tiltSec: 5.6,     // 傾きの角度と片道の秒数（上下動とずらして自然に）
    breathe: 0.012, breatheSec: 2.8,// 呼吸のような伸び縮み（1.2%）
    blinkMinSec: 2.2, blinkMaxSec: 6.5, // まばたきの間隔（ランダム）
    blinkMs: 120,                   // 目を閉じている時間
    doubleBlinkRate: 0.18,          // ときどき2回続けてまばたき
  };

  /** skin.json を読み込み、画像URLを skin.json の場所から解決して返す */
  async function loadSkin(url) {
    const abs = new URL(url, document.baseURI);
    const res = await fetch(abs);
    if (!res.ok) throw new Error(`skin.json が読めません: ${abs} (${res.status})`);
    const meta = await res.json();
    const urls = {};
    for (const [k, v] of Object.entries(meta.frames || {})) urls[k] = new URL(v, abs).href;
    if (!urls.base) throw new Error('skin.json の frames.base がありません');
    return Object.assign({}, meta, { url: abs.href, frameUrls: urls });
  }

  function preload(src) {
    return new Promise((ok, ng) => {
      const img = new Image();
      img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => ok(img));
      img.onerror = () => ng(new Error('画像が読めません: ' + src));
      img.src = src;
    });
  }

  const reduceMotion = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  class Animator {
    constructor(host, opts = {}) {
      this.host = host;
      this.opts = opts;
      this.running = false;     // 利用者が「動かす」を選んでいるか
      this.pageVisible = !document.hidden;
      this.onScreen = true;
      this.blinkTimer = 0;
      this.stats = { blinks: 0, taps: 0 };
      this._build();
      this._bind();
      this.ready = opts.skin ? this.setSkin(opts.skin) : Promise.resolve();
      this.ready.then(() => { if (opts.autostart !== false) this.start(); });
    }

    _build() {
      const root = document.createElement('div');
      root.className = 'ga-root ga-paused';
      root.setAttribute('role', 'img');
      root.innerHTML =
        '<div class="ga-layer ga-bob"><div class="ga-layer ga-sway"><div class="ga-layer ga-breathe"><div class="ga-layer ga-react">' +
        '<img class="ga-frame ga-base" alt="" draggable="false">' +
        '<img class="ga-frame ga-blink" alt="" draggable="false" aria-hidden="true">' +
        '</div></div></div></div>';
      // 複数体を置いても動きがそろわないよう、開始位置をランダムにずらす
      root.querySelector('.ga-bob').style.animationDelay = (-Math.random() * 6).toFixed(2) + 's';
      root.querySelector('.ga-sway').style.animationDelay = (-Math.random() * 10).toFixed(2) + 's';
      root.querySelector('.ga-breathe').style.animationDelay = (-Math.random() * 5).toFixed(2) + 's';
      this.host.appendChild(root);
      this.root = root;
      this.reactEl = root.querySelector('.ga-react');
      this.baseImg = root.querySelector('.ga-base');
      this.blinkImg = root.querySelector('.ga-blink');
    }

    _bind() {
      this._onVis = () => { this.pageVisible = !document.hidden; this._apply(); };
      document.addEventListener('visibilitychange', this._onVis);
      if ('IntersectionObserver' in global) {
        this._io = new IntersectionObserver(es => {
          for (const e of es) this.onScreen = e.isIntersecting;
          this._apply();
        });
        this._io.observe(this.host);
      }
      this._onTap = e => {
        if (e.button != null && e.button !== 0) return;
        this.stats.taps++;
        this.react();
        this.host.dispatchEvent(new CustomEvent('goddess:tap', { bubbles: true, detail: { x: e.clientX, y: e.clientY } }));
      };
      this.root.addEventListener('pointerdown', this._onTap);
    }

    /** スキンを差し替える（画像を読み込み終えてから一度に切り替えるので、ちらつかない） */
    async setSkin(skin) {
      const u = skin.frameUrls;
      await Promise.all([preload(u.base), u.blink ? preload(u.blink) : null]);
      const m = Object.assign({}, DEFAULT_MOTION, this.opts.motion, skin.motion);
      this.motion = m;
      const s = this.root.style;
      s.setProperty('--ga-bob-px', m.bobPx + 'px');
      s.setProperty('--ga-bob-sec', m.bobSec + 's');
      s.setProperty('--ga-tilt-deg', m.tiltDeg + 'deg');
      s.setProperty('--ga-tilt-sec', m.tiltSec + 's');
      s.setProperty('--ga-breathe', String(1 + m.breathe));
      s.setProperty('--ga-breathe-sec', m.breatheSec + 's');
      const [px, py] = skin.pivot || [0.5, 0.6];
      s.setProperty('--ga-pivot-x', px * 100 + '%');
      s.setProperty('--ga-pivot-y', py * 100 + '%');
      this.baseImg.src = u.base;
      this.blinkImg.src = u.blink || '';
      this.blinkImg.hidden = !u.blink;
      this.root.setAttribute('aria-label', skin.name || 'キャラクター');
      this.skin = skin;
    }

    get active() { return this.running && this.pageVisible && this.onScreen; }

    start() { this.running = true; this._apply(); }
    stop() { this.running = false; this._apply(); }
    toggle() { this.running ? this.stop() : this.start(); return this.running; }

    _apply() {
      const on = this.active;
      this.root.classList.toggle('ga-paused', !on);
      clearTimeout(this.blinkTimer);
      this.blinkTimer = 0;
      if (on) this._scheduleBlink();
      else this.root.classList.remove('ga-blinking');
      if (this.opts.onState) this.opts.onState(this.state());
    }

    state() {
      return { running: this.running, pageVisible: this.pageVisible, onScreen: this.onScreen, active: this.active };
    }

    _scheduleBlink() {
      const m = this.motion || DEFAULT_MOTION;
      const wait = (m.blinkMinSec + Math.random() * (m.blinkMaxSec - m.blinkMinSec)) * 1000;
      this.blinkTimer = setTimeout(() => {
        this.blink(Math.random() < m.doubleBlinkRate ? 2 : 1);
        if (this.active) this._scheduleBlink();
      }, wait);
    }

    /** まばたき（times 回）。閉じている時間 ms は省略可 */
    blink(times = 1, ms) {
      if (!this.skin || !this.skin.frameUrls.blink) return;
      const dur = ms || (this.motion || DEFAULT_MOTION).blinkMs;
      const once = (n) => {
        this.root.classList.add('ga-blinking');
        this.stats.blinks++;
        setTimeout(() => {
          this.root.classList.remove('ga-blinking');
          if (n > 1) setTimeout(() => once(n - 1), 110);
        }, dur);
      };
      once(times);
    }

    /** タップ時の反応：ぴょんと跳ねて、にっこり目を閉じる */
    react() {
      if (this._reactAnim) this._reactAnim.cancel();
      const big = !reduceMotion.matches;
      const k = big
        ? [
            { transform: 'translateY(0) scale(1,1)' },
            { transform: 'translateY(2%) scale(1.04,.95)', offset: .18 },
            { transform: 'translateY(-5%) scale(.98,1.03)', offset: .5 },
            { transform: 'translateY(0) scale(1.01,.99)', offset: .82 },
            { transform: 'translateY(0) scale(1,1)' },
          ]
        : [{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }];
      this._reactAnim = this.reactEl.animate(k, { duration: big ? 520 : 300, easing: 'ease-out' });
      this.blink(1, 260);
    }

    destroy() {
      clearTimeout(this.blinkTimer);
      document.removeEventListener('visibilitychange', this._onVis);
      if (this._io) this._io.disconnect();
      this.root.removeEventListener('pointerdown', this._onTap);
      this.root.remove();
    }
  }

  global.GoddessAnim = { loadSkin, Animator, DEFAULT_MOTION };
})(window);
