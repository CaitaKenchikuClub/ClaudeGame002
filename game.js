'use strict';
/* きゅうりの国の女神さま — きゅうり育成ゲーム */

const SAVE_KEY = 'kyuuri-megami-save-v1';
const OFFLINE_MAX = 8 * 3600;      // とじている間に進む最大秒数
const PICKLE_TIME = 30;            // 鍋でピクルスになるまでの秒数
const BASE_HAPPY = 10;             // きゅうり1本のしあわせ基本値

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const rand = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const NAMES = ['ミント','ルル','ココ','ミミ','ララ','ノノ','ピコ','モモ','ユメ','リリ','ソラ','ハナ','ネネ','チロ','キキ','メル',
  'ポポ','ルナ','ニコ','サクラ','スズ','アン','マリ','ユズ','ティア','ラム','フウ','ミュウ','ココア','シフォン','マカロン','プリン',
  'ベリー','レモン','ウメ','ナナ','トト','リボン','ステラ','エマ','ミルク','クルミ','ポエム','シュガー','ハル','アオイ','ヒナ','マシュ'];
const HAIR = ['#f7a8d0','#c9a7f5','#9fd2f7','#ffd59e','#a9e6cb','#ffb3ba','#f3b6e6','#d0b0ff','#93dde4','#ffe08a','#f6c49a','#bfc8ff'];
const DRESS = ['#ffd1e8','#e0d1ff','#d1f0ff','#fff1c1','#d7f7e3','#ffe0d1','#f9d9ff'];

/* ---------------- 施設 ---------------- */
const FAC = [
  { id:'field', icon:'🌱', name:'ひろがる畑', base:30, mult:2.1, max:13,
    desc:'きゅうり畑のマスがふえます。',
    eff:l => `畑 ${4 + 2 * l}マス` },
  { id:'bell', icon:'🔔', name:'よびよせの鐘', base:60, mult:2.2, max:12,
    desc:'鐘の音で住民の女の子たちを女神さまのそばに集めます。',
    eff:l => `そばにいられる人数 ${queueCap(l)}人・${spawnInterval(l).toFixed(1)}秒ごとに1人` },
  { id:'cloud', icon:'☁️', name:'あまぐもさん', base:120, mult:2.3,
    desc:'小さな雨雲が、のどがかわいたきゅうりに自動で水やりします。',
    eff:l => l ? `自動水やり 毎秒${rateCloud(l).toFixed(2)}回` : '自動水やりなし' },
  { id:'mush', icon:'🍄', name:'キノコの肥料工房', base:250, mult:2.3,
    desc:'キノコの妖精が、ふかふか肥料を自動であげてくれます。',
    eff:l => l ? `自動ひりょう 毎秒${rateMush(l).toFixed(2)}回` : '自動ひりょうなし' },
  { id:'green', icon:'🏡', name:'星のガラス温室', base:500, mult:2.4,
    desc:'星の光をあつめて、きゅうりがぐんぐん育ちます。',
    eff:l => `成長スピード ×${growMult(l).toFixed(2)}` },
  { id:'rainbow', icon:'🌈', name:'虹の水路', base:900, mult:2.4,
    desc:'畑にうるおいが行きわたり、水と肥料が長持ちします。',
    eff:l => `水・肥料のへり方 ×${decayMult(l).toFixed(2)}` },
  { id:'rabbit', icon:'🐰', name:'収穫うさぎ小屋', base:1500, mult:2.5,
    desc:'うさぎさんが、育ったきゅうりをやさしく収穫してかごへ。',
    eff:l => l ? `自動収穫 毎秒${rateRabbit(l).toFixed(2)}本` : '自動収穫なし' },
  { id:'butterfly', icon:'🦋', name:'ちょうちょ便', base:2500, mult:2.5,
    desc:'ちょうちょたちが、かごのきゅうりを丸ごと大鍋へ運びます。',
    eff:l => l ? `自動はこび 毎秒${rateButterfly(l).toFixed(2)}本` : '自動はこびなし' },
  { id:'wand', icon:'🪄', name:'星のステッキ', base:4000, mult:2.6, max:14,
    desc:'女神さまのステッキがパワーアップ。ひとふりで魔法をかけられる人数がふえます（魔法はいつも女神さまが自分でかけます）。',
    eff:l => `ひとふりで ${wandPower(l)}人まで` },
  { id:'lamp', icon:'🌙', name:'三日月ランプ', base:6500, mult:2.6,
    desc:'やさしい月あかりで、きらきら★のきゅうりが育ちやすくなります。',
    eff:l => `★プラスの確率 ${Math.round(lampChance(l) * 100)}%` },
  { id:'pot', icon:'🍲', name:'大鍋のおまじない', base:10000, mult:2.2,
    desc:'大鍋に女神さまのおまじない。ピクルスがもっとしあわせな味に。',
    eff:l => `しあわせ ×${potMult(l).toFixed(1)}` },
  { id:'fountain', icon:'⛲', name:'ハートの噴水', base:16000, mult:2.6,
    desc:'鍋に入れたとき、ときどき「だいしあわせ」（3倍）が起こります。',
    eff:l => `だいしあわせ確率 ${Math.round(fountainChance(l) * 100)}%` },
  { id:'castle', icon:'🏰', name:'きゅうり城', base:30000, mult:3.0,
    desc:'国のみんなの憧れ。お城が立派になるほど、国じゅうのしあわせが大きくなります。',
    eff:l => `しあわせ ×${castleMult(l).toFixed(2)}` },
];
const FAC_BY_ID = Object.fromEntries(FAC.map(f => [f.id, f]));

const lv = id => S.fac[id] || 0;
const plotCount = (l = lv('field')) => 4 + 2 * l;
const queueCap = (l = lv('bell')) => Math.min(3 + 2 * l, 24);
const spawnInterval = (l = lv('bell')) => 5 / (1 + 0.45 * l);
const rateCloud = (l = lv('cloud')) => l ? 0.12 * l : 0;
const rateMush = (l = lv('mush')) => l ? 0.1 * l : 0;
const growMult = (l = lv('green')) => 1 + 0.35 * l;
const decayMult = (l = lv('rainbow')) => Math.max(0.15, Math.pow(0.85, l));
const rateRabbit = (l = lv('rabbit')) => l ? 0.15 * l : 0;
const rateButterfly = (l = lv('butterfly')) => l ? 0.25 * l : 0;
const wandPower = (l = lv('wand')) => 1 + l;
const lampChance = (l = lv('lamp')) => Math.min(0.8, 0.1 * l);
const potMult = (l = lv('pot')) => 1 + 0.5 * l;
const fountainChance = (l = lv('fountain')) => Math.min(0.5, 0.05 * l);
const castleMult = (l = lv('castle')) => Math.pow(1.3, l);

