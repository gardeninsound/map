/* Duck Scroller. A painted side scroller you can mount inside any page or game.
 *
 *   <script src="duck-scroller-audio.js"></script>   (optional: music and voices)
 *   <script src="duck-scroller.js"></script>
 *   var game = DuckScroller.mount(document.getElementById('slot'), {
 *     base: 'duck-scroller/',                      // folder holding the image files
 *     onEvent: function (name, data) { ... }       // see EVENTS below
 *   });
 *
 * EVENTS: ready, greeting, duckLine {id}, pineapple, pineappleDone, credits, finished, error {asset}
 * OPTIONS: base, audio, controls (true), keyboard (true), showPosition (false), loadFont (true),
 *          startX (130), speed (220), musicVolume (0.26), lockWhileTalking (false), onEvent
 * API: destroy(), restart(), pause(), resume(), setSound(on), setMusic(on), canvas, x
 */
(function (global) {
  'use strict';
  var VIEW_W = 960, VIEW_H = 480;
  var CELL_W = 317, CELL_H = 383, COLS = 8, FRAMES = 37, FOOT_PAD = 4.5;
  var SP = { cw: 214, ch: 161, cols: 10, frames: 107, fps: 12, x: 363, y: 235, scale: 1.52, center: 480, near: 300, far: 430,
             fade: 0.3, sayAt: 1.45, bubbleFrom: 1.4, bubbleTo: 3.1, idleX: 360, idleY: 252 };
  var PN = { hold: 32, x: 2400, bottom: 450, s: 1.1, cw: 272, ch: 321, baseY: 315, cx: 132.2, cols: 11, frames: 61, dur: 5.04,
             trigger: 2150, reach: 30, sayAt: 0.6, bubbleFrom: 0.5, bubbleTo: 3.7, line: 'I knew you would find me, lucky duck.',
             tops: [151,149,139,127,118,105,94,78,67,55,40,20,8,6,6,8,7,8,5,7,12,8,8,11,11,6,4,4,4,9,11,6,6,14,13,12,7,12,7,8,8,10,7,6,7,5,19,31,43,55,70,81,92,100,109,120,128,138,142,152,151] };
  var CR = { cw: 320, ch: 138, cols: 10, frames: 107, fps: 12.06, s: 3, bg: '#F3F5F9',
             line1: 'You never doubted yourself, but if you did, you kept going.', line2: 'Hooray for it.' };
  var FILES = { bg: 'background.jpg', duck: 'duck_walk.webp', spr: 'person_sheep.webp', idle: 'figures_idle.png', pine: 'pineapple.webp', cred: 'credits.webp' };
  var FONT = '"Press Start 2P", "Courier New", monospace';

  var HEART = ['..XXX.XXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..XXXXXXX..', '...XXXXX...', '....XXX....', '.....X.....'];
  var FACE = ['...XXXXX...', '..XXXXXXX..', '.XDDDXXXXX.', 'XXXXXXDDDXX', 'XXXXXXXXXXX', 'XXXDXXXDXXX', 'XXXDXXXDXXX', 'XXXXXXXXXXX', 'XXXXXDDDXXX', '.XXDDDXXXX.', '...XXXXX...'];
  var SCARED = ['...XXXXX...', '..XXXXXXX.B', '.XDDXXXDDXB', 'XXXXXXXXXXB', 'XXWWXXXWWXX', 'XXWDXXXDWXX', 'XXXXXXXXXXX', 'XXXXDDDXXXX', 'XXXDDDDDXXX', '.XXXDDDXXX.', '...XXXXX...'];
  var TROPHY = ['..XXXXXXX..', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.XXXXXXX.X', 'XX.XXXXX.XX', '...XXXXX...', '....XXX....', '.....X.....', '.....X.....', '...XXXXX...', '..XXXXXXX..'];
  var HL = { '1,2': 1, '1,3': 1, '2,2': 1 }, TL = { '1,3': 1, '2,3': 1, '3,3': 1 };
  var SPR_HEART = { map: HEART, color: function (r, c) { return HL[r + ',' + c] ? '#FFD3DC' : (r > 5 || c > 8 ? '#D81E4A' : '#FF3D6B'); } };
  var SPR_FACE = { map: FACE, color: function (r, c, ch) { return ch === 'D' ? '#141414' : ((r > 7 || c > 8) ? '#E5A91A' : '#FFD23F'); } };
  var SPR_SCARED = { map: SCARED, color: function (r, c, ch) {
    if (ch === 'D') return '#141414'; if (ch === 'W') return '#FFFFFF'; if (ch === 'B') return '#3FB0FF';
    return (r > 7 || c > 8) ? '#E5A91A' : '#FFD23F'; } };
  var SPR_TROPHY = { map: TROPHY, color: function (r, c) { return TL[r + ',' + c] ? '#FFF1A8' : ((c > 6 || r > 8) ? '#D99A00' : '#FFC82C'); } };

  var STYLE = '.ds-root{width:100%;display:flex;flex-direction:column;gap:12px;font:inherit}' +
    '.ds-stage{line-height:0;overflow:hidden;border:1px solid currentColor;border-color:color-mix(in srgb,currentColor 25%,transparent)}' +
    '.ds-stage canvas{width:100%;height:auto;display:block;touch-action:none}' +
    '.ds-pad{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
    '.ds-pad button{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;padding:10px 16px;border-radius:2px;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none}' +
    '.ds-pad button:active,.ds-pad button.ds-on{background:currentColor}' +
    '.ds-pad button:active span,.ds-pad button.ds-on span{color:Canvas;mix-blend-mode:difference}' +
    '.ds-pad button:focus-visible{outline:2px solid currentColor;outline-offset:2px}' +
    '.ds-pos{margin-left:auto;opacity:.65;font-variant-numeric:tabular-nums}';

  function ensureStyle() {
    if (document.getElementById('ds-style')) return;
    var s = document.createElement('style'); s.id = 'ds-style'; s.textContent = STYLE; document.head.appendChild(s);
  }
  function ensureFont() {
    if (document.getElementById('ds-font')) return;
    var l = document.createElement('link'); l.id = 'ds-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'; document.head.appendChild(l);
  }

  function mount(container, opts) {
    opts = opts || {};
    var base = opts.base == null ? 'duck-scroller/' : opts.base;
    var AUD = opts.audio || global.DUCK_SCROLLER_AUDIO || null;
    var START_X = opts.startX == null ? 130 : opts.startX, SPEED = opts.speed || 220;
    var MUSIC_VOL = opts.musicVolume == null ? 0.26 : opts.musicVolume;
    var LOCK = !!opts.lockWhileTalking;
    var dead = false, paused = false, rafId = 0;
    ensureStyle(); if (opts.loadFont !== false) ensureFont();

    function emit(name, data) { try { if (opts.onEvent) opts.onEvent(name, data || {}); } catch (e) { if (global.console) console.error(e); } }

    /* ---- DOM ---- */
    var root = document.createElement('div'); root.className = 'ds-root';
    var stage = document.createElement('div'); stage.className = 'ds-stage';
    var canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', 'Duck side scroller');
    stage.appendChild(canvas); root.appendChild(stage);
    var ctx = canvas.getContext('2d');
    var keys = {}, btnSnd = null, btnMus = null, btnReplay = null, posEl = null;
    if (opts.controls !== false) {
      var pad = document.createElement('div'); pad.className = 'ds-pad'; root.appendChild(pad);
      var mk = function (label, k) { var b = document.createElement('button'); b.type = 'button'; var sp = document.createElement('span'); sp.textContent = label; b.appendChild(sp); b.setAttribute('data-k', k || ''); pad.appendChild(b); return b; };
      var bl = mk('← Left', 'left'), br = mk('Right →', 'right');
      [bl, br].forEach(function (b) {
        var k = b.getAttribute('data-k');
        b.addEventListener('pointerdown', function (e) { keys[k] = true; b.classList.add('ds-on'); e.preventDefault(); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { b.addEventListener(n, function () { keys[k] = false; b.classList.remove('ds-on'); }); });
      });
      if (AUD) {
        btnSnd = mk('Sound on'); btnMus = mk('Music on');
        btnSnd.addEventListener('click', function () { setSound(!soundOn); });
        btnMus.addEventListener('click', function () { setMusic(!musicWanted); });
      }
      btnReplay = mk('Play again'); btnReplay.hidden = true; btnReplay.addEventListener('click', restart);
      if (opts.showPosition) { posEl = document.createElement('span'); posEl.className = 'ds-pos'; pad.appendChild(posEl); }
    }
    container.appendChild(root);

    /* ---- assets ---- */
    var im = {}, left = 0, loaded = false;
    Object.keys(FILES).forEach(function (k) {
      left++; var i = new Image();
      i.onload = function () { if (--left === 0) { loaded = true; size(); emit('ready'); if (!dead) rafId = requestAnimationFrame(frame); } };
      i.onerror = function () { emit('error', { asset: base + FILES[k] }); if (global.console) console.error('DuckScroller: could not load ' + base + FILES[k]); };
      i.src = base + FILES[k]; im[k] = i;
    });

    /* ---- state ---- */
    var state, sp, pn, cr, cur, pending, DT;
    function resetState() {
      state = { x: START_X, face: 1, t: 0, moving: false };
      sp = { playing: false, armed: true, t: 0, said: false };
      pn = { done: false, playing: false, armed: true, said: false, t: 0 };
      cr = { started: false, wait: 0, on: false, t: 0, finished: false };
      cur = null; pending = [];
      DT = [
        { id: 'encouraging', x: 555, reach: 30, rearm: 260, dur: 2.2, sayAt: 0.15, line: 'That was encouraging.', sprite: SPR_HEART, clip: 'duck1', armed: true },
        { id: 'hope_find', x: 814, reach: 30, rearm: 260, dur: 2.2, sayAt: 0.15, line: 'I hope I can find it.', sprite: SPR_FACE, clip: 'duck2', armed: true },
        { id: 'lost_doomed', x: 1120, reach: 30, rearm: 260, dur: 3.1, sayAt: 0.15, line: 'I hope I am not lost and doomed.', sprite: SPR_SCARED, clip: 'duck3', armed: true }
      ];
      if (btnReplay) btnReplay.hidden = true;
    }
    resetState();
    function restart() { resetState(); voiceEnd = 0; if (synth) { try { synth.cancel(); } catch (e) {} } }

    /* ---- audio ---- */
    var soundOn = !!AUD, musicWanted = !!AUD, duckUntil = 0, voiceEnd = 0, voiceTok = 0;
    var clips = {};
    if (AUD) { ['person', 'duck1', 'duck2', 'duck3', 'pine'].forEach(function (k) { if (AUD[k]) { clips[k] = new Audio(AUD[k]); clips[k].preload = 'auto'; } }); }
    var actx = null, mGain = null, mSrc = null, mLoading = false;
    function musicTarget() { return (soundOn && musicWanted && !paused) ? (performance.now() < duckUntil ? MUSIC_VOL * 0.35 : MUSIC_VOL) : 0; }
    function setMusicGain() { if (actx && mGain) mGain.gain.setTargetAtTime(musicTarget(), actx.currentTime, 0.2); }
    function duckMusic(ms) { duckUntil = performance.now() + ms; setMusicGain(); setTimeout(setMusicGain, ms + 60); }
    function startMusic() {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC || !AUD || !AUD.music || dead) return;
      try {
        if (!actx) { actx = new AC(); mGain = actx.createGain(); mGain.gain.value = 0; mGain.connect(actx.destination); }
        if (actx.state === 'suspended') actx.resume();
        if (mSrc || mLoading) { setMusicGain(); return; }
        mLoading = true;
        var s = atob(AUD.music.slice(AUD.music.indexOf(',') + 1)), u = new Uint8Array(s.length), got = false;
        for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        var done = function (buf) {
          if (got || dead) return; got = true;
          mSrc = actx.createBufferSource(); mSrc.buffer = buf; mSrc.loop = true; mSrc.connect(mGain); mSrc.start(0);
          mLoading = false; setMusicGain();
        };
        var fail = function () { mLoading = false; };
        var p = actx.decodeAudioData(u.buffer, done, fail);
        if (p && p.then) p.then(done, fail);
      } catch (e) { mLoading = false; }
    }
    function setSound(on) { soundOn = !!on && !!AUD; if (btnSnd) { btnSnd.firstChild.textContent = soundOn ? 'Sound on' : 'Sound off'; } if (!soundOn && synth) { try { synth.cancel(); } catch (e) {} } setMusicGain(); if (soundOn) startMusic(); }
    function setMusic(on) { musicWanted = !!on && !!AUD; if (btnMus) { btnMus.firstChild.textContent = musicWanted ? 'Music on' : 'Music off'; } setMusicGain(); if (musicWanted) startMusic(); }
    function unlock() { startMusic(); }

    var synth = global.speechSynthesis || null;
    if (synth) { try { synth.getVoices(); if (synth.addEventListener) synth.addEventListener('voiceschanged', function () { synth.getVoices(); }); } catch (e) {} }
    function pickVoice(male) {
      var vs = synth ? (synth.getVoices() || []) : [];
      var en = vs.filter(function (v) { return /^en/i.test(v.lang); });
      if (!en.length) return null;
      var names = male
        ? [/guy/i, /davis/i, /ryan/i, /daniel/i, /david/i, /alex/i, /fred/i, /mark/i, /google uk english male/i, /male/i]
        : [/aria/i, /jenny/i, /ava/i, /samantha/i, /allison/i, /joanna/i, /zira/i, /google us english/i, /karen/i, /moira/i, /tessa/i, /female/i];
      var pools = [en.filter(function (v) { return /natural|online/i.test(v.name); }), en];
      for (var p = 0; p < pools.length; p++) for (var i = 0; i < names.length; i++) for (var j = 0; j < pools[p].length; j++) if (names[i].test(pools[p][j].name)) return pools[p][j];
      return null;
    }
    function voiceBusy() { return performance.now() < voiceEnd; }
    function talkLen(s) { return 0.25 + s.length * 0.055; }
    function playClip(a) { if (!a) return; try { a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
    function speak(text, v, pitch, rate, clipKey) {
      if (!soundOn) return;
      var clip = clips[clipKey];
      duckMusic(text.length * 70 + 900);
      var tok = ++voiceTok;
      voiceEnd = performance.now() + talkLen(text) * 1400;
      if (clip) clip.onended = function () { if (tok === voiceTok) voiceEnd = performance.now(); };
      if (!v) { playClip(clip); return; }
      var started = false;
      try {
        var u = new SpeechSynthesisUtterance(text);
        u.voice = v; u.lang = v.lang; u.pitch = pitch; u.rate = rate; u.volume = 1;
        u.onstart = function () { started = true; };
        u.onend = function () { if (tok === voiceTok) voiceEnd = performance.now(); };
        u.onerror = function () { if (!started) { started = true; playClip(clip); } };
        synth.cancel(); synth.speak(u);
        setTimeout(function () { if (!started) { started = true; synth.cancel(); playClip(clip); } }, 900);
      } catch (e) { playClip(clip); }
    }
    function talking() {
      if (sp.playing && sp.said && sp.t < SP.sayAt + talkLen('Good luck finding the pineapple!')) return true;
      if (cur && cur.said && cur.t < cur.sayAt + talkLen(cur.line)) return true;
      if (pn.playing && pn.said && pn.t < PN.sayAt + talkLen(PN.line)) return true;
      return false;
    }

    /* ---- drawing ---- */
    function size() {
      var dpr = global.devicePixelRatio || 1, w = canvas.clientWidth || VIEW_W;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * dpr * VIEW_H / VIEW_W);
    }
    function bubbleAt(tipX, tipY, t, dur, S, shiftX, tail) {
      if (t < 0 || t > dur) return;
      tail = tail || 38;
      var rows = S.map.length, cols = S.map[0].length;
      var pop = Math.min(1, t / 0.18), out = Math.min(1, (dur - t) / 0.25);
      var bw = 104, bh = 92, r = 18;
      var bx = Math.max(6, Math.min(VIEW_W - bw - 6, tipX - bw / 2 + shiftX)), by = tipY - bh - tail;
      var t0 = Math.max(bx + r + 4, Math.min(bx + bw - r - 32, tipX - 18));
      ctx.save(); ctx.globalAlpha = out;
      ctx.translate(tipX, tipY); ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop); ctx.translate(-tipX, -tipY);
      ctx.beginPath();
      ctx.moveTo(bx + r, by); ctx.lineTo(bx + bw - r, by); ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
      ctx.lineTo(bx + bw, by + bh - r); ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
      ctx.lineTo(t0 + 30, by + bh); ctx.lineTo(tipX, tipY); ctx.lineTo(t0, by + bh);
      ctx.lineTo(bx + r, by + bh); ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
      ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by); ctx.closePath();
      ctx.fillStyle = '#FBFAF6'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#141414'; ctx.lineJoin = 'round'; ctx.stroke();
      var cell = 6, hx = Math.round(bx + (bw - cols * cell) / 2), hy = Math.round(by + (bh - rows * cell) / 2);
      var on = function (a, b) { return a >= 0 && a < rows && b >= 0 && b < cols && S.map[a].charAt(b) !== '.'; };
      ctx.fillStyle = '#141414';
      for (var a = -1; a <= rows; a++) for (var b = -1; b <= cols; b++)
        if (!on(a, b) && (on(a - 1, b) || on(a + 1, b) || on(a, b - 1) || on(a, b + 1))) ctx.fillRect(hx + b * cell, hy + a * cell, cell, cell);
      for (var a2 = 0; a2 < rows; a2++) for (var b2 = 0; b2 < cols; b2++) {
        if (!on(a2, b2)) continue;
        ctx.fillStyle = S.color(a2, b2, S.map[a2].charAt(b2)); ctx.fillRect(hx + b2 * cell, hy + a2 * cell, cell, cell);
      }
      ctx.restore();
    }
    function personBubble(cam, t) {
      if (t < SP.bubbleFrom || t > SP.bubbleTo) return;
      var pop = Math.min(1, (t - SP.bubbleFrom) / 0.18), out = Math.min(1, (SP.bubbleTo - t) / 0.2);
      var tipX = 592 - cam, tipY = 250, bw = 150, bh = 62, bx = 610 - cam, by = 150, r = 20;
      ctx.save(); ctx.globalAlpha = out;
      ctx.translate(tipX, tipY); ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop); ctx.translate(-tipX, -tipY);
      ctx.beginPath();
      ctx.moveTo(bx + r, by); ctx.lineTo(bx + bw - r, by); ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
      ctx.lineTo(bx + bw, by + bh - r); ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
      ctx.lineTo(bx + 52, by + bh); ctx.lineTo(tipX, tipY); ctx.lineTo(bx + 22, by + bh);
      ctx.lineTo(bx + r, by + bh); ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
      ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by); ctx.closePath();
      ctx.fillStyle = '#FBFAF6'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#141414'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.fillStyle = '#141414'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '20px ' + FONT;
      ctx.fillText('suerte', bx + bw / 2, by + bh / 2 + 2);
      ctx.restore();
    }
    function wrap(text, maxW) {
      var words = text.split(' '), lines = [], line = '';
      words.forEach(function (w) { var test = line ? line + ' ' + w : w; if (line && ctx.measureText(test).width > maxW) { lines.push(line); line = w; } else line = test; });
      if (line) lines.push(line); return lines;
    }
    function drawCredits() {
      var a = Math.min(1, cr.t / 1.0), gy = VIEW_H - CR.ch * CR.s;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = CR.bg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      var f = Math.floor(cr.t * CR.fps) % CR.frames;
      ctx.drawImage(im.cred, (f % CR.cols) * CR.cw, Math.floor(f / CR.cols) * CR.ch, CR.cw, CR.ch, 0, gy, VIEW_W, CR.ch * CR.s);
      var g = ctx.createLinearGradient(0, gy, 0, gy + 50); g.addColorStop(0, CR.bg); g.addColorStop(1, 'rgba(243,245,249,0)');
      ctx.fillStyle = g; ctx.fillRect(0, gy, VIEW_W, 50);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '18px ' + FONT;
      var lines = wrap(CR.line1, 700), y = 92;
      ctx.globalAlpha = a * Math.max(0, Math.min(1, (cr.t - 1.2) / 0.8)); ctx.fillStyle = '#34465A';
      lines.forEach(function (ln) { ctx.fillText(ln, VIEW_W / 2, y); y += 36; });
      ctx.font = '24px ' + FONT; ctx.globalAlpha = a * Math.max(0, Math.min(1, (cr.t - 3.6) / 0.8)); ctx.fillStyle = '#F0587C';
      ctx.fillText(CR.line2, VIEW_W / 2, y + 22);
      ctx.restore();
    }
    function draw() {
      var s = canvas.width / VIEW_W, levelW = im.bg.naturalWidth;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      var cam = Math.max(0, Math.min(levelW - VIEW_W, state.x - VIEW_W / 2));
      ctx.drawImage(im.bg, -cam, 0, levelW, VIEW_H);
      var total = SP.frames / SP.fps;
      var ca = sp.playing ? Math.max(0, Math.min(1, sp.t / SP.fade, (total - sp.t) / SP.fade)) : 0;
      if (ca < 1) { ctx.globalAlpha = 1 - ca; ctx.drawImage(im.idle, SP.idleX - cam, SP.idleY); }
      if (ca > 0) {
        var sf = Math.min(SP.frames - 1, Math.floor(sp.t * SP.fps)); ctx.globalAlpha = ca;
        ctx.drawImage(im.spr, (sf % SP.cols) * SP.cw, Math.floor(sf / SP.cols) * SP.ch, SP.cw, SP.ch, SP.x - cam, SP.y, SP.cw * SP.scale, SP.ch * SP.scale);
      }
      ctx.globalAlpha = 1;
      var pf = pn.done ? PN.hold : (pn.playing ? Math.min(PN.hold, Math.floor(pn.t / PN.dur * PN.frames)) : 0);
      ctx.drawImage(im.pine, (pf % PN.cols) * PN.cw, Math.floor(pf / PN.cols) * PN.ch, PN.cw, PN.ch, PN.x - PN.cx * PN.s - cam, PN.bottom - PN.baseY * PN.s, PN.cw * PN.s, PN.ch * PN.s);
      var sc = 0.70, w = CELL_W * sc, h = CELL_H * sc, px = state.x - cam, py = VIEW_H + FOOT_PAD * sc;
      var f = state.moving ? Math.floor(state.t * 24) % FRAMES : 0;
      ctx.save(); ctx.translate(px, py - h); ctx.scale(state.face, 1);
      ctx.drawImage(im.duck, (f % COLS) * CELL_W, Math.floor(f / COLS) * CELL_H, CELL_W, CELL_H, -w / 2, 0, w, h);
      ctx.restore();
      if (sp.playing) personBubble(cam, sp.t);
      if (cur) bubbleAt(px + state.face * 58, py - h + 36, cur.t, cur.dur, cur.sprite, 0);
      if (pn.playing && pn.t >= PN.bubbleFrom && pn.t <= PN.bubbleTo) {
        var pfb = Math.min(PN.hold, Math.floor(pn.t / PN.dur * PN.frames));
        var crown = PN.bottom - (PN.baseY - PN.tops[pfb]) * PN.s;
        bubbleAt(PN.x - cam, Math.max(108, crown - 4), pn.t - PN.bubbleFrom, PN.bubbleTo - PN.bubbleFrom, SPR_TROPHY, 0, 12);
      }
      if (cr.on) drawCredits();
      if (posEl) posEl.textContent = 'x ' + Math.round(state.x) + ' / ' + levelW;
    }

    /* ---- update ---- */
    var last = performance.now();
    function frame(now) {
      if (dead) return;
      rafId = requestAnimationFrame(frame);
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (paused) return;
      var dx = cr.on ? 0 : (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (LOCK && talking()) dx = 0;
      state.moving = dx !== 0;
      if (dx) state.face = dx;
      state.x = Math.max(60, Math.min(im.bg.naturalWidth - 60, state.x + dx * SPEED * dt));
      if (state.moving) state.t += dt;
      var dist = Math.abs(state.x - SP.center);
      if (!sp.playing && sp.armed && dist < SP.near) { sp.playing = true; sp.armed = false; sp.t = 0; sp.said = false; emit('greeting'); }
      if (sp.playing) {
        sp.t += dt;
        if (!sp.said && sp.t >= SP.sayAt && !voiceBusy()) { sp.said = true; speak('Good luck finding the pineapple!', pickVoice(), 1.3, 1.04, 'person'); }
        if (sp.t * SP.fps >= SP.frames) sp.playing = false;
      }
      if (!sp.armed && !sp.playing && dist > SP.far) sp.armed = true;
      DT.forEach(function (d) {
        var fd = Math.abs(state.x - d.x);
        if (d.armed && fd < d.reach) { d.armed = false; if (pending.indexOf(d) < 0) pending.push(d); }
        else if (!d.armed && d !== cur && pending.indexOf(d) < 0 && fd > d.rearm) d.armed = true;
      });
      var personNext = sp.playing && !sp.said;
      if (pending.length && !personNext && !voiceBusy() && (!cur || cur.said)) { cur = pending.shift(); cur.t = 0; cur.said = false; emit('duckLine', { id: cur.id }); }
      if (cur) {
        cur.t += dt;
        if (!cur.said && cur.t >= cur.sayAt) { cur.said = true; speak(cur.line, pickVoice(true) || pickVoice(), 1.8, 1.08, cur.clip); }
        if (cur.t > cur.dur) cur = null;
      }
      var pd = Math.abs(state.x - PN.trigger);
      if (pn.armed && pd < PN.reach) { pn.armed = false; pn.playing = true; pn.t = 0; pn.said = false; emit('pineapple'); }
      if (pn.playing) {
        pn.t += dt;
        if (!pn.said && pn.t >= PN.sayAt && !voiceBusy()) { pn.said = true; speak(PN.line, pickVoice(true) || pickVoice(), 1.0, 0.95, 'pine'); }
        if (pn.t >= PN.dur) { pn.playing = false; pn.done = true; emit('pineappleDone'); if (!cr.started) { cr.started = true; cr.wait = 0.8; } }
      }
      if (cr.wait > 0) { cr.wait -= dt; if (cr.wait <= 0) { cr.on = true; cr.t = 0; emit('credits'); } }
      if (cr.on) {
        cr.t += dt;
        if (cr.t > 5 && !cr.finished) { cr.finished = true; if (btnReplay) btnReplay.hidden = false; emit('finished'); }
      }
      draw();
    }

    /* ---- input and lifecycle ---- */
    var KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    function onKeyDown(e) { var k = KEYMAP[e.key]; if (k && !paused) { keys[k] = true; e.preventDefault(); } }
    function onKeyUp(e) { var k = KEYMAP[e.key]; if (k) keys[k] = false; }
    function onBlur() { keys = {}; }
    function onResize() { size(); }
    if (opts.keyboard !== false) { global.addEventListener('keydown', onKeyDown); global.addEventListener('keyup', onKeyUp); global.addEventListener('blur', onBlur); }
    global.addEventListener('keydown', unlock); global.addEventListener('pointerdown', unlock);
    global.addEventListener('resize', onResize);
    var ro = global.ResizeObserver ? new ResizeObserver(onResize) : null; if (ro) ro.observe(stage);
    if (global.document && document.fonts && document.fonts.load) document.fonts.load('20px "Press Start 2P"');

    function destroy() {
      dead = true; cancelAnimationFrame(rafId);
      global.removeEventListener('keydown', onKeyDown); global.removeEventListener('keyup', onKeyUp); global.removeEventListener('blur', onBlur);
      global.removeEventListener('keydown', unlock); global.removeEventListener('pointerdown', unlock); global.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
      try { if (mSrc) mSrc.stop(); if (actx) actx.close(); } catch (e) {}
      if (synth) { try { synth.cancel(); } catch (e) {} }
      if (root.parentNode) root.parentNode.removeChild(root);
    }
    return {
      destroy: destroy, restart: restart, setSound: setSound, setMusic: setMusic, canvas: canvas,
      pause: function () { paused = true; setMusicGain(); }, resume: function () { paused = false; last = performance.now(); setMusicGain(); },
      get x() { return state.x; }
    };
  }
  global.DuckScroller = { mount: mount, version: 1 };
})(window);
