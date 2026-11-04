/* Rabbit Zapper — mountable kit, converted from "Rabbit Zapper.html" for the Duck Arcade.
 *
 *   var game = RabbitZapper.mount({
 *     canvas,              // <canvas> to draw on (2:1)
 *     padLeft, padRight,   // optional buttons: zap the nearest monster on that side
 *     live,                // optional aria-live element for the picnic dialogue
 *     base: 'rabbit-zapper/', sound: true,
 *     onEvent(name, data)  // 'win' | 'over', data { score }
 *   });
 *   game.setSound(on); game.destroy();
 *
 * Keys (window): arrows / A / D zap a side, Space / Enter start or play again.
 */
(function (global) {
  'use strict';
  function mount(opts) {
  const base = opts.base == null ? 'rabbit-zapper/' : opts.base;
  const emit = (name, data) => { try { opts.onEvent && opts.onEvent(name, data); } catch (e) { /* host's problem */ } };
  let soundOn = opts.sound !== false, alive = true, raf = 0;

  const VW = 1024, VH = 512, SC = 1.5, DPR = 2;
  const TX = 512 - 120 * SC, TY = 478 - 282 * SC;   // her feet at y=478, body centre at x=512
  const HER_X = 512, GROUND = 486;
  const NEED = 4;                // monsters to zap before the boss
  const BOSS_HP = 6;
  const cv = opts.canvas;
  const ctx = cv.getContext('2d');
  cv.width = VW * DPR; cv.height = VH * DPR;

  // ---------- images ----------
  const TL = 672;
  const tile = new Image(); let tileOK = false;
  tile.onload = () => { tileOK = true; };
  tile.src = base + 'background.jpg';

  let SW = 270, SH = 225;
  let monBase = null, bossBase = null, tintW = null, tintR = null, meltFrames = [], spriteOK = false;
  const NM = 16;
  const mon = new Image();
  mon.onload = () => { try { buildSprites(mon); spriteOK = true; } catch (e) { spriteOK = false; } };
  mon.src = base + 'monster.png';

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function tinted(base, col, amt) {
    const c = mk(base.width, base.height), x = c.getContext('2d');
    x.drawImage(base, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = `rgba(${col},${amt})`; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  const noiseK = c => 0.6 * Math.sin(c * 0.034 + 1.3) + 0.4 * Math.sin(c * 0.07 + 4.1);
  const smooth = t => t * t * (3 - 2 * t);

  function buildSprites(img) {
    SW = img.naturalWidth || img.width; SH = img.naturalHeight || img.height;
    monBase = mk(SW, SH); monBase.getContext('2d').drawImage(img, 0, 0);
    bossBase = tinted(monBase, '150,16,44', 0.4);
    tintW = tinted(monBase, '255,240,235', 0.7);
    tintR = tinted(monBase, '255,70,80', 0.55);
    // melt frames: columns sink at different rates, arm tips first, body last
    const sx = monBase.getContext('2d');
    const src = sx.getImageData(0, 0, SW, SH).data;
    const pm = new Float32Array(SW * SH * 4);
    for (let i = 0; i < SW * SH; i++) {
      const a = src[i * 4 + 3] / 255;
      pm[i * 4] = src[i * 4] * a; pm[i * 4 + 1] = src[i * 4 + 1] * a; pm[i * 4 + 2] = src[i * 4 + 2] * a; pm[i * 4 + 3] = src[i * 4 + 3];
    }
    const yb = SH - 1;
    meltFrames = [];
    for (let k = 0; k < NM; k++) {
      const m = k / (NM - 1);
      const c = mk(SW, SH), x = c.getContext('2d');
      const out = x.createImageData(SW, SH), od = out.data;
      for (let col = 0; col < SW; col++) {
        const dist = Math.abs(col - SW * 0.48) / (SW * 0.52);
        let prog = m * (1 + 1.3 * Math.pow(dist, 1.5)) + 0.22 * noiseK(col) * Math.sin(Math.PI * Math.min(1, m));
        prog = smooth(Math.max(0, Math.min(1, prog)));
        const s = 1 - 0.955 * prog;
        for (let r = 0; r < SH; r++) {
          const sy = yb - (yb - r) / s;
          if (sy < 0) continue;
          const y0 = Math.floor(sy), fy = sy - y0, y1 = Math.min(y0 + 1, yb);
          const i0 = (y0 * SW + col) * 4, i1 = (y1 * SW + col) * 4;
          const a = pm[i0 + 3] * (1 - fy) + pm[i1 + 3] * fy;
          if (a < 1) continue;
          const o = (r * SW + col) * 4, an = a / 255;
          od[o] = (pm[i0] * (1 - fy) + pm[i1] * fy) / an;
          od[o + 1] = (pm[i0 + 1] * (1 - fy) + pm[i1 + 1] * fy) / an;
          od[o + 2] = (pm[i0 + 2] * (1 - fy) + pm[i1 + 2] * fy) / an;
          od[o + 3] = a;
        }
      }
      x.putImageData(out, 0, 0);
      meltFrames.push(c);
    }
  }

  // ---------- background ----------
  let bgx = 0;
  const SCROLL = 78;               // logical px per second

  // ---------- helpers ----------
  const C = {
    navy: [28, 52, 68], navyD: [20, 40, 54], red: [200, 52, 52], redD: [160, 38, 42],
    boot: [214, 60, 56], hair: [92, 62, 48], skin: [222, 190, 170],
    pink: [238, 170, 172], pinkD: [214, 140, 146], eye: [40, 30, 34], umb: [70, 50, 46]
  };
  const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const rand = (a, b) => a + Math.random() * (b - a);

  function poly(pts, fill) {
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath(); ctx.fillStyle = Array.isArray(fill) ? rgb(fill) : fill; ctx.fill();
  }
  function ell(cx, cy, rx, ry, fill) {
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = Array.isArray(fill) ? rgb(fill) : fill; ctx.fill();
  }
  function rotEll(cx, cy, rx, ry, deg, fill) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-deg * Math.PI / 180);
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgb(fill); ctx.fill(); ctx.restore();
  }
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }
  function heart(x, y, s, fill) {
    ctx.beginPath();
    ctx.moveTo(x, y + s);
    ctx.bezierCurveTo(x - s * 1.3, y - s * 0.2, x - s * 0.6, y - s * 1.2, x, y - s * 0.4);
    ctx.bezierCurveTo(x + s * 0.6, y - s * 1.2, x + s * 1.3, y - s * 0.2, x, y + s);
    ctx.fillStyle = fill; ctx.fill();
  }

  // ---------- the woman and the rabbit ----------
  function leg(hx, hy, ph, back) {
    const sw = Math.sin(ph), lift = Math.max(0, Math.cos(ph)) * 7;
    const ax = hx + sw * 20, ay = 276 - lift;
    poly([[hx - 4, hy], [hx + 4, hy], [ax + 3, ay - 12], [ax - 3, ay - 12]], back ? C.navyD : C.navy);
    poly([[ax - 4, ay - 14], [ax + 4, ay - 14], [ax + 5, ay - 2], [ax + 12, ay + 2], [ax + 12, ay + 6], [ax - 5, ay + 6]],
      back ? C.redD : C.boot);
  }

  // p: 0 = rabbit at rest (centred), 1 = fully turned. dr: +1 faces right, -1 faces left.
  function drawWoman(t, p, dr) {
    const bob = -Math.abs(Math.sin(t)) * 3, sway = Math.sin(t) * 1.5, oy = bob;
    ctx.save(); ctx.translate(TX, TY); ctx.scale(SC, SC);
    const hipY = 205 + bob;
    leg(112, hipY, t + Math.PI, true);
    leg(128, hipY, t, false);

    poly([[106, 104 + oy], [130, 104 + oy], [150, 208 + oy], [90, 208 + oy]], C.navy);
    poly([[120, 104 + oy], [130, 104 + oy], [150, 208 + oy], [128, 208 + oy]], C.navyD);

    const ux = 126 + sway * 0.5;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = rgb(C.umb); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ux, 48 + oy); ctx.lineTo(ux, 112 + oy); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(ux + 4, 114 + oy, 5, 6, 0, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(ux, 48 + oy, 66, 28, 0, Math.PI, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = rgb(C.red); ctx.fill();
    for (let k = 0; k < 5; k++) {
      const cx = ux - 52.8 + k * 26.4;
      ctx.beginPath(); ctx.ellipse(cx, 50 + oy, 13.2, 8, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
    }
    ctx.fillRect(ux - 66, 48 + oy, 132, 2);
    ctx.strokeStyle = rgb(C.redD); ctx.lineWidth = 1;
    [-35, 0, 35].forEach(k => { ctx.beginPath(); ctx.moveTo(ux, 22 + oy); ctx.lineTo(ux + k, 49 + oy); ctx.stroke(); });

    ell(117, 90 + oy, 11, 12, C.skin);
    ell(115, 86 + oy, 13, 13, C.hair);
    poly([[103, 88 + oy], [110, 88 + oy], [110, 106 + oy], [102, 106 + oy]], C.hair);

    const hop = Math.sin(Math.PI * p) * 3;
    const rx = 120 + dr * 18 * p, ry = 134 + oy - hop;
    const hxh = rx + dr * 3 * p, hyh = ry - 17;
    const hx = rx - dr * 7 * p;
    poly([[110, 108 + oy], [122, 108 + oy], [hx + 5, 140 + oy - hop], [hx - 4, 144 + oy - hop]], C.navyD);
    rotEll(rx + dr * lerp(-4, -1, p), ry - 28, 3.2, 11, dr * lerp(-7, -12, p), C.pink);
    rotEll(rx + dr * lerp(4, 8, p), ry - 27, 3.4, 12, dr * lerp(7, 10, p), lerpC(C.pink, C.pinkD, p));
    ell(rx, ry, lerp(10, 9, p), 15, C.pink);
    ell(hxh, hyh, lerp(8.5, 8, p), 7, C.pink);
    ell(hxh + dr * lerp(3.5, 4, p), hyh - 1, 1.8, 1.8, C.eye);
    const r2 = 1.8 * (1 - p);
    if (r2 > 0.2) ell(hxh + dr * lerp(-3.5, 4, p), hyh - 1, r2, r2, C.eye);
    ell(hxh + dr * lerp(0, 8, p), hyh + lerp(2.5, 2, p), 1.4, 1.1, C.pinkD);

    ell(hx, 142 + oy - hop, 4, 4, C.skin);
    poly([[124, 108 + oy], [131, 108 + oy], [ux + 2, 114 + oy], [ux - 4, 118 + oy]], C.navy);
    ell(ux, 112 + oy, 3.5, 3.5, C.skin);
    ctx.restore();
  }

  // where the laser leaves the rabbit's eye, in stage coordinates
  function eyePos(t, p, dr) {
    const bob = -Math.abs(Math.sin(t)) * 3, hop = Math.sin(Math.PI * p) * 3;
    const rx = 120 + dr * 18 * p, hxh = rx + dr * 3 * p;
    const ex = hxh + dr * lerp(3.5, 4, p);
    const ey = 134 + bob - hop - 17 - 1;
    return { x: TX + ex * SC, y: TY + ey * SC };
  }

  // ---------- monsters ----------
  const FL = 0.32, MELT = 1.0, PUD_END = 2.1;
  const dims = m => ({ w: SW * m.scale, h: SH * m.scale });
  const headOf = m => {
    const { w, h } = dims(m);
    return { x: m.x + (m.side < 0 ? 1 : -1) * 0.22 * w, y: GROUND - 0.70 * h };
  };

  function drawPuddle(m) {
    const t = m.t, sc = m.scale;
    let size;
    if (t < 0.1) return;
    if (t <= FL + MELT) size = Math.pow(ease((t - 0.1) / (FL + MELT - 0.1)), 0.8);
    else size = 1 - ease((t - FL - MELT) / (PUD_END - FL - MELT));
    if (size <= 0.01) return;
    const hw = 84 * sc * size, hh = hw * 0.16, cx = m.x, cy = GROUND - 2;
    ctx.save();
    ctx.fillStyle = 'rgba(18,22,26,0.94)';
    ctx.beginPath(); ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2); ctx.fill();
    [[-0.62, 0.8, 0.42], [0.55, 0.9, 0.45], [-0.2, 1.15, 0.38], [0.25, -0.1, 0.5], [0.85, 0.55, 0.22]].forEach(([dx, ry, rx]) => {
      ctx.beginPath(); ctx.ellipse(cx + dx * hw, cy - hh * 0.1 * ry, rx * hw, hh * 0.85 * Math.min(1, Math.abs(ry) + 0.3), 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = 'rgba(70,84,94,0.35)';
    ctx.beginPath(); ctx.ellipse(cx - hw * 0.18, cy - hh * 0.3, hw * 0.28, hh * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawMonster(m, time) {
    if (!spriteOK) return;
    const { w, h } = dims(m);
    const flip = m.side < 0 ? -1 : 1;         // sprite faces left; flip it for monsters from the left
    let img = m.kind === 'boss' ? bossBase : monBase;
    let ww = w, alpha = 1, jx = 0, jy = 0, bob = 0, ang = 0;
    if (m.st === 'walk') {
      const ph = time * 4.2 + m.ph;
      bob = -Math.abs(Math.sin(ph)) * 6 * m.scale / 1.1;
      ang = Math.sin(ph) * 0.028;
      if (m.flashT > 0) {
        img = (Math.floor(m.flashT / 0.06) % 2 === 0) ? tintW : tintR;
        jx = rand(-4, 4); jy = rand(-3, 3);
      }
    } else {
      if (m.t < FL) {
        img = (Math.floor(m.t / 0.08) % 2 === 0) ? tintW : tintR;
        jx = rand(-7, 7); jy = rand(-5, 5);
      } else {
        const mm = Math.min(1, (m.t - FL) / MELT);
        img = meltFrames[Math.round(mm * (NM - 1))];
        ww = w * (1 + 0.3 * mm);
        alpha = 1 - ease((mm - 0.5) / 0.5);
      }
    }
    if (m.st === 'dying') drawPuddle(m);
    if (alpha > 0.01 && img) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(m.x + jx, GROUND + 4 + jy + bob);
      ctx.rotate(ang * flip);
      ctx.scale(flip, 1);
      ctx.drawImage(img, -ww / 2, -h, ww, h);
      ctx.restore();
    }
    if (m.st === 'dying') {
      ctx.save(); ctx.fillStyle = '#14181c';
      for (const d of m.drops) {
        const tf = m.t - d.st;
        if (tf < 0) continue;
        const y = GROUND - h * (1 - d.y0) + 0.5 * 1500 * tf * tf;
        if (y >= GROUND - 2) continue;
        const x = m.x + d.dx * w;
        ctx.beginPath(); ctx.ellipse(x, y, d.r * 0.7, d.r * 1.5, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    if (m.targeted && m.st === 'walk' && m.kind !== 'boss') {
      ctx.save();
      ctx.translate(m.x, GROUND - h * 0.45);
      ctx.rotate(time * 2);
      ctx.setLineDash([11, 11]);
      ctx.strokeStyle = 'rgba(255,61,79,0.95)'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(w, h) * 0.5 + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  // ---------- game state ----------
  let state = 'title';          // title | play | over | win
  let phase = 'wave';           // wave | gap | boss
  let kills = 0, score = 0, lives = 3, overT = 0, gapT = 0, bannerT = 0, overMsg = '';
  let monsters = [], sparks = [], lasers = [], queue = [];
  let daisies = [], daisyT = 0, lastLine = -1;
  let spawnT = 1.0, shake = 0, hurtFlash = 0, lastSide = 0;
  let walkT = 0, clock = 0, steps = 1;
  const rabbit = { p: 0, dr: 1, mode: 'idle', timer: 0, fired: false, target: null };

  function start() {
    state = 'play'; phase = 'wave'; kills = 0; score = 0; lives = 3; monsters = []; sparks = []; lasers = []; queue = [];
    daisies = []; daisyT = 0; lastLine = -1;
    spawnT = 0.8; shake = 0; hurtFlash = 0; bannerT = 0; lastSide = 0;
    rabbit.p = 0; rabbit.mode = 'idle'; rabbit.target = null;
  }

  function newMonster(kind) {
    const boss = kind === 'boss';
    let side;
    if (boss) side = 1;
    else {
      side = Math.random() < 0.5 ? -1 : 1;
      if (side === lastSide && Math.random() < 0.25) side = -side;   // avoid very long runs on one side
      lastSide = side;
    }
    const scale = boss ? 1.9 : rand(1.0, 1.2);
    const w = SW * scale, h = SH * scale;
    const sp = boss ? 52 : 104 + Math.min(kills * 9, 30) + rand(0, 18);
    const m = {
      kind, side, scale, x: side < 0 ? -w / 2 - 12 : VW + w / 2 + 12, vx: -side * sp,
      ph: rand(0, 6.28), st: 'walk', t: 0, targeted: false, dead: false, flashT: 0, kb: 0,
      hp: boss ? BOSS_HP : 1, hits: 0, drops: [],
      contact: 0.55 * (w / 2) + 30
    };
    monsters.push(m);
    return m;
  }

  function burst(x, y, n, cols) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(60, 260);
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.35, 0.7), t: 0, r: rand(2, 5), c: cols[i % cols.length] });
    }
  }

  function startDying(m) {
    m.st = 'dying'; m.t = 0; m.targeted = false;
    if (m.kind === 'boss') makeDaisies(m.x);
    const n = m.kind === 'boss' ? 16 : 9;
    for (let i = 0; i < n; i++) m.drops.push({ st: FL + 0.05 + Math.random() * 0.75, dx: rand(-0.38, 0.38), y0: rand(0.25, 0.7), r: rand(3.5, 6.5) * (m.kind === 'boss' ? 1.6 : 1) });
    sfxMelt();
  }

  function zap(m) {
    if (!valid(m)) return;
    const hd = headOf(m);
    score++;
    if (m.kind === 'boss') {
      m.hits++;
      burst(hd.x, hd.y, m.hits >= m.hp ? 30 : 14, ['#fff6b0', '#ffffff', '#ffb347', '#ff6b7d']);
      if (m.hits >= m.hp) startDying(m);
      else { m.flashT = 0.24; m.kb = m.side * 230; shake = Math.max(shake, 0.12); }
    } else {
      kills++;
      burst(hd.x, hd.y, 18, ['#fff6b0', '#ffffff', '#ffb347', '#ff6b7d']);
      startDying(m);
    }
  }

  const valid = m => m && m.st === 'walk' && !m.dead;

  function nextTarget() {
    while (queue.length && !valid(queue[0])) queue.shift();
    return queue[0] || null;
  }

  function updateRabbit(dt) {
    const R = rabbit;
    if (R.mode === 'idle') {
      const m = nextTarget();
      if (m) { queue.shift(); R.target = m; R.dr = m.x < HER_X ? -1 : 1; R.mode = 'turn'; }
    } else if (R.mode === 'turn') {
      R.p = Math.min(1, R.p + dt / 0.3);
      if (R.p >= 1) { R.mode = 'fire'; R.timer = 0; R.fired = false; }
    } else if (R.mode === 'fire') {
      R.timer += dt;
      if (!R.fired && R.timer >= 0.05) {
        R.fired = true;
        if (valid(R.target)) { lasers.push({ tgt: R.target, t: 0, life: 0.28, hit: false }); sfxZap(); }
      }
      if (R.timer >= 0.32) {
        const m = nextTarget();
        const side = m ? (m.x < HER_X ? -1 : 1) : 0;
        if (m && side === R.dr) { queue.shift(); R.target = m; R.timer = 0; R.fired = false; }
        else R.mode = 'return';
      }
    } else if (R.mode === 'return') {
      const m = nextTarget();
      if (m && (m.x < HER_X ? -1 : 1) === R.dr) { queue.shift(); R.target = m; R.mode = 'turn'; return; }
      R.p = Math.max(0, R.p - dt / 0.3);
      if (R.p <= 0) { R.mode = 'idle'; R.target = null; }
    }
  }

  function update(dt) {
    clock += dt;
    walkT += dt * Math.PI * 2 / 0.72;
    if (state !== 'win') bgx = (bgx + SCROLL * dt) % TL;
    if (daisies.length) { daisyT += dt; if (state !== 'win') for (const d of daisies) d.x -= SCROLL * dt; }

    if (state === 'play') {
      if (phase === 'wave') {
        spawnT -= dt;
        const walking = monsters.filter(m => m.kind === 'n' && m.st === 'walk').length;
        if (kills + walking < NEED && walking < 2 && spawnT <= 0) {
          newMonster('n');
          spawnT = rand(1.6, 2.8);
        }
        if (kills >= NEED && walking === 0) { phase = 'gap'; gapT = 1.3; }
      } else if (phase === 'gap') {
        gapT -= dt;
        if (gapT <= 0) { newMonster('boss'); phase = 'boss'; bannerT = 2.6; shake = 0.4; sfxRoar(); }
      }
      if (bannerT > 0) bannerT -= dt;
    }
    if (state === 'over' || state === 'win') overT += dt;

    for (const m of monsters) {
      if (m.st === 'walk') {
        m.x += (m.vx + m.kb) * dt;
        m.kb *= Math.pow(0.02, dt);
        if (m.flashT > 0) m.flashT -= dt;
        if (state === 'play' && Math.abs(m.x - HER_X) < m.contact) {
          m.dead = true; m.targeted = false;
          shake = 0.35; hurtFlash = 0.25;
          const hd = headOf(m);
          burst(m.x, GROUND - dims(m).h * 0.4, 14, ['#ff6b7d', '#ffd1d6', '#8f2a3a']);
          if (m.kind === 'boss') lives = 0; else lives--;
          if (lives <= 0) { state = 'over'; overT = 0; overMsg = m.kind === 'boss' ? 'The boss got her.' : 'The rain wins this time.'; queue = []; emit('over', { score }); }
        }
      } else if (m.st === 'dying') {
        m.t += dt;
        m.x -= SCROLL * dt;                       // a melting monster drifts with the ground
        if (m.kind === 'boss' && state === 'play' && m.t > FL + MELT + 0.35) { state = 'win'; overT = 0; queue = []; emit('win', { score }); }
        if (m.t >= PUD_END) m.dead = true;
      }
    }
    monsters = monsters.filter(m => !m.dead);

    updateRabbit(dt);

    for (const l of lasers) {
      l.t += dt;
      if (!l.hit && l.t >= 0.07) { l.hit = true; zap(l.tgt); }
    }
    lasers = lasers.filter(l => l.t < l.life);

    for (const s of sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 420 * dt; }
    sparks = sparks.filter(s => s.t < s.life);

    shake = Math.max(0, shake - dt);
    hurtFlash = Math.max(0, hurtFlash - dt);
  }

  // ---------- drawing ----------
  function drawLaser(l) {
    const pe = ease(rabbit.p);
    const e = eyePos(walkT, pe, rabbit.dr);
    const hd = headOf(l.tgt);
    const k = l.t / l.life;
    const grow = Math.min(1, l.t / 0.06);
    const tx = e.x + (hd.x - e.x) * grow, ty = e.y + (hd.y - e.y) * grow;
    const a = 1 - Math.max(0, (k - 0.55) / 0.45);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.globalAlpha = a;
    const w = 1 + Math.sin(l.t * 90) * 0.12;
    [[18, 'rgba(255,40,70,0.22)'], [10, 'rgba(255,90,70,0.5)'], [4, 'rgba(255,255,255,0.95)']].forEach(([lw, col]) => {
      ctx.strokeStyle = col; ctx.lineWidth = lw * w;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(tx, ty); ctx.stroke();
    });
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 16);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,70,80,0.55)'); g.addColorStop(1, 'rgba(255,70,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, 16, 0, Math.PI * 2); ctx.fill();
    if (l.hit) {
      const g2 = ctx.createRadialGradient(tx, ty, 0, tx, ty, 42);
      g2.addColorStop(0, 'rgba(255,255,255,0.95)'); g2.addColorStop(0.5, 'rgba(255,170,80,0.5)'); g2.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(tx, ty, 42, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function panel(title, lines, foot) {
    const w = 580, h = 56 + lines.length * 28 + 60, x = (VW - w) / 2, y = (VH - h) / 2 - 10;
    rrect(x, y, w, h, 14); ctx.fillStyle = 'rgba(21,36,46,0.88)'; ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f4f8f8'; ctx.font = '800 38px ui-rounded, system-ui, sans-serif';
    ctx.fillText(title, VW / 2, y + 52);
    ctx.fillStyle = '#b9ccd2'; ctx.font = '500 18px ui-rounded, system-ui, sans-serif';
    lines.forEach((t, i) => ctx.fillText(t, VW / 2, y + 88 + i * 28));
    ctx.fillStyle = '#ff6b7d'; ctx.font = '700 18px ui-rounded, system-ui, sans-serif';
    ctx.fillText(foot, VW / 2, y + h - 24);
  }

  // ---------- daisies ----------
  function drawDaisy(x, y, h, r, g, t, ph) {
    if (g <= 0) return;
    g = Math.min(1, g);
    const gg = ease(g);
    const sh = h * Math.min(1, gg / 0.7);
    const sway = Math.sin(t * 1.6 + ph) * 3 * gg;
    const hx = x + sway, hy = y - sh;
    ctx.strokeStyle = 'rgb(84,138,74)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sway * 0.1, y - sh * 0.55, hx, hy); ctx.stroke();
    if (sh > 12) {
      rotEll(x - 5 + sway * 0.3, y - sh * 0.4, 6, 2.5, 35, [96, 150, 82]);
      rotEll(x + 5 + sway * 0.3, y - sh * 0.3, 6, 2.5, -35, [96, 150, 82]);
    }
    const bloom = ease((g - 0.55) / 0.45);
    if (bloom <= 0) { ell(hx, hy, 3 * gg, 4 * gg, [96, 150, 82]); return; }
    ctx.save(); ctx.translate(hx, hy);
    ctx.fillStyle = 'rgb(252,250,243)'; ctx.strokeStyle = 'rgba(120,134,120,0.55)'; ctx.lineWidth = 0.8;
    for (let k = 0; k < 10; k++) {
      ctx.save(); ctx.rotate(k / 10 * Math.PI * 2 + ph);
      ctx.beginPath(); ctx.ellipse(r * 0.62 * bloom, 0, r * 0.42 * bloom, r * 0.18 * bloom, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    ell(hx, hy, r * 0.34 * (0.5 + 0.5 * bloom), r * 0.34 * (0.5 + 0.5 * bloom), 'rgb(244,198,64)');
  }

  // daisies that sprout along the ground where the boss melted
  function makeDaisies(cx) {
    daisies = []; daisyT = 0;
    for (let i = 0; i < 30; i++) {
      const x = rand(-20, VW + 20);
      daisies.push({ x, y: rand(470, 508), h: rand(26, 46), r: rand(8, 13), delay: 0.45 + Math.abs(x - cx) / 750 * 1.1 + rand(0, 0.35), ph: rand(0, 6.28) });
    }
    daisies.sort((a, b) => a.y - b.y);
  }

  // the daisy field around the picnic blanket (fixed layout)
  const PIC_BACK = [], PIC_FRONT = [];
  (function () {
    let sd = 12345; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const mkd = (arr, x0, x1, y0, y1, n) => {
      for (let i = 0; i < n; i++) arr.push({ x: x0 + rr() * (x1 - x0), y: y0 + rr() * (y1 - y0), h: 24 + rr() * 22, r: 8 + rr() * 5, delay: 0.2 + rr() * 2.2, ph: rr() * 6.28 });
    };
    mkd(PIC_BACK, 20, 170, 412, 500, 8);
    mkd(PIC_BACK, 860, 1000, 412, 500, 8);
    mkd(PIC_BACK, 270, 760, 372, 392, 9);
    mkd(PIC_FRONT, 30, 360, 496, 512, 6);
    mkd(PIC_FRONT, 660, 1000, 496, 512, 6);
    [PIC_BACK, PIC_FRONT].forEach(a => a.sort((p, q) => p.y - q.y));
  })();

  // ---------- picnic dialogue ----------
  // Original lines inspired by Max Ernst's ideas: chance, collage, frottage, and his bird alter ego Loplop.
  const SCRIPT = [
    ['girl', 'Nobody planned this. That is why it works.'],
    ['duck', 'Loplop presents: a rabbit with laser eyes.'],
    ['rabbit', 'That damp patch looks like a monster.'],
    ['girl', 'Rub a pencil over it and he appears.'],
    ['duck', 'Distant realities, one blanket.'],
    ['rabbit', 'I did not aim. The laser found him.'],
    ['girl', 'A happy accident. Pass the tea.'],
    ['duck', 'Nothing is finished. Everything is collage.']
  ];
  const WHO = { girl: 'Girl', rabbit: 'Rabbit', duck: 'Duck' };
  const SPOT = { girl: { cx: 125, cy: 296, tx: 314, ty: 290 }, rabbit: { cx: 505, cy: 262, tx: 518, ty: 316 }, duck: { cx: 690, cy: 304, tx: 656, ty: 356 } };
  const LINE_DUR = SCRIPT.map(l => Math.max(2.4, 1.0 + l[1].length * 0.055) + 0.5);
  const LINE_TOT = LINE_DUR.reduce((a, b) => a + b, 0);

  function dialogue() {
    const tt = overT - 1.3;
    if (tt < 0) return null;
    if (tt >= LINE_TOT) return null;            // plays once, then the picnic stays quiet
    let u = tt, i = 0;
    while (i < LINE_DUR.length - 1 && u >= LINE_DUR[i]) { u -= LINE_DUR[i]; i++; }
    const show = LINE_DUR[i] - 0.5, text = SCRIPT[i][1];
    const chars = Math.min(text.length, Math.floor(u * 34));
    return { i, who: SCRIPT[i][0], text, u, show, chars, visible: u < show, talking: u < show && chars < text.length };
  }

  function drawBubble(d) {
    if (!d || !d.visible) return;
    const sp = SPOT[d.who];
    const a = Math.min(1, d.u / 0.15, (d.show - d.u) / 0.25);
    ctx.save();
    ctx.globalAlpha *= Math.max(0, a);
    ctx.font = '600 16px ui-rounded, system-ui, sans-serif';
    const words = d.text.split(' '), lines = []; let cur = '';
    for (const w of words) {
      const tryS = cur ? cur + ' ' + w : w;
      if (ctx.measureText(tryS).width > 196 && cur) { lines.push(cur); cur = w; } else cur = tryS;
    }
    lines.push(cur);
    const lh = 21, pad = 13;
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + pad * 2, h = lines.length * lh + pad * 2 - 4;
    const L = sp.cx - w / 2, T = sp.cy - h / 2, R = L + w, B = T + h;
    ctx.fillStyle = 'rgba(250,247,240,0.97)';
    rrect(L, T, w, h, 14); ctx.fill();
    ctx.beginPath();
    if (sp.ty > B) {
      const bx = Math.max(L + 18, Math.min(R - 18, sp.tx));
      ctx.moveTo(bx - 9, B - 1); ctx.lineTo(bx + 9, B - 1); ctx.lineTo(sp.tx, sp.ty);
    } else if (sp.tx > R) {
      const by = Math.max(T + 14, Math.min(B - 14, sp.ty));
      ctx.moveTo(R - 1, by - 8); ctx.lineTo(R - 1, by + 8); ctx.lineTo(sp.tx, sp.ty);
    } else {
      const by = Math.max(T + 14, Math.min(B - 14, sp.ty));
      ctx.moveTo(L + 1, by - 8); ctx.lineTo(L + 1, by + 8); ctx.lineTo(sp.tx, sp.ty);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1d2a31'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    let left = d.chars;
    lines.forEach((ln, li) => { ctx.fillText(ln.slice(0, Math.max(0, left)), L + pad, T + pad + 14 + li * lh); left -= ln.length + 1; });
    ctx.restore();
    if (d.i !== lastLine) {
      lastLine = d.i;
      const sr = opts.live;
      if (sr) sr.textContent = WHO[d.who] + ': ' + d.text;
    }
  }

  // ---------- victory picnic ----------
  function drawPicnic(t, talking) {
    if (tileOK) { for (let x = -bgx; x < VW; x += TL) ctx.drawImage(tile, x, 0); }
    else { ctx.fillStyle = '#9fb2b6'; ctx.fillRect(0, 0, VW, VH); }
    // the rain has stopped: soft light from the upper right
    const sun = ctx.createRadialGradient(860, 60, 10, 860, 60, 340);
    sun.addColorStop(0, 'rgba(255,246,214,0.8)'); sun.addColorStop(1, 'rgba(255,246,214,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, VW, VH);

    ctx.save();
    ctx.translate(0, -14);
    const talk = n => talking === n ? Math.sin(t * 17) * 1.1 : 0;
    for (const d of PIC_BACK) drawDaisy(d.x, d.y, d.h, d.r, (overT - d.delay) / 1.2, t, d.ph);

    // blanket in perspective: red and cream squares
    const top = 398, bot = 482, tl = 262, tr = 762, bl = 190, br = 834, cols = 9, rows = 4;
    const bp = (r, c) => { const v = r / rows, L = lerp(tl, bl, v), R = lerp(tr, br, v); return [lerp(L, R, c / cols), lerp(top, bot, v)]; };
    ell(512, 492, 345, 13, 'rgba(20,34,42,0.22)');
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      poly([bp(r, c), bp(r, c + 1), bp(r + 1, c + 1), bp(r + 1, c)], (r + c) % 2 ? 'rgb(238,230,212)' : 'rgb(196,50,52)');
    }
    poly([[bl, bot], [br, bot], [br + 4, bot + 9], [bl - 4, bot + 9]], 'rgb(140,36,40)');

    // umbrella planted in the ground, open as a sunshade
    ctx.save();
    ctx.translate(236, 470); ctx.rotate(0.1);
    ctx.strokeStyle = rgb(C.umb); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -282); ctx.stroke();
    ctx.fillStyle = rgb(C.red);
    ctx.beginPath(); ctx.ellipse(0, -282, 150, 66, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(-120 + k * 60, -280, 30, 17, 0, 0, Math.PI); ctx.closePath(); ctx.fill(); }
    ctx.fillRect(-150, -283, 300, 3);
    ctx.strokeStyle = rgb(C.redD); ctx.lineWidth = 1.5;
    [-80, 0, 80].forEach(k => { ctx.beginPath(); ctx.moveTo(0, -348); ctx.lineTo(k, -282); ctx.stroke(); });
    ctx.restore();

    // basket
    poly([[735, 418], [805, 418], [796, 456], [744, 456]], 'rgb(176,128,82)');
    ctx.strokeStyle = 'rgb(140,98,60)'; ctx.lineWidth = 1.5;
    [428, 438, 448].forEach(y => { ctx.beginPath(); ctx.moveTo(738, y); ctx.lineTo(802, y); ctx.stroke(); });
    ctx.strokeStyle = 'rgb(150,106,66)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(770, 418, 32, Math.PI, Math.PI * 2); ctx.stroke();
    poly([[740, 418], [800, 418], [792, 407], [748, 407]], 'rgb(196,50,52)');
    ell(780, 407, 16, 7, 'rgb(214,170,110)');

    // girl, seated
    const sip = Math.sin(t * 0.9) * 1.5;
    poly([[300, 340], [354, 340], [376, 442], [286, 442]], C.navy);
    poly([[330, 340], [354, 340], [376, 442], [322, 442]], C.navyD);
    poly([[350, 424], [452, 436], [452, 454], [350, 448]], C.navyD);
    poly([[448, 430], [466, 430], [480, 440], [480, 456], [448, 456]], C.redD);
    poly([[350, 420], [450, 426], [450, 446], [350, 444]], C.navy);
    poly([[446, 420], [464, 420], [478, 432], [478, 448], [446, 448]], C.boot);
    ctx.save(); ctx.translate(0, talk('girl'));
    ell(346, 310, 16, 18, C.skin);
    ell(338, 304, 24, 23, C.hair);
    poly([[316, 304], [326, 304], [326, 340], [314, 340]], C.hair);
    ctx.restore();
    poly([[336, 350], [352, 350], [398, 392 + sip], [386, 402 + sip]], C.navyD);
    ell(394, 396 + sip, 6, 6, C.skin);
    // cup with steam
    poly([[386, 376 + sip], [408, 376 + sip], [405, 394 + sip], [389, 394 + sip]], 'rgb(240,234,220)');
    poly([[387, 382 + sip], [407, 382 + sip], [406, 386 + sip], [388, 386 + sip]], C.red);
    ctx.strokeStyle = 'rgb(240,234,220)'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(409, 384 + sip, 4.5, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.55 + i / 3) % 1;
      ell(397 + (i - 1) * 6 + Math.sin(t * 2 + i * 2) * 3, 370 + sip - ph * 34, 2.5 + ph * 3.5, 5, `rgba(255,255,255,${(1 - ph) * 0.55})`);
    }

    // food on a plate
    ell(575, 466, 36, 9, 'rgb(246,242,232)');
    ell(575, 465, 28, 6, 'rgb(230,224,212)');
    poly([[552, 462], [570, 451], [577, 466]], 'rgb(222,184,128)');
    poly([[552, 462], [554, 459], [572, 449], [570, 451]], 'rgb(120,170,90)');
    poly([[577, 466], [593, 452], [603, 465]], 'rgb(222,184,128)');
    poly([[577, 466], [579, 463], [595, 450], [593, 452]], 'rgb(120,170,90)');
    ell(617, 462, 10, 9, 'rgb(200,52,52)');
    ctx.strokeStyle = 'rgb(70,50,46)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(617, 454); ctx.lineTo(619, 449); ctx.stroke();
    rotEll(623, 451, 5, 2.4, 25, [110, 160, 84]);

    // rabbit, seated, with a laser-red glint in its eye
    const twitch = Math.max(0, Math.sin(t * 1.7)) ** 8 * 14;
    ell(482, 430, 7, 7, 'rgb(250,240,240)');
    ell(505, 422, 24, 31, C.pink);
    ell(498, 438, 22, 15, C.pinkD);
    ell(520, 452, 12, 5, C.pink);
    ctx.save(); ctx.translate(0, talk('rabbit'));
    rotEll(510, 352, 5.5, 22, 12, C.pink);
    rotEll(527, 352, 5.5, 22, 20 + twitch, C.pinkD);
    ell(521, 381, 19, 16, C.pink);
    ell(528, 378, 2.6, 2.6, C.eye);
    const pulse = 0.8 + 0.2 * Math.sin(t * 3);
    const glint = ctx.createRadialGradient(528, 378, 0, 528, 378, 19);
    glint.addColorStop(0, `rgba(255,60,80,${pulse})`); glint.addColorStop(0.45, `rgba(255,60,80,${pulse * 0.45})`); glint.addColorStop(1, 'rgba(255,60,80,0)');
    ctx.fillStyle = glint; ctx.beginPath(); ctx.arc(528, 378, 19, 0, Math.PI * 2); ctx.fill();
    ell(528, 378, 3.4, 3.4, 'rgb(255,70,90)');
    ell(528.6, 377.2, 1.1, 1.1, '#ffffff');
    ell(539, 384, 2.2, 1.7, C.pinkD);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
    [[0, -2], [1, 2]].forEach(([i, dy]) => { ctx.beginPath(); ctx.moveTo(536, 385 + dy * 0.5); ctx.lineTo(552, 382 + dy * 4); ctx.stroke(); });
    ctx.restore();
    poly([[524, 411], [560, 402], [526, 421]], 'rgb(232,124,44)');
    rotEll(520, 412, 8, 3, 30, [110, 160, 84]);
    ell(529, 412, 6, 5, C.pink);

    // duck facing the rabbit
    const bob = Math.sin(t * 2.4) * 2 + talk('duck') * 1.2;
    const blink = (t % 4.2) < 0.12;
    ell(666, 453, 8, 3, 'rgb(236,134,50)');
    ell(684, 453, 8, 3, 'rgb(236,134,50)');
    ell(670, 430, 32, 22, 'rgb(244,208,84)');
    poly([[696, 420], [716, 406], [706, 432]], 'rgb(244,208,84)');
    ell(676, 432, 20, 12, 'rgb(226,186,64)');
    poly([[648, 420], [662, 420], [666, 396 + bob], [650, 392 + bob]], 'rgb(244,208,84)');
    ell(656, 386 + bob, 15, 14, 'rgb(244,208,84)');
    ell(639, 390 + bob, 11, 5, 'rgb(240,140,50)');
    ctx.strokeStyle = 'rgb(176,92,30)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(629, 391 + bob); ctx.lineTo(649, 391 + bob); ctx.stroke();
    ell(652, 383 + bob, 2.2, blink ? 0.4 : 2.2, C.eye);
    ell(660, 391 + bob, 4, 3, 'rgba(255,150,120,0.5)');
    poly([[647, 403 + bob * 0.5], [666, 403 + bob * 0.5], [668, 411], [650, 413]], C.red);
    poly([[660, 411], [668, 411], [670, 424], [662, 423]], C.redD);

    for (const d of PIC_FRONT) drawDaisy(d.x, d.y, d.h, d.r, (overT - d.delay) / 1.2, t, d.ph);

    // a butterfly
    const bx = 760 + 90 * Math.sin(t * 0.5), by = 200 + 28 * Math.sin(t * 0.9), fl = Math.abs(Math.sin(t * 13));
    ell(bx - 5 * fl, by, 6 * fl + 1, 7, 'rgb(250,214,120)');
    ell(bx + 5 * fl, by, 6 * fl + 1, 7, 'rgb(250,214,120)');
    ell(bx, by, 1.4, 5, C.eye);
    ctx.restore();
  }

  function drawWinText(t) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    rrect(VW / 2 - 190, 18, 380, 100, 14); ctx.fillStyle = 'rgba(21,36,46,0.84)'; ctx.fill();
    ctx.fillStyle = '#f4f8f8'; ctx.font = '800 36px ui-rounded, system-ui, sans-serif';
    ctx.fillText('Boss melted', VW / 2, 60);
    ctx.fillStyle = '#b9ccd2'; ctx.font = '500 17px ui-rounded, system-ui, sans-serif';
    ctx.fillText('The rain can wait. Picnic time.', VW / 2, 86);
    ctx.fillStyle = '#8ea6ae'; ctx.font = '600 13px ui-rounded, system-ui, sans-serif';
    ctx.fillText('Zaps ' + score + '   ·   Hearts left ' + lives, VW / 2, 106);
    if (overT > 0.8) {
      rrect(VW / 2 - 112, 476, 224, 34, 17); ctx.fillStyle = 'rgba(21,36,46,0.84)'; ctx.fill();
      ctx.fillStyle = '#ff8a98'; ctx.font = '700 17px ui-rounded, system-ui, sans-serif';
      ctx.fillText('Tap to play again', VW / 2, 499);
    }
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    ctx.save();
    if (shake > 0) ctx.translate(rand(-5, 5) * Math.min(1, shake / 0.35), rand(-4, 4) * Math.min(1, shake / 0.35));

    if (tileOK) {
      for (let x = -bgx; x < VW; x += TL) ctx.drawImage(tile, x, 0);
    } else { ctx.fillStyle = '#9fb2b6'; ctx.fillRect(0, 0, VW, VH); }

    // far monsters behind her, nearer ones in front: draw by distance so claws overlap naturally
    for (const d of daisies) drawDaisy(d.x, d.y, d.h, d.r, (daisyT - d.delay) / 1.1, clock, d.ph);
    const order = monsters.slice().sort((a, b) => Math.abs(b.x - HER_X) - Math.abs(a.x - HER_X));
    for (const m of order) drawMonster(m, clock);
    drawWoman(walkT, ease(rabbit.p), rabbit.dr);
    for (const l of lasers) drawLaser(l);
    for (const s of sparks) {
      ctx.globalAlpha = Math.max(0, 1 - s.t / s.life);
      ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (hurtFlash > 0) { ctx.fillStyle = `rgba(255,61,79,${hurtFlash * 0.9})`; ctx.fillRect(0, 0, VW, VH); }
    if (state === 'win') {
      ctx.save(); ctx.globalAlpha = ease(overT / 0.9);
      const dl = dialogue();
      drawPicnic(clock, dl && dl.talking ? dl.who : null); drawWinText(clock); drawBubble(dl);
      ctx.restore();
    }

    // HUD
    ctx.textBaseline = 'alphabetic';
    if (state !== 'title' && state !== 'win') {
      ctx.textAlign = 'left';
      if (phase !== 'boss') {
        ctx.fillStyle = 'rgba(21,36,46,0.78)'; rrect(16, 16, 158, 46, 10); ctx.fill();
        ctx.fillStyle = '#f4f8f8'; ctx.font = '800 28px ui-rounded, system-ui, sans-serif';
        ctx.fillText(Math.min(kills, NEED) + '/' + NEED, 30, 49);
        ctx.fillStyle = '#9fb6bd'; ctx.font = '700 12px ui-rounded, system-ui, sans-serif';
        ctx.fillText('MONSTERS', 88, 49);
      } else {
        const boss = monsters.find(m => m.kind === 'boss');
        const hits = boss ? boss.hits : BOSS_HP;
        const bw = 330, bx = (VW - bw) / 2;
        ctx.fillStyle = 'rgba(21,36,46,0.82)'; rrect(bx - 14, 14, bw + 28, 44, 10); ctx.fill();
        ctx.fillStyle = '#ff8a98'; ctx.font = '800 12px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('BOSS', bx, 31);
        const sw = (bw - (BOSS_HP - 1) * 5) / BOSS_HP;
        for (let i = 0; i < BOSS_HP; i++) {
          ctx.fillStyle = i < BOSS_HP - hits ? '#ff4d63' : 'rgba(255,255,255,0.16)';
          rrect(bx + i * (sw + 5), 38, sw, 10, 3); ctx.fill();
        }
      }
      ctx.fillStyle = 'rgba(21,36,46,0.78)'; rrect(VW - 132, 16, 116, 46, 10); ctx.fill();
      for (let i = 0; i < 3; i++) heart(VW - 106 + i * 36, 38, 11, i < lives ? '#ff4d63' : 'rgba(255,255,255,0.18)');
    }
    if (bannerT > 0 && state === 'play') {
      const k = Math.min(1, (2.6 - bannerT) / 0.25), out = Math.min(1, bannerT / 0.5);
      ctx.save(); ctx.globalAlpha = k * out; ctx.textAlign = 'center';
      const bx = 800;
      ctx.fillStyle = 'rgba(21,36,46,0.8)'; rrect(bx - 200, 84, 400, 96, 14); ctx.fill();
      ctx.fillStyle = '#ff6b7d'; ctx.font = '800 54px ui-rounded, system-ui, sans-serif';
      ctx.fillText('BOSS', bx, 142);
      ctx.fillStyle = '#d3e2e6'; ctx.font = '600 16px ui-rounded, system-ui, sans-serif';
      ctx.fillText('Coming from the right. Zap it ' + BOSS_HP + ' times.', bx, 168);
      ctx.restore();
    }
    if (state === 'title') {
      panel('Rabbit Zapper', ['Monsters creep in from both sides.', 'Tap one: the rabbit turns and zaps it with eye lasers.', 'Zap four, then face the boss.'], 'Tap to start');
    } else if (state === 'over') {
      panel('Game over', [overMsg, 'Zaps: ' + score], overT > 0.6 ? 'Tap to play again' : ' ');
    }
  }

  // ---------- input ----------
  const pending = m => queue.filter(q => q === m).length + (rabbit.target === m && rabbit.mode !== 'idle' ? 1 : 0);
  function enqueue(m) {
    if (m.kind === 'boss') {
      if (m.hits + pending(m) < m.hp) queue.push(m);
    } else if (!m.targeted) { m.targeted = true; queue.push(m); }
  }
  function tap(x, y) {
    let best = null, bd = 1e9;
    for (const m of monsters) {
      if (m.st !== 'walk') continue;
      const { w, h } = dims(m);
      const pad = 26;
      if (Math.abs(x - m.x) > w / 2 + pad || y < GROUND - h - pad || y > GROUND + 24) continue;
      const hd = headOf(m);
      const d = Math.hypot(x - m.x, y - (GROUND - h * 0.45)) + (m.kind === 'boss' ? 0 : 0);
      if (d < bd) { bd = d; best = m; }
    }
    if (best) enqueue(best);
  }
  function zapSide(side) {
    let best = null, bd = 1e9;
    for (const m of monsters) {
      if (m.st !== 'walk' || m.side !== side) continue;
      if (m.kind !== 'boss' && m.targeted) continue;
      const d = Math.abs(m.x - HER_X);
      if (d < bd) { bd = d; best = m; }
    }
    if (best) enqueue(best);
  }
  const restartable = () => state === 'title' || ((state === 'over' || state === 'win') && overT > 0.7);
  cv.addEventListener('pointerdown', e => {
    try { cv.focus({ preventScroll: true }); } catch (err) { /* focus is optional */ }
    initAudio();
    if (state === 'title' || ((state === 'over' || state === 'win') && overT > 0.7)) { start(); return; }
    if (state !== 'play') return;
    const r = cv.getBoundingClientRect();
    tap((e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH);
  });
  function onKey(e) {
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (e.target && e.target.tagName === 'BUTTON') return;
      if (restartable()) { e.preventDefault(); initAudio(); start(); }
      return;
    }
    const left = e.key === 'ArrowLeft' || e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A';
    const right = e.key === 'ArrowRight' || e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D';
    if (!left && !right) return;
    e.preventDefault();
    initAudio();
    if (restartable()) { start(); return; }
    if (state === 'play') zapSide(left ? -1 : 1);
  }
  window.addEventListener('keydown', onKey);
  function pad(side) { initAudio(); if (restartable()) start(); else if (state === 'play') zapSide(side); }
  const padL = () => pad(-1), padR = () => pad(1);
  if (opts.padLeft) opts.padLeft.addEventListener('pointerdown', padL);
  if (opts.padRight) opts.padRight.addEventListener('pointerdown', padR);

  // ---------- sound ----------
  let ac = null;
  function initAudio() {
    if (!soundOn) return;
    try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; }
  }
  function sfxZap() {
    if (!ac) return;
    try {
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(1100, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.2);
      g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.24);
    } catch (e) { /* sound is optional */ }
  }
  function noiseBurst(dur, f0, f1, vol) {
    if (!ac) return;
    try {
      const n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = ac.createBufferSource(); src.buffer = buf;
      const fl = ac.createBiquadFilter(); fl.type = 'lowpass';
      const t = ac.currentTime; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ac.createGain(); g.gain.value = vol;
      src.connect(fl); fl.connect(g); g.connect(ac.destination); src.start(t);
    } catch (e) { /* sound is optional */ }
  }
  const sfxMelt = () => noiseBurst(1.1, 2600, 220, 0.12);
  const sfxRoar = () => noiseBurst(1.4, 500, 70, 0.22);

  // ---------- loop ----------
  let last = 0;
  function frame(ts) {
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016);
    last = ts;
    for (let i = 0; i < steps; i++) update(dt);
    draw();
    if (alive) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    setSound(on) { soundOn = !!on; if (!on && ac) { try { ac.suspend(); } catch (e) { /* optional */ } } },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      if (opts.padLeft) opts.padLeft.removeEventListener('pointerdown', padL);
      if (opts.padRight) opts.padRight.removeEventListener('pointerdown', padR);
      if (ac) { try { ac.close(); } catch (e) { /* optional */ } ac = null; }
    },
  };
  }
  global.RabbitZapper = { mount: mount };
})(window);