function threshold(f, level) { return Math.round(f.base * Math.pow(f.mult, level)); }
function facMaxed(f) { return f.max != null && lv(f.id) >= f.max; }
function facNext(f) { return facMaxed(f) ? Infinity : threshold(f, lv(f.id)); }
function facAvailable(f) { return !facMaxed(f) && S.happy >= facNext(f); }

const TITLES = [
  [0, 'みならい女神'], [100, 'きゅうりの女神'], [1000, 'しあわせの女神'], [1e4, 'ピクルスの女神'],
  [1e5, '虹の大女神'], [1e6, '星きゅうりの大女神'], [1e7, '月夜の大大女神'], [1e8, '宇宙きゅうり女神'],
  [1e10, '銀河ピクルス女神'], [1e13, '永遠のしあわせ女神'],
];
const titleOf = h => TITLES.filter(t => h >= t[0]).pop()[1];

const STAR_MULT = [1, 1, 1.6, 2.4, 3.6];

/* ---------------- 状態 ---------------- */
function defaultState() {
  return {
    v: 1, happy: 0, plots: Array.from({ length: plotCount(0) }, () => null),
    queue: [], spawnT: 3, basket: [], pot: [], pickles: 0,
    harvested: 0, cast: 0, potted: 0, crits: 0, best: 0, playTime: 0,
    fac: {}, acc: { cloud: 0, mush: 0, rabbit: 0, butterfly: 0 },
    tool: 'water', sound: true, anim: true, lastSave: Date.now(), seen: false, recent: [],
  };
}
let S = defaultState();

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    S = Object.assign(defaultState(), d);
    S.acc = Object.assign(defaultState().acc, d.acc || {});
    while (S.plots.length < plotCount()) S.plots.push(null);
    S.plots.forEach(c => { if (c) delete c.pending; });
    return true;
  } catch (e) { return false; }
}
function save() {
  S.lastSave = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 保存できない環境 */ }
}

/* ---------------- 数字の表示 ---------------- */
const UNITS = [[1e48,'極'],[1e44,'載'],[1e40,'正'],[1e36,'澗'],[1e32,'溝'],[1e28,'穣'],[1e24,'秭'],[1e20,'垓'],[1e16,'京'],[1e12,'兆'],[1e8,'億'],[1e4,'万']];
function fmt(n) {
  n = Math.floor(n);
  if (n < 1e4) return n.toLocaleString('ja-JP');
  for (const [v, u] of UNITS) if (n >= v) {
    const x = n / v;
    let s = x >= 100 ? String(Math.floor(x)) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
    if (s.includes('.')) s = s.replace(/\.?0+$/, '');
    return s + u;
  }
  return String(n);
}

/* ---------------- SVG ---------------- */
function cukeG(ribbon, opts = {}) {
  // 横向きのきゅうり(0..120 x 0..60)。そのままの1本。
  const fill = opts.pickle ? 'url(#g-pickle)' : 'url(#g-cuke)';
  const stroke = opts.pickle ? '#5e6a2a' : '#2f7d3a';
  const face = opts.face === false ? '' : (opts.sad
    ? `<circle cx="51" cy="29" r="2.6" fill="#3b4a3b"/><circle cx="69" cy="29" r="2.6" fill="#3b4a3b"/><path d="M56 37 q4 -3 8 0" stroke="#3b4a3b" stroke-width="2" fill="none" stroke-linecap="round"/>`
    : `<path d="M46 29 q5 -6 10 0 M64 29 q5 -6 10 0" stroke="#2f4a33" stroke-width="2.6" fill="none" stroke-linecap="round"/>
       <path d="M55 34 q5 7 10 0 z" fill="#ff7fa8" stroke="#2f4a33" stroke-width="1.6" stroke-linejoin="round"/>
       <ellipse cx="42" cy="36" rx="5" ry="3" fill="#ff9fc4" opacity=".7"/><ellipse cx="78" cy="36" rx="5" ry="3" fill="#ff9fc4" opacity=".7"/>`);
  return `<g>
    <path d="M10 31 C10 15 30 10 60 12 C92 13 110 18 110 30 C110 43 92 49 60 48 C30 49 10 46 10 31Z" fill="${fill}" stroke="${stroke}" stroke-width="2.6"/>
    <ellipse cx="58" cy="19" rx="32" ry="3.5" fill="#fff" opacity=".45"/>
    <g fill="${opts.pickle ? '#e6e9a6' : '#d9fbc6'}"><circle cx="24" cy="24" r="1.6"/><circle cx="34" cy="41" r="1.6"/><circle cx="88" cy="22" r="1.6"/><circle cx="96" cy="38" r="1.6"/><circle cx="80" cy="43" r="1.4"/><circle cx="30" cy="33" r="1.3"/></g>
    <path d="M109 28 q7 -2 9 -7" stroke="#6a8f3a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    ${face}
    ${ribbon ? `<g transform="translate(20 15)"><path d="M0 0 L-9 -6 L-9 6Z M0 0 L9 -6 L9 6Z" fill="${ribbon}" stroke="#fff" stroke-width="1.2"/><circle r="3" fill="${ribbon}" stroke="#fff" stroke-width="1.2"/></g>` : ''}
  </g>`;
}
function cukeSVG(ribbon, opts) { return `<svg viewBox="0 0 120 60">${cukeG(ribbon, opts)}</svg>`; }

function girlSVG(g) {
  return `<svg viewBox="0 0 60 80">
    <circle cx="13" cy="24" r="8" fill="${g.hair}"/><circle cx="47" cy="24" r="8" fill="${g.hair}"/>
    <ellipse cx="30" cy="34" rx="19" ry="21" fill="${g.hair}"/>
    <path d="M30 44 L47 70 Q30 76 13 70Z" fill="${g.dress}" stroke="#fff" stroke-width="1.5"/>
    <path d="M24 72 v6 M36 72 v6" stroke="#ffe0d0" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="30" cy="31" r="14" fill="#ffeadf"/>
    <path d="M16 31 Q16 14 30 15 Q44 14 44 31 Q40 22 34 24 Q30 19 26 24 Q20 22 16 31Z" fill="${g.hair}"/>
    <ellipse cx="25" cy="33" rx="1.9" ry="2.4" fill="#6a3d6a"/><ellipse cx="35" cy="33" rx="1.9" ry="2.4" fill="#6a3d6a"/>
    <circle cx="25.6" cy="32.2" r=".7" fill="#fff"/><circle cx="35.6" cy="32.2" r=".7" fill="#fff"/>
    <ellipse cx="21" cy="37" rx="2.8" ry="1.6" fill="#ffaccc" opacity=".8"/><ellipse cx="39" cy="37" rx="2.8" ry="1.6" fill="#ffaccc" opacity=".8"/>
    <path d="M28 38 q2 2 4 0" stroke="#c0607a" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M42 16 l1.6 3.2 3.5 .5 -2.5 2.4 .6 3.5 -3.2 -1.7 -3.2 1.7 .6 -3.5 -2.5 -2.4 3.5 -.5z" fill="#fff3a0" stroke="#f5c84a" stroke-width=".8"/>
  </svg>`;
}

function leaf(x, y, r, s = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path d="M0 0 C6 -10 20 -10 24 0 C20 8 6 8 0 0Z" fill="#7ad36f" stroke="#3f9e47" stroke-width="1.6"/><path d="M2 0 H20" stroke="#3f9e47" stroke-width="1"/></g>`;
}
const SOIL = `<ellipse cx="50" cy="88" rx="38" ry="9" fill="url(#g-soil)"/><ellipse cx="50" cy="85" rx="30" ry="5" fill="#f0d2bb" opacity=".6"/>`;
function ribbonAt(x, y, c) {
  return `<g transform="translate(${x} ${y})"><path d="M0 0 L-7 -5 L-7 5Z M0 0 L7 -5 L7 5Z" fill="${c}" stroke="#fff" stroke-width="1"/><circle r="2.4" fill="${c}" stroke="#fff" stroke-width="1"/></g>`;
}
function stageOf(c) {
  if (c.growth >= 100) return 4;
  if (c.growth >= 70) return 3;
  if (c.growth >= 45) return 2;
  if (c.growth >= 20) return 1;
  return 0;
}
function plotArt(c) {
  const st = stageOf(c), col = c.hair;
  const thirsty = c.water <= 0;
  if (st === 0) {
    const droop = thirsty ? 12 : 0;
    return `<svg viewBox="0 0 100 100">${SOIL}<path d="M50 86 V64" stroke="#55b35a" stroke-width="4" stroke-linecap="round"/>
      ${leaf(50, 66, -150 + droop, .8)}${leaf(50, 66, -30 - droop, .8)}${ribbonAt(50, 78, col)}</svg>`;
  }
  const vine = `<path d="M50 86 C44 72 58 62 50 50 C43 40 56 32 50 22" stroke="#55b35a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M50 22 c6 -4 10 0 7 4" stroke="#55b35a" stroke-width="1.6" fill="none"/>`;
  const leaves = `${leaf(50, 70, -160)}${leaf(52, 54, -20)}${leaf(50, 36, -155, .85)}`;
  if (st === 1) return `<svg viewBox="0 0 100 100">${SOIL}${vine}${leaves}${ribbonAt(46, 80, col)}</svg>`;
  const flower = `<g transform="translate(60 26)">${[0, 72, 144, 216, 288].map(a => `<ellipse rx="4" ry="6.5" fill="#ffe46b" stroke="#f0b93a" stroke-width="1" transform="rotate(${a}) translate(0 -6)"/>`).join('')}<circle r="3.4" fill="#ffb347"/></g>`;
  if (st === 2) return `<svg viewBox="0 0 100 100">${SOIL}${vine}${leaves}${flower}${ribbonAt(46, 80, col)}</svg>`;
  if (st === 3) return `<svg viewBox="0 0 100 100">${SOIL}${vine}${leaves}
      <g transform="translate(55 34) rotate(80) scale(.32)">${cukeG(null, { face: false })}</g>${flower.replace('translate(60 26)', 'translate(64 22) scale(.7)')}${ribbonAt(46, 80, col)}</svg>`;
  // 収穫できる！
  return `<svg viewBox="0 0 100 100">${SOIL}
    <path d="M50 86 C44 72 58 62 50 50" stroke="#55b35a" stroke-width="3.5" fill="none"/>${leaf(50, 72, -160)}${leaf(52, 60, -20)}
    <g transform="translate(14 76) rotate(-58) scale(.62)">${cukeG(col)}</g>
    <g fill="#ffd84a"><path d="M82 18 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/><path d="M18 26 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4z"/></g></svg>`;
}

function potSVG() {
  const shown = S.pot.slice(-9);
  const pos = [[52, 40], [80, 37], [108, 41], [64, 46], [94, 47], [40, 46], [120, 47], [72, 39], [100, 36]];
  const cukes = shown.map((p, i) => {
    const [x, y] = pos[i % pos.length];
    const rot = (i * 37) % 50 - 25;
    return `<g transform="translate(${x} ${y})"><g class="bob" style="animation-delay:${(i * .37) % 2.4}s"><g transform="rotate(${rot}) scale(.26) translate(-60 -30)">${cukeG(p.c, { pickle: p.t > .5 })}</g></g></g>`;
  }).join('');
  return `<svg viewBox="0 0 160 120">
    <g stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9">
      <path class="steam" d="M58 22 q-6 -8 0 -16" style="animation-delay:0s"/>
      <path class="steam" d="M82 20 q-6 -8 0 -16" style="animation-delay:1s"/>
      <path class="steam" d="M104 22 q-6 -8 0 -16" style="animation-delay:2s"/>
    </g>
    <path d="M18 42 C18 98 40 112 80 112 C120 112 142 98 142 42Z" fill="url(#g-pot)" stroke="#8a6cc9" stroke-width="3"/>
    <path d="M30 60 C34 88 50 100 70 104" stroke="#fff" stroke-width="4" fill="none" opacity=".55" stroke-linecap="round"/>
    <ellipse cx="80" cy="42" rx="64" ry="15" fill="#a48ce0" stroke="#8a6cc9" stroke-width="3"/>
    <ellipse cx="80" cy="43" rx="56" ry="11" fill="url(#g-brine)"/>
    ${cukes}
    <g fill="#fff" opacity=".9"><circle class="bubble" cx="60" cy="44" r="2"/><circle class="bubble" cx="96" cy="46" r="1.6" style="animation-delay:.8s"/><circle class="bubble" cx="78" cy="48" r="2.2" style="animation-delay:1.5s"/></g>
    <path d="M16 42 C16 52 30 58 80 58 C130 58 144 52 144 42" stroke="#8a6cc9" stroke-width="3" fill="none"/>
    <path d="M18 50 q-12 0 -12 10" stroke="#8a6cc9" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M142 50 q12 0 12 10" stroke="#8a6cc9" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g transform="translate(80 84)"><path d="M0 6 C-12 -4 -6 -14 0 -7 C6 -14 12 -4 0 6Z" fill="#ff9fd0" stroke="#fff" stroke-width="1.5"/></g>
  </svg>`;
}

/* ---------------- 音 ---------------- */
let actx = null;
function sound(kind) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const seqs = {
      magic: [[880, 0], [1175, .07], [1568, .14], [2093, .21]],
      harvest: [[1046, 0], [1318, .08]],
      pot: [[392, 0], [523, .06]],
      water: [[1400, 0]], fert: [[700, 0]],
      build: [[523, 0], [659, .1], [784, .2], [1046, .3], [1318, .42]],
      crit: [[784, 0], [988, .06], [1318, .12], [1568, .18]],
    }[kind] || [[600, 0]];
    const t0 = actx.currentTime;
    for (const [f, d] of seqs) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = kind === 'pot' ? 'triangle' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(kind === 'water' || kind === 'fert' ? 0.05 : 0.12, t0 + d + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.25);
      o.connect(g).connect(actx.destination);
      o.start(t0 + d); o.stop(t0 + d + 0.3);
    }
  } catch (e) { /* 音が出せない環境 */ }
}

/* ---------------- エフェクト ---------------- */
const fx = $('#fx');
function centerOf(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
function floatText(x, y, html, cls = '', dist = 50, dur = 1300) {
  const d = document.createElement('div');
  d.className = 'float ' + cls; d.innerHTML = html;
  d.style.left = x + 'px'; d.style.top = y + 'px';
  fx.appendChild(d);
  const dx = (Math.random() - .5) * 16;
  d.animate([
    { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
    { transform: 'translate(-50%,-80%) scale(1.08)', opacity: 1, offset: .18 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${dist}px)) scale(1)`, opacity: 0 },
  ], { duration: dur, easing: 'ease-out' }).onfinish = () => d.remove();
}
function flyTo(html, cls, from, to, dur = 650, spin = 0, scaleEnd = 1) {
  return new Promise(res => {
    const d = document.createElement('div');
    d.className = cls; d.innerHTML = html;
    d.style.left = from[0] + 'px'; d.style.top = from[1] + 'px';
    fx.appendChild(d);
    const dx = to[0] - from[0], dy = to[1] - from[1];
    d.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)' },
      { transform: `translate(${dx * .5}px, ${dy * .5 - 60}px) rotate(${spin / 2}deg) scale(${(1 + scaleEnd) / 2 + .15})`, offset: .5 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(${scaleEnd})` },
    ], { duration: dur, easing: 'ease-in-out' }).onfinish = () => { d.remove(); res(); };
  });
}
function sparkleBurst(x, y, n = 6) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'float mini'; s.textContent = rand(['✨', '⭐', '💖', '🌟']);
    s.style.left = x + 'px'; s.style.top = y + 'px';
    fx.appendChild(s);
    const a = Math.PI * 2 * i / n + Math.random() * .5, r = 30 + Math.random() * 25;
    s.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(1)`, opacity: 0 },
    ], { duration: 700, easing: 'ease-out' }).onfinish = () => s.remove();
  }
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = msg;
  $('#toast').appendChild(t);
  setTimeout(() => t.remove(), 3300);
}
let speechTimer = 0;
function say(msg, ms = 2600) {
  const sp = $('#speech'); sp.textContent = msg;
  clearTimeout(speechTimer);
  speechTimer = setTimeout(() => { sp.textContent = rand(IDLE_LINES()); }, ms);
}
const IDLE_LINES = () => [
  'きゅうりの国は、きょうもしあわせ♪', 'みんな、すくすく育ってね', 'ピクルスのいいにおい…',
  S.queue.length ? 'まほうをかけてあげましょう✨' : '住民さん、まだかな〜', 'きゅうりは丸ごとがいちばん♪',
  'のんびりいきましょうね', 'お水と肥料、わすれずにね',
];

/* ---------------- ゲームロジック ---------------- */
function newGirl() {
  return { name: rand(NAMES), hair: rand(HAIR), dress: rand(DRESS) };
}
function emptyPlots() { const r = []; S.plots.forEach((p, i) => { if (!p) r.push(i); }); return r; }

// 女神さまの魔法（手動のみ。自動化しない）
let casting = false;
function castMagic() {
  if (casting) return;
  if (!S.queue.length) { say('女神さまのそばに、まだ誰もいないみたい'); return; }
  const empties = emptyPlots();
  if (!empties.length) { say('畑がいっぱい！ 収穫してあげてね'); return; }
  const n = Math.min(wandPower(), S.queue.length, empties.length);
  casting = true;
  const girlsEls = $$('#queue .girl').slice(0, n);
  const targets = empties.slice(0, n);
  const girls = S.queue.splice(0, n);
  const goddess = $('#goddess');
  goddess.classList.remove('cast'); void goddess.offsetWidth; goddess.classList.add('cast');
  say(rand(['えいっ！ きゅうりになあれ♪', 'しあわせなきゅうりにな〜れ✨', 'くるくる〜っ、ぽんっ！', 'まほうのじかんですよ♪']));
  sound('magic');
  S.cast += n;
  const gpos = centerOf(goddess);
  sparkleBurst(gpos[0], gpos[1] - 30, 8);
  const proms = girls.map((g, i) => {
    const el = girlsEls[i];
    const from = el ? centerOf(el) : gpos;
    if (el) el.style.visibility = 'hidden';
    const idx = targets[i];
    const plotEl = $(`#field .plot[data-i="${idx}"]`);
    const to = plotEl ? centerOf(plotEl) : from;
    return flyTo(girlSVG(g), 'flygirl', from, to, 700 + i * 60, 720, .4).then(() => {
      S.plots[idx] = { name: g.name, hair: g.hair, growth: 0, water: 60, fert: 0, care: 0, total: 0 };
      sparkleBurst(to[0], to[1], 5);
      floatText(to[0], to[1] - 10, 'ぽんっ♪', 'plus', 30, 900);
      renderPlot(idx, true);
    });
  });
  // 状態はすぐ確定させる（演出の途中で畑が埋まらないように予約）
  targets.forEach((idx, i) => { S.plots[idx] = S.plots[idx] || { name: girls[i].name, hair: girls[i].hair, growth: 0, water: 60, fert: 0, care: 0, total: 0, pending: true }; });
  Promise.all(proms).then(() => { casting = false; renderQueue(); });
  renderQueue(true);
}

function applyTool(i, tool, visual = true) {
  const c = S.plots[i];
  if (!c || c.pending) return false;
  if (c.growth >= 100) { harvest(i, false); return true; }
  const el = plotEls[i];
  if (tool === 'water') {
    if (c.water >= 98) return false;
    c.water = 100;
    if (visual) { const [x, y] = centerOf(el); floatText(x, y - 8, '💧', 'mini', 26, 700); sound('water'); }
  } else {
    if (c.fert >= 98) return false;
    c.fert = 100;
    if (visual) { const [x, y] = centerOf(el); floatText(x, y - 8, '🌿', 'mini', 26, 700); sound('fert'); }
  }
  if (visual && el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  renderPlot(i);
  return true;
}

function harvest(i, auto, visual = true) {
  const c = S.plots[i];
  if (!c || c.growth < 100) return;
  const ratio = c.total > 0 ? c.care / c.total : 1;
  let stars = ratio >= 0.85 ? 3 : ratio >= 0.55 ? 2 : 1;
  if (Math.random() < lampChance()) stars++;
  stars = clamp(stars, 1, 4);
  S.basket.push({ n: c.name, c: c.hair, s: stars });
  S.plots[i] = null;
  S.harvested++;
  S.recent.unshift(c.name); S.recent.length = Math.min(S.recent.length, 30);
  if (visual) {
    const el = plotEls[i];
    if (el && (!auto || S.anim)) {
      const [x, y] = centerOf(el);
      floatText(x, y - 10, stars >= 4 ? 'しあわせ！✨' : 'しあわせ！', 'shiawase' + (stars >= 4 ? ' big' : ''), 60, 1600);
      if (!auto) sparkleBurst(x, y, 4);
    }
    if (!auto) sound('harvest');
    renderPlot(i);
    renderBasket();
  }
}

function putInPot(auto, visual = true) {
  if (!S.basket.length) return 0;
  const k = S.basket.shift();
  let gain = BASE_HAPPY * STAR_MULT[k.s] * potMult() * castleMult();
  const crit = Math.random() < fountainChance();
  if (crit) { gain *= 3; S.crits++; }
  S.happy += gain;
  S.best = Math.max(S.best, gain);
  S.potted++;
  S.pot.push({ c: k.c, t: 0 });
  potDirty = true;
  if (visual) {
    const pot = $('#pot');
    const [px, py] = centerOf(pot);
    const done = () => {
      floatText(px, py - 20, (crit ? 'だいしあわせ！ ' : '') + '+' + fmt(gain) + ' ♥', 'plus' + (crit ? ' crit' : ''), 45, 1200);
      pot.classList.remove('splash'); void pot.offsetWidth; pot.classList.add('splash');
      if (crit) { sparkleBurst(px, py, 8); sound('crit'); } else if (!auto) sound('pot');
    };
    if (!auto || S.anim) {
      const from = centerOf($('#basket-view'));
      flyTo(cukeSVG(k.c), 'fly', from, [px, py - 10], 520, 200, .7).then(done);
    } else done();
    renderBasket();
  }
  return gain;
}

function buildFacility(id) {
  const f = FAC_BY_ID[id];
  if (!facAvailable(f)) return;
  S.fac[id] = lv(id) + 1;
  if (id === 'field') { while (S.plots.length < plotCount()) S.plots.push(null); buildField(); }
  sound('build');
  toast(`${f.icon} ${f.name} が Lv${S.fac[id]} になりました！`);
  say(rand(['まあ、すてき！', 'みんながもっとしあわせに♪', '国がにぎやかになってきたわ']));
  const [x, y] = centerOf($('#btn-fac'));
  sparkleBurst(x, y, 10);
  renderFacilities();
  renderQueue();
  save();
}

function autoPick(list, key) {
  let best = -1, bv = Infinity;
  list.forEach((c, i) => { if (c && !c.pending && c.growth < 100 && c[key] < 45 && c[key] < bv) { bv = c[key]; best = i; } });
  return best;
}

/* 1ステップぶん世界を進める。visual=false はとじている間の計算用 */
function step(dt, visual) {
  S.playTime += visual ? dt : 0;
  // 住民が女神さまのそばに集まってくる
  const cap = queueCap();
  if (S.queue.length < cap) {
    S.spawnT += dt;
    const iv = spawnInterval();
    let added = false;
    while (S.spawnT >= iv && S.queue.length < cap) { S.spawnT -= iv; S.queue.push(newGirl()); added = true; }
    if (added && visual) renderQueue();
  } else S.spawnT = 0;

  // 成長
  const dm = decayMult(), gm = growMult();
  for (let i = 0; i < S.plots.length; i++) {
    const c = S.plots[i];
    if (!c || c.pending || c.growth >= 100) continue;
    c.water = Math.max(0, c.water - 2.4 * dm * dt);
    c.fert = Math.max(0, c.fert - 1.3 * dm * dt);
    if (c.water > 0) c.growth = Math.min(100, c.growth + 2.2 * gm * (c.fert > 0 ? 1 : 0.35) * dt);
    c.total += dt;
    if (c.water > 0 && c.fert > 0) c.care += dt;
  }

  // 自動施設
  const auto = (key, rate, fn) => {
    if (!rate) return;
    S.acc[key] += rate * dt;
    while (S.acc[key] >= 1) {
      if (!fn()) { S.acc[key] = Math.min(S.acc[key], 1); break; }
      S.acc[key] -= 1;
    }
  };
  auto('cloud', rateCloud(), () => {
    const i = autoPick(S.plots, 'water'); if (i < 0) return false;
    S.plots[i].water = 100;
    if (visual && S.anim) { const [x, y] = centerOf(plotEls[i]); floatText(x, y - 14, '☁️💧', 'mini', 20, 800); }
    return true;
  });
  auto('mush', rateMush(), () => {
    const i = autoPick(S.plots, 'fert'); if (i < 0) return false;
    S.plots[i].fert = 100;
    if (visual && S.anim) { const [x, y] = centerOf(plotEls[i]); floatText(x, y - 14, '🍄🌿', 'mini', 20, 800); }
    return true;
  });
  auto('rabbit', rateRabbit(), () => {
    const i = S.plots.findIndex(c => c && !c.pending && c.growth >= 100); if (i < 0) return false;
    harvest(i, true, visual);
    if (visual && S.anim) { const [x, y] = centerOf(plotEls[i]); floatText(x, y + 10, '🐰', 'mini', 16, 700); }
    return true;
  });
  auto('butterfly', rateButterfly(), () => {
    if (!S.basket.length) return false;
    putInPot(true, visual);
    return true;
  });

  // 鍋のなかでピクルスができる
  let changed = false;
  for (const p of S.pot) { const before = p.t > .5; p.t += dt / PICKLE_TIME; if ((p.t > .5) !== before) changed = true; }
  const doneN = S.pot.filter(p => p.t >= 1).length;
  if (doneN) { S.pickles += doneN; S.pot = S.pot.filter(p => p.t < 1); changed = true; }
  if (changed && visual) potDirty = true;
}

/* ---------------- 描画 ---------------- */
let plotEls = [];
let potDirty = true;
function buildField() {
  const field = $('#field');
  const n = S.plots.length;
  const cols = n <= 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : n <= 25 ? 5 : 6;
  field.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  field.style.gridTemplateRows = `repeat(${Math.ceil(n / cols)}, 1fr)`;
  field.innerHTML = '';
  plotEls = S.plots.map((_, i) => {
    const d = document.createElement('div');
    d.className = 'plot' + (n > 16 ? ' small' : '');
    d.dataset.i = i;
    d.innerHTML = `<div class="art"></div><span class="pname"></span><span class="warn"></span>
      <div class="pbars"><div class="pbar w"><i></i></div><div class="pbar f"><i></i></div></div>
      <div class="pbars"><div class="pbar g"><i></i></div></div>`;
    d._key = '';
    field.appendChild(d);
    return d;
  });
  S.plots.forEach((_, i) => renderPlot(i, true));
}
function renderPlot(i, force) {
  const el = plotEls[i]; if (!el) return;
  const c = S.plots[i];
  if (!c || c.pending) {
    if (el._key !== 'empty' || force) {
      el._key = 'empty';
      el.className = 'plot empty' + (S.plots.length > 16 ? ' small' : '');
      el.querySelector('.art').innerHTML = '';
      el.querySelector('.pname').textContent = '';
      el.querySelector('.warn').textContent = '';
      el.querySelectorAll('.pbar i').forEach(b => b.style.width = '0');
    }
    return;
  }
  const st = stageOf(c);
  const thirsty = c.water <= 0;
  const key = st + ':' + thirsty + ':' + c.hair;
  if (key !== el._key || force) {
    el._key = key;
    el.className = 'plot' + (st === 4 ? ' ready' : '') + (S.plots.length > 16 ? ' small' : '');
    el.querySelector('.art').innerHTML = plotArt(c);
    el.querySelector('.pname').textContent = c.name;
  }
  const bars = el.querySelectorAll('.pbar i');
  bars[0].style.width = c.water + '%';
  bars[1].style.width = c.fert + '%';
  bars[2].style.width = c.growth + '%';
  el.querySelector('.warn').textContent = st === 4 ? '✨' : thirsty ? '💧' : c.fert <= 0 ? '🌿' : '';
}
function renderQueue(skipAnim) {
  const q = $('#queue');
  const have = q.children.length;
  // 余分なものは消し、足りないぶんは追加
  const els = Array.from(q.children);
  els.forEach((e, i) => { if (i >= S.queue.length || e.dataset.name !== S.queue[i].name + S.queue[i].hair) e.remove(); });
  const cur = Array.from(q.children);
  S.queue.forEach((g, i) => {
    if (cur[i] && cur[i].dataset.name === g.name + g.hair) return;
    const d = document.createElement('div');
    d.className = 'girl' + (skipAnim ? '' : ' enter');
    d.dataset.name = g.name + g.hair;
    d.style.animationDelay = skipAnim ? `${(i * .23) % 1.6}s` : `0s, ${.5 + (i * .23) % 1.6}s`;
    d.innerHTML = girlSVG(g) + `<span class="gname">${g.name}</span>`;
    q.appendChild(d);
  });
  void have;
  $('#queue-count').textContent = `${S.queue.length}/${queueCap()}`;
  $('#btn-magic').textContent = wandPower() > 1 ? `✨ まほうをかける（${wandPower()}人まで）✨` : '✨ まほうをかける ✨';
}
let basketKey = '';
function renderBasket() {
  $('#basket-count').textContent = S.basket.length;
  const shown = S.basket.slice(0, 24);
  const key = shown.map(k => k.c + k.s).join() + S.basket.length;
  if (key !== basketKey) {
    basketKey = key;
    $('#basket-view').innerHTML = shown.map(k => cukeSVG(k.c, { face: true })).join('') +
      (S.basket.length > 24 ? `<span style="font-size:11px;font-weight:800">…ほか${S.basket.length - 24}本</span>` : '');
  }
  $('#btn-pot1').disabled = !S.basket.length;
  $('#btn-potall').disabled = S.basket.length < 2;
}
function renderPot() {
  $('#pot').innerHTML = potSVG();
  $('#pickles').textContent = fmt(S.pickles);
  $('#pot-count').textContent = S.pot.length ? `(つけこみ中 ${S.pot.length})` : '';
  potDirty = false;
}
let lastAvail = -1;
function renderMeter() {
  if ($('#queue').children.length !== S.queue.length && !casting) renderQueue(true);
  $('#happy').textContent = fmt(S.happy);
  $('#title-name').textContent = titleOf(S.happy);
  const avail = FAC.filter(facAvailable).length;
  const fill = $('#meter-fill'), txt = $('#meter-text');
  if (avail) {
    fill.style.width = '100%'; fill.classList.add('full');
    txt.textContent = `施設をたてられるよ！（${avail}）🏰をタップ`;
  } else {
    const nexts = FAC.filter(f => !facMaxed(f)).map(f => ({ f, t: facNext(f) })).sort((a, b) => a.t - b.t);
    fill.classList.remove('full');
    if (nexts.length) {
      const { f, t } = nexts[0];
      const prev = lv(f.id) ? threshold(f, lv(f.id) - 1) : 0;
      const p = clamp((S.happy - prev) / (t - prev), 0, 1);
      fill.style.width = (p * 100) + '%';
      txt.textContent = `${f.icon} ${f.name}${lv(f.id) ? ' Lv' + (lv(f.id) + 1) : ''} まで あと ${fmt(t - S.happy)}`;
    }
  }
  const badge = $('#fac-badge');
  badge.hidden = !avail; badge.textContent = avail;
  if (avail > lastAvail && lastAvail >= 0) { toast('🏰 しあわせがたまって、施設をたてられるようになりました！'); }
  if (avail !== lastAvail) { lastAvail = avail; if (!$('#drawer').hidden) renderFacilities(); }
}
function renderFacilities() {
  const list = $('#fac-list');
  // まだ遠い施設は「？？？」で隠し、ひとつ先まで見せる
  let shownLocked = 0;
  list.innerHTML = FAC.map(f => {
    const l = lv(f.id), maxed = facMaxed(f), next = facNext(f), can = facAvailable(f);
    const locked = l === 0 && !can;
    if (locked) { shownLocked++; if (shownLocked > 2) return `<div class="fac locked"><div class="fac-icon">❔</div><div class="fac-main"><div class="fac-name">？？？</div><div class="fac-desc">しあわせ ${fmt(next)} で解放</div></div></div>`; }
    const prev = l ? threshold(f, l - 1) : 0;
    const p = maxed ? 1 : clamp((S.happy - prev) / (next - prev), 0, 1);
    const btn = maxed ? `<button class="fac-btn max" disabled>MAX</button>`
      : can ? `<button class="fac-btn on" data-build="${f.id}">${l ? 'レベル<br>アップ！' : 'たてる！'}</button>`
      : `<button class="fac-btn" disabled>あと<br>${fmt(next - S.happy)}</button>`;
    return `<div class="fac ${can ? 'can' : ''} ${locked ? 'locked' : ''}">
      <div class="fac-icon">${f.icon}</div>
      <div class="fac-main">
        <div class="fac-name">${f.name}<small>${l ? 'Lv' + l : '未建設'}</small></div>
        <div class="fac-desc">${f.desc}</div>
        <div class="fac-eff">${l ? 'いま：' + f.eff(l) : ''}${maxed ? '' : `${l ? '<br>' : ''}つぎ：${f.eff(l + 1)}（累計 ${fmt(next)}）`}</div>
        ${maxed ? '' : `<div class="fac-prog"><i style="width:${p * 100}%"></i></div>`}
      </div>${btn}</div>`;
  }).join('');
}
function renderStats() {
  const rows = [
    ['しあわせ累計', fmt(S.happy)], ['称号', titleOf(S.happy)],
    ['魔法をかけた住民', fmt(S.cast) + '人'], ['収穫したきゅうり', fmt(S.harvested) + '本'],
    ['大鍋に入れたきゅうり', fmt(S.potted) + '本'], ['できたピクルス', fmt(S.pickles) + '本'],
    ['だいしあわせ', fmt(S.crits) + '回'], ['1本の最高しあわせ', fmt(S.best)],
    ['建てた施設レベル合計', FAC.reduce((a, f) => a + lv(f.id), 0)],
    ['あそんだ時間', Math.floor(S.playTime / 3600) + '時間' + Math.floor(S.playTime % 3600 / 60) + '分'],
  ];
  const nextTitle = TITLES.find(t => t[0] > S.happy);
  $('#stats').innerHTML = rows.map(r => `<div class="row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('') +
    (nextTitle ? `<p class="note" style="margin-top:10px">つぎの称号「${nextTitle[1]}」まで あと ${fmt(nextTitle[0] - S.happy)}</p>` : '') +
    `<h3>🥒 さいきん収穫した子たち</h3><div class="names">${S.recent.length ? S.recent.join('・') : 'まだいません'}</div>
     <h3>⭐ きゅうりのランク</h3><div class="names">水と肥料がたっぷりの時間が長いほど★がふえます。★1 ×1／★2 ×1.6／★3 ×2.4／★4（三日月ランプ）×3.6</div>`;
}

/* ---------------- 入力 ---------------- */
function setupInput() {
  $('#btn-magic').addEventListener('click', castMagic);
  $('#goddess').addEventListener('click', castMagic);
  $$('.tool').forEach(b => b.addEventListener('click', () => {
    S.tool = b.dataset.tool;
    $$('.tool').forEach(x => x.classList.toggle('active', x === b));
  }));
  // 畑：タップ＆なぞり
  const field = $('#field');
  let painting = false, lastIdx = -1;
  const plotAt = (x, y) => { const el = document.elementFromPoint(x, y); const p = el && el.closest('.plot'); return p ? +p.dataset.i : -1; };
  const touch = i => {
    if (i < 0 || i === lastIdx) return;
    lastIdx = i;
    const c = S.plots[i];
    if (!c) { say('あき地には、まほうで住民さんを招いてね'); return; }
    applyTool(i, S.tool);
  };
  field.addEventListener('pointerdown', e => { painting = true; lastIdx = -1; touch(plotAt(e.clientX, e.clientY)); });
  window.addEventListener('pointermove', e => { if (painting) touch(plotAt(e.clientX, e.clientY)); });
  window.addEventListener('pointerup', () => { painting = false; });
  window.addEventListener('pointercancel', () => { painting = false; });

  $('#btn-pot1').addEventListener('click', () => putInPot(false));
  $('#pot').addEventListener('click', () => { if (S.basket.length) putInPot(false); else say('かごにきゅうりがないみたい'); });
  $('#btn-potall').addEventListener('click', () => {
    const n = S.basket.length; let total = 0;
    for (let i = 0; i < n; i++) total += putInPot(true, false);
    if (!n) return;
    const [px, py] = centerOf($('#pot'));
    floatText(px, py - 20, `+${fmt(total)} ♥`, 'plus', 50, 1400);
    sparkleBurst(px, py, 8); sound('pot');
    renderBasket(); potDirty = true;
    say(`${n}本まるごと、おいしいピクルスになあれ♪`);
  });

  $('#btn-fac').addEventListener('click', () => openDrawer('fac'));
  $('#btn-menu').addEventListener('click', () => openDrawer('settings'));
  $('#drawer-close').addEventListener('click', closeDrawer);
  $('#drawer').addEventListener('click', e => { if (e.target.id === 'drawer') closeDrawer(); });
  $$('.tab').forEach(t => t.addEventListener('click', () => openDrawer(t.dataset.tab)));
  $('#fac-list').addEventListener('click', e => { const b = e.target.closest('[data-build]'); if (b) buildFacility(b.dataset.build); });
  $('#opt-sound').addEventListener('change', e => { S.sound = e.target.checked; save(); });
  $('#opt-anim').addEventListener('change', e => { S.anim = e.target.checked; save(); });
  $('#btn-howto').addEventListener('click', () => { closeDrawer(); showHowto(); });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('ほんとうに さいしょから やりなおしますか？\n（しあわせメーターや施設がすべて消えます）')) return;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ }
    S = defaultState(); S.seen = true;
    closeDrawer(); initView(); save();
  });
  $('#modal-ok').addEventListener('click', () => { $('#modal').hidden = true; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);
}
function openDrawer(tab) {
  $('#drawer').hidden = false;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $$('.tab-page').forEach(p => p.hidden = p.dataset.page !== tab);
  if (tab === 'fac') renderFacilities();
  if (tab === 'stats') renderStats();
  $('#opt-sound').checked = S.sound; $('#opt-anim').checked = S.anim;
}
function closeDrawer() { $('#drawer').hidden = true; }
function modal(html, ok = 'はーい♪') {
  $('#modal-body').innerHTML = html; $('#modal-ok').textContent = ok; $('#modal').hidden = false;
}
function showHowto() {
  modal(`<h2>きゅうりの国の女神さま</h2>
  ここは、きゅうりと虹とお星さまの国。<br>女神さまは国の女の子たちに魔法をかけて、しあわせなきゅうりに変えてあげます♪
  <ul>
    <li>🔔 女神さまのそばに住民の女の子が集まってきます。</li>
    <li>✨ <b>まほうをかける</b>で、女の子が畑のきゅうりに。（魔法はいつも女神さまが自分でかけます）</li>
    <li>💧🌿 じょうろ・ひりょうを選んで畑をタップ（なぞってもOK）。お水がないと育ちません。肥料があるとぐんぐん育ちます。</li>
    <li>✨ 育ったきゅうりをタップで収穫。「しあわせ！」</li>
    <li>🍲 かごのきゅうりを<b>丸ごと</b>大鍋へ。ピクルスになって、しあわせメーターがたまります。</li>
    <li>🏰 しあわせの<b>累計</b>で施設をたてられます。メーターは減りません。自動化して、のんびり続けましょう。</li>
  </ul>`, 'はじめる♪');
}

/* ---------------- ループ ---------------- */
function catchUp(sec) {
  sec = Math.min(sec, OFFLINE_MAX);
  if (sec < 5) return null;
  const before = { h: S.happy, hv: S.harvested, pk: S.pickles };
  let t = sec;
  while (t > 0) { const d = Math.min(1, t); step(d, false); t -= d; }
  return { sec, happy: S.happy - before.h, harvested: S.harvested - before.hv, pickles: S.pickles - before.pk };
}
function initView() {
  buildField(); renderQueue(true); renderBasket(); renderPot(); lastAvail = -1; renderMeter();
  $$('.tool').forEach(x => x.classList.toggle('active', x.dataset.tool === S.tool));
}
let lastT = performance.now(), saveT = 0, slowT = 0, idleT = 0;
function loop(now) {
  let dt = (now - lastT) / 1000; lastT = now;
  if (dt > 3) {
    // タブを離れていたぶん
    const r = catchUp(dt);
    initView();
    if (r && r.happy > 0) toast(`おかえりなさい♪ 留守のあいだに しあわせ +${fmt(r.happy)}`);
    dt = 0;
  }
  dt = Math.min(dt, 0.25);
  step(dt, true);
  for (let i = 0; i < S.plots.length; i++) renderPlot(i);
  slowT += dt; saveT += dt; idleT += dt;
  if (slowT > 0.2) { slowT = 0; renderMeter(); if (potDirty) renderPot(); }
  if (saveT > 5) { saveT = 0; save(); }
  if (idleT > 14) { idleT = 0; if (Math.random() < .5) say(rand(IDLE_LINES())); }
  requestAnimationFrame(loop);
}

function start() {
  const had = load();
  initView();
  setupInput();
  if (!had || !S.seen) { S.seen = true; showHowto(); }
  else {
    const r = catchUp((Date.now() - S.lastSave) / 1000);
    initView();
    if (r && (r.happy > 0 || r.harvested > 0)) {
      const h = Math.floor(r.sec / 3600), m = Math.floor(r.sec % 3600 / 60);
      modal(`<h2>おかえりなさい♪</h2>留守のあいだ（${h ? h + '時間' : ''}${m}分）も、国のみんながはたらいてくれました。
        <ul><li>収穫したきゅうり：<b>${fmt(r.harvested)}本</b></li><li>しあわせ：<b>+${fmt(r.happy)}</b></li><li>できたピクルス：<b>${fmt(r.pickles)}本</b></li></ul>
        住民さんたちが女神さまの魔法を待っていますよ✨`);
    } else if (S.queue.length) say('おかえりなさい♪ みんな待ってたのよ');
  }
  save();
  requestAnimationFrame(t => { lastT = t; requestAnimationFrame(loop); });
}
start();
