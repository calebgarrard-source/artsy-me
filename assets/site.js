/* Artsy Me, Evans GA. Concept site. Plain script, no build step. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const TAU = Math.PI * 2;
  const money = n => '$' + n.toLocaleString('en-US');

  /* ------------------------------------------------------------------ header */

  const top = $('[data-top]');
  const menu = $('#menu');
  const menuBtn = $('[data-menu-open]');
  const solid = () => top.classList.toggle('is-solid', scrollY > 24);
  addEventListener('scroll', solid, { passive: true });
  solid();

  /* the nav marks the part of the page you are in */
  const navLinks = $$('.top__nav a');
  const navFor = { pick: '#pick', paint: '#pick', gallery: '#gallery', parties: '#parties', classes: '#classes', story: '#story', visit: '#visit' };
  const navSecs = $$('main > section[id]');
  let navAt = null, navQueued = false;
  const markNav = () => {
    navQueued = false;
    let sec = null;
    for (const el of navSecs) { if (el.getBoundingClientRect().top <= innerHeight * .4) sec = el; else break; }
    const href = sec ? navFor[sec.id] || null : null;
    if (href === navAt) return;
    navAt = href;
    navLinks.forEach(a => { if (a.getAttribute('href') === href) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  };
  addEventListener('scroll', () => { if (!navQueued) { navQueued = true; requestAnimationFrame(markNav); } }, { passive: true });
  addEventListener('resize', markNav);
  markNav();

  function setMenu(open) {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
    top.classList.toggle('is-menu', open);
    root.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); }
  });
  matchMedia('(min-width: 961px)').addEventListener('change', e => { if (e.matches && !menu.hidden) setMenu(false); });

  /* in-page links glide; keyboard focus still jumps straight to its target */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const el = document.getElementById(a.getAttribute('href').slice(1));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', a.getAttribute('href'));
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });

  /* ------------------------------------------------------- open now, Eastern */

  const HOURS = {
    evans: { 0: null, 1: [10, 18], 2: [10, 18], 3: [10, 18], 4: [10, 18], 5: [10, 18], 6: [10, 18] },
    grovetown: { 0: null, 1: null, 2: null, 3: null, 4: [12, 18], 5: [10, 18], 6: [10, 18] },
  };
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function eastern() {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      const get = t => parts.find(p => p.type === t).value;
      let h = +get('hour');
      if (h === 24) h = 0;
      return { day: SHORT.indexOf(get('weekday')), t: h + (+get('minute')) / 60 };
    } catch (err) {
      return null;
    }
  }
  const clock = h => (((h + 11) % 12) + 1) + (h >= 12 ? ' pm' : ' am');

  function statusOf(key, now) {
    const H = HOURS[key];
    const today = H[now.day];
    if (today && now.t >= today[0] && now.t < today[1]) return { open: true, text: 'Open now until ' + clock(today[1]) };
    if (today && now.t < today[0]) return { open: false, text: 'Opens today at ' + clock(today[0]) };
    for (let i = 1; i <= 7; i++) {
      const d = (now.day + i) % 7;
      if (H[d]) return { open: false, text: 'Closed now. Opens ' + (i === 1 ? 'tomorrow' : DAYS[d]) + ' at ' + clock(H[d][0]) };
    }
    return null;
  }

  function paintStatus() {
    const now = eastern();
    if (!now) return;
    $$('[data-status]').forEach(el => {
      const s = statusOf(el.dataset.status, now);
      if (!s) return;
      el.classList.toggle('is-open', s.open);
      $('[data-status-text]', el).textContent = s.text;
    });
    $$('[data-week] li').forEach(li => li.classList.toggle('is-today', +li.dataset.day === now.day));
  }
  paintStatus();
  setInterval(paintStatus, 60000);

  /* ------------------------------------------------------------ paint bench */

  const stage = $('[data-stage]');
  const canvas = $('[data-canvas]');

  if (stage && canvas && canvas.getContext && window.Path2D) {
    const ctx = canvas.getContext('2d');
    const kit = $('[data-kit]');
    const firedPanel = $('[data-fired]');
    const dayEl = $('[data-day]');
    const tipEl = $('[data-tip]');
    const nameEl = $('[data-color-name]');
    const undoBtn = $('[data-undo]');
    const clearBtn = $('[data-clear]');
    const autoBtn = $('[data-auto]');
    const fireBtn = $('[data-fire]');
    const rackBtns = $$('[data-rack] button');
    const shelfBtns = $$('.piece');

    const CHALK = [239, 233, 220];
    const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const mixHex = (h, to, t) => 'rgb(' + hexRgb(h).map((v, i) => Math.round(v + (to[i] - v) * t)).join(',') + ')';
    const PAL = [
      ['Yellow', '#f7c417'], ['Orange', '#f1701f'], ['Red', '#d42a1c'], ['Pink', '#ee4f8e'], ['Lime', '#9fcf2e'],
      ['Green', '#1f9a54'], ['Turquoise', '#00a8c6'], ['Blue', '#1f4fb4'], ['Black', '#1c1b1a'], ['White', '#ffffff'],
    ].map(([name, fired]) => ({ name, fired, raw: name === 'White' ? '#ffffff' : mixHex(fired, CHALK, .46) }));

    const SIZES = { brush: [5, 10, 18], dots: [3.2, 5.5, 9], band: [6, 12, 22] };
    const showTip = () => {
      const key = state.tool === 'band' && pc.band === 'ring' ? 'ring' : state.tool;
      $$('span', tipEl).forEach(sp => { sp.hidden = sp.dataset.for !== key; });
    };
    const NAMES = { mug: 'mug', plate: 'plate', mushroom: 'mushroom', gnome: 'gnome', pig: 'piggy bank', pot: 'flower pot', heart: 'heart dish', tree: 'tree' };
    const BBOX = {
      mug: [46, 51, 141, 137], plate: [16, 20, 168, 168], mushroom: [20, 30, 160, 158], gnome: [38, 6, 124, 182],
      pig: [28, 48, 164, 140], pot: [28, 54, 144, 134], heart: [16, 28, 168, 158], tree: [32, 12, 136, 176],
    };
    const COMBOS = [[6, 9, 7], [3, 2, 9], [0, 1, 5], [4, 5, 0], [7, 6, 0], [2, 9, 8], [1, 0, 3], [5, 4, 9], [6, 0, 3], [7, 9, 3]];
    const BISQUE = '#f7f4ef';
    const BLOB = $('.stage__blob path').getAttribute('d');

    /* one piece, read from the page's own <symbol> */
    const pieces = {};
    function readPiece(id) {
      if (pieces[id]) return pieces[id];
      const sym = document.getElementById('pc-' + id);
      const parts = $$('[data-part]', sym).map(el => ({
        type: el.dataset.part,
        path: new Path2D(el.getAttribute('d')),
        fill: el.getAttribute('fill') || '',
        opacity: +(el.getAttribute('fill-opacity') || 1),
        stroke: el.getAttribute('stroke') || '',
        sw: +(el.getAttribute('stroke-width') || 0),
        scale: +(el.dataset.scale || 1),
      }));
      const body = new Path2D();
      parts.filter(p => p.type === 'body').forEach(p => body.addPath(p.path));
      /* the part that would turn on a banding wheel, where that is not the whole piece: a mug's cup without its handle */
      const turns = $('[data-wheel]', sym);
      return (pieces[id] = {
        id, parts, body, band: sym.dataset.band, c: (sym.dataset.c || '100,100').split(',').map(Number), bbox: BBOX[id],
        wheel: turns ? turns.dataset.wheel.split(',').map(Number) : null,
        cup: turns ? new Path2D(turns.getAttribute('d')) : null,
      });
    }

    /* the line a stripe follows across a piece at height y, as one curve: [x0, y0, cx, cy, x1, y1].
       On a piece with a wheel part the stripe sags around that part's own middle, the way the rim does, not around the middle of cup plus handle */
    const bandLine = (pc, y) => {
      const [bx, , bw] = pc.bbox;
      if (!pc.wheel) return [bx - 14, y, bx + bw / 2, y + bw * .13, bx + bw + 14, y];
      const [wx, ww] = pc.wheel;
      return [wx - 14, y - ww * .02, wx + ww / 2, y + ww * .23, wx + ww + 14, y - ww * .02];
    };
    const bandY = (pc, px, y) => {
      const [x0, y0, , cy, x1] = bandLine(pc, y);
      const t = Math.min(1, Math.max(0, (px - x0) / (x1 - x0)));
      return y0 + 2 * t * (1 - t) * (cy - y0);
    };

    /* a rig: the offscreen layers for one output size */
    function makeRig(size) {
      const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
      return { size, s: size / 240, base: mk(), piece: mk(), paint: mk(), fire: mk(), tmp: mk(), shade: mk(), over: mk(), gloss: mk() };
    }
    const U = (rig, x) => x.setTransform(rig.s, 0, 0, rig.s, 20 * rig.s, 20 * rig.s);
    const R = x => x.setTransform(1, 0, 0, 1, 0, 0);
    const keepInside = (rig, x) => { R(x); x.globalAlpha = 1; x.globalCompositeOperation = 'destination-in'; x.drawImage(rig.base, 0, 0); x.globalCompositeOperation = 'source-over'; };

    function buildPiece(rig, pc) {
      const { s, size } = rig;
      const [bx, by, bw, bh] = pc.bbox;
      const span = Math.max(bw, bh);
      const bodies = pc.parts.filter(p => p.type === 'body');

      /* base: the whole silhouette in bisque. Every other layer is cut to it, so joined parts never show a seam */
      let x = rig.base.getContext('2d');
      R(x); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, size, size);
      U(rig, x); x.fillStyle = BISQUE;
      bodies.forEach(p => x.fill(p.path));

      /* shade: multiplied over the paint so color follows the form */
      x = rig.shade.getContext('2d');
      R(x); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, size, size);
      U(rig, x);
      const g = x.createLinearGradient(bx, by, bx + bw, by + bh);
      g.addColorStop(0, '#ffffff'); g.addColorStop(.5, '#f4f1ec'); g.addColorStop(1, '#d9d3c9');
      x.fillStyle = g; x.fillRect(bx - 6, by - 6, bw + 12, bh + 12);
      const inv = document.createElement('canvas'); inv.width = inv.height = size;
      const ix = inv.getContext('2d');
      ix.fillStyle = '#000'; ix.fillRect(0, 0, size, size);
      ix.globalCompositeOperation = 'destination-out'; ix.drawImage(rig.base, 0, 0);
      const OFF = size * 3;
      R(x);
      x.shadowColor = 'rgba(58, 46, 32, .46)'; x.shadowBlur = 13 * s;
      x.shadowOffsetX = OFF - 4 * s; x.shadowOffsetY = -5 * s;
      x.drawImage(inv, -OFF, 0);
      x.shadowColor = 'rgba(58, 46, 32, .5)'; x.shadowBlur = 2.4 * s;
      x.shadowOffsetX = OFF - .6 * s; x.shadowOffsetY = -.8 * s;
      x.drawImage(inv, -OFF, 0);
      x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetX = x.shadowOffsetY = 0;
      keepInside(rig, x);

      /* over: a matte sheen, then the details that paint cannot cover */
      x = rig.over.getContext('2d');
      R(x); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, size, size);
      U(rig, x);
      const hl = x.createRadialGradient(bx + bw * .3, by + bh * .24, 0, bx + bw * .3, by + bh * .24, span * .5);
      hl.addColorStop(0, 'rgba(255,255,255,.3)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = hl; x.fillRect(bx, by, bw, bh);
      keepInside(rig, x);
      U(rig, x);
      pc.parts.forEach(p => {
        if (p.type === 'body') return;
        x.save();
        if (p.scale !== 1) { x.translate(pc.c[0], pc.c[1]); x.scale(p.scale, p.scale); x.translate(-pc.c[0], -pc.c[1]); }
        if (p.type === 'line') { x.strokeStyle = 'rgba(92, 80, 62, .4)'; x.lineWidth = p.sw; x.lineCap = 'round'; x.stroke(p.path); }
        else if (p.type === 'extra') { x.strokeStyle = p.stroke; x.lineWidth = p.sw; x.lineCap = 'round'; x.stroke(p.path); }
        else if (p.type === 'shade') { x.globalAlpha = p.opacity; x.fillStyle = p.fill; x.fill(p.path); }
        else if (p.fill.indexOf('url(') === 0) {
          const ig = x.createLinearGradient(bx, by, bx + bw * .7, by + 24);
          ig.addColorStop(0, '#b3ab9e'); ig.addColorStop(1, '#e4dfd6');
          x.fillStyle = ig; x.fill(p.path);
        } else { x.fillStyle = p.fill; x.fill(p.path); }
        x.restore();
      });

      /* gloss: only shown after firing */
      x = rig.gloss.getContext('2d');
      R(x); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, size, size);
      U(rig, x);
      const g1 = x.createRadialGradient(bx + bw * .28, by + bh * .2, 0, bx + bw * .28, by + bh * .2, span * .46);
      g1.addColorStop(0, 'rgba(255,255,255,.5)'); g1.addColorStop(.5, 'rgba(255,255,255,.1)'); g1.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g1; x.fillRect(bx, by, bw, bh);
      const streak = (fx, fy, rot, len, r, a) => {
        x.save();
        x.translate(bx + bw * fx, by + bh * fy); x.rotate(rot); x.scale(1, len);
        const gs = x.createRadialGradient(0, 0, 0, 0, 0, r);
        gs.addColorStop(0, 'rgba(255,255,255,' + a + ')'); gs.addColorStop(.55, 'rgba(255,255,255,' + a * .45 + ')'); gs.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = gs; x.fillRect(-r, -r, r * 2, r * 2);
        x.restore();
      };
      streak(.27, .26, .42, 4.4, span * .034, .95);
      streak(.2, .52, .3, 2.2, span * .018, .6);
      streak(.82, .8, .5, 3, span * .016, .32);
      keepInside(rig, x);
    }

    const rand = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    const alphaOf = (op, fired) => (op.t === 'dots' ? (fired ? 1 : .94) : (fired ? .9 : .74));

    function brushPath(pts) {
      const p = new Path2D();
      p.moveTo(pts[0][0], pts[0][1]);
      if (pts.length === 1) { p.lineTo(pts[0][0] + .01, pts[0][1] + .01); return p; }
      for (let i = 1; i < pts.length - 1; i++) {
        p.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      }
      const l = pts[pts.length - 1];
      p.lineTo(l[0], l[1]);
      return p;
    }

    /* draws one stroke, opaque, onto a cleared layer */
    function drawOp(rig, x, op, fired, pc) {
      U(rig, x);
      const col = fired ? PAL[op.c].fired : PAL[op.c].raw;
      x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
      if (op.t === 'dots') {
        x.fillStyle = col;
        op.p.forEach(p => { x.beginPath(); x.arc(p[0], p[1], op.w, 0, TAU); x.fill(); });
        return;
      }
      const [bx, , bw] = pc.bbox;
      const streaks = op.w > 8 ? 3 : 2;
      x.strokeStyle = col; x.lineCap = 'round'; x.lineJoin = 'round';

      if (op.t === 'band' && op.ring) {
        const ringAt = (k, w) => {
          x.save();
          x.translate(pc.c[0], pc.c[1]); x.scale(k, k); x.translate(-pc.c[0], -pc.c[1]);
          x.lineWidth = w / k; x.stroke(pc.body);
          x.restore();
        };
        ringAt(op.k, op.w);
        x.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < streaks; i++) {
          x.globalAlpha = (fired ? .06 : .2) + rand(op.seed + i) * (fired ? .05 : .16);
          ringAt(Math.max(.03, op.k + (rand(op.seed + i * 7.3) - .5) * op.w * .008), Math.max(.6, op.w * .07));
        }
      } else {
        let path, onCup = false;
        if (op.t === 'band') {
          const [x0, y0, cx, cy, x1, y1] = bandLine(pc, op.y);
          path = new Path2D();
          path.moveTo(x0, y0);
          path.quadraticCurveTo(cx, cy, x1, y1);
          /* a fine stripe stays on the part that turns; a wide coat carries on across the handle */
          if (pc.wheel && op.w < 10) { onCup = true; x.save(); x.clip(pc.cup); }
          else if (pc.wheel) path.lineTo(bx + bw + 14, y1);
        } else {
          path = brushPath(op.p);
        }
        x.lineWidth = op.w; x.stroke(path);
        x.globalCompositeOperation = 'destination-out';
        x.lineWidth = Math.max(.6, op.w * .07);
        for (let i = 0; i < streaks; i++) {
          const off = (rand(op.seed + i * 7.3) - .5) * op.w * .66;
          x.globalAlpha = (fired ? .06 : .2) + rand(op.seed + i) * (fired ? .05 : .16);
          x.save(); x.translate(off * .7, off * .7); x.stroke(path); x.restore();
        }
        if (onCup) x.restore();
      }
      x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    }

    function stamp(rig, target, op, fired, pc) {
      const m = rig.tmp.getContext('2d');
      R(m); m.clearRect(0, 0, rig.size, rig.size);
      drawOp(rig, m, op, fired, pc);
      const t = target.getContext('2d');
      R(t); t.globalAlpha = alphaOf(op, fired); t.drawImage(rig.tmp, 0, 0); t.globalAlpha = 1;
      R(m); m.clearRect(0, 0, rig.size, rig.size);
    }

    function renderOps(rig, target, ops, fired, pc) {
      const t = target.getContext('2d');
      R(t); t.clearRect(0, 0, rig.size, rig.size);
      ops.forEach(op => stamp(rig, target, op, fired, pc));
    }

    function compose(rig, x, pc, st) {
      const { size } = rig;
      const [bx, , bw] = pc.bbox;
      /* the piece: bisque, paint only where the bisque is, then the shading multiplied over both */
      const p = rig.piece.getContext('2d');
      R(p); p.globalAlpha = 1; p.globalCompositeOperation = 'source-over';
      p.clearRect(0, 0, size, size);
      p.drawImage(rig.base, 0, 0);
      p.globalCompositeOperation = 'source-atop';
      if (st.fireP < 1) p.drawImage(rig.paint, 0, 0);
      if (st.fireP > 0) { p.globalAlpha = st.fireP; p.drawImage(rig.fire, 0, 0); }
      if (st.active) { p.globalAlpha = st.activeAlpha; p.drawImage(rig.tmp, 0, 0); }
      p.globalAlpha = 1; p.globalCompositeOperation = 'multiply'; p.drawImage(rig.shade, 0, 0);
      if (st.heatP > 0) { p.globalCompositeOperation = 'source-atop'; p.globalAlpha = st.heatP * .3; p.fillStyle = '#ff8a2a'; p.fillRect(0, 0, size, size); }
      p.globalAlpha = 1; p.globalCompositeOperation = 'source-over';

      R(x); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
      x.clearRect(0, 0, size, size);
      U(rig, x);
      x.save();
      x.translate(bx + bw / 2, 190); x.scale(1, .15);
      const sh = x.createRadialGradient(0, 0, 0, 0, 0, bw * .62);
      const sc = st.shadow || '0, 38, 50';
      sh.addColorStop(0, 'rgba(' + sc + ', ' + (st.shadowA === undefined ? .46 : st.shadowA) + ')'); sh.addColorStop(1, 'rgba(' + sc + ', 0)');
      x.fillStyle = sh; x.beginPath(); x.arc(0, 0, bw * .62, 0, TAU); x.fill();
      x.restore();
      R(x);
      x.drawImage(rig.piece, 0, 0);
      x.drawImage(rig.over, 0, 0);
      if (st.glossP > 0) { x.globalAlpha = st.glossP; x.drawImage(rig.gloss, 0, 0); x.globalAlpha = 1; }
    }

    /* ---- recipes for "Paint it for me" ---- */
    const pickOne = arr => arr[(Math.random() * arr.length) | 0];
    function recipe(pc) {
      const [bx, by, bw, bh] = pc.bbox;
      const ops = [];
      const S = () => Math.random() * 999;
      const band = (c, y, w) => ops.push({ t: 'band', c, w, y, seed: S() });
      const ring = (c, k, w) => ops.push({ t: 'band', ring: true, c, w, k, seed: S() });
      const dots = (c, w, p) => ops.push({ t: 'dots', c, w, p });

      if (pc.id === 'mushroom') {
        const cap = pickOne([2, 3, 1]);
        for (let y = 24; y < 132; y += 14) band(cap, y, 22);
        dots(9, 9, [[62, 86], [118, 64], [150, 102]]);
        dots(9, 5.5, [[92, 52], [86, 110], [126, 106], [42, 110], [158, 80]]);
        band(pickOne([0, 4, 6]), 178, 6);
        return ops;
      }
      if (pc.id === 'tree') {
        for (let y = 18; y < 160; y += 14) band(5, y, 22);
        band(2, 174, 22);
        dots(0, 5.5, [[100, 44], [76, 92], [128, 124]]);
        dots(2, 5.5, [[112, 84], [62, 136], [100, 144]]);
        dots(7, 5.5, [[90, 118], [140, 142], [118, 52]]);
        dots(9, 3.2, [[84, 70], [124, 98], [78, 142], [146, 126], [100, 104]]);
        return ops;
      }
      const [A, B, C] = pickOne(COMBOS);
      if (pc.id === 'gnome') {
        const coat = B === 9 ? C : B;
        for (let y = 12; y < 104; y += 14) band(A, y, 22);
        for (let y = 118; y < 196; y += 14) band(coat, y, 22);
        band(9, 105, 7);
        if (A !== 9) dots(9, 3.2, [[100, 34], [92, 58], [112, 66], [78, 82], [100, 86], [124, 88]]);
        /* the beard, in the strokes a brush would make */
        const stroke = (w, p) => ops.push({ t: 'brush', c: 9, w, p, seed: S() });
        stroke(24, [[72, 120], [70, 138], [78, 156], [88, 166]]);
        stroke(24, [[128, 120], [130, 138], [122, 156], [112, 166]]);
        stroke(26, [[88, 124], [88, 150], [94, 166]]);
        stroke(26, [[112, 124], [112, 150], [106, 166]]);
        stroke(22, [[100, 128], [100, 172]]);
        dots(pickOne([3, 1]), 11.5, [[100, 114]]);
        dots(8, 8.5, [[79, 186], [121, 186]]);
        return ops;
      }
      if (pc.band === 'ring') {
        for (let k = 1.02; k > .1; k -= .15) ring(A, k, 26);
        ring(B, .86, 7); ring(B, .66, 3.5);
        const plate = pc.id === 'plate';
        const n = plate ? 16 : 12, r = plate ? 63 : 38, pts = [];
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU; pts.push([pc.c[0] + Math.cos(a) * r, pc.c[1] + (plate ? 0 : -6) + Math.sin(a) * r]); }
        dots(C, plate ? 4.5 : 3.6, pts);
        dots(B, 9, [[pc.c[0], pc.c[1] + (plate ? 0 : -6)]]);
        return ops;
      }
      for (let y = by + 3; y < by + bh + 8; y += 14) band(A, y, 22);
      band(B, by + bh * .2, 7); band(B, by + bh * .2 + 10, 3);
      band(B, by + bh * .84, 7);
      const y0 = by + bh * .52, pts = [];
      if (pc.wheel) {
        /* a row of dots keeps to the cup and follows the same line the stripes do */
        const [wx, ww] = pc.wheel, n = Math.floor((ww - 16) / 15);
        for (let i = 0; i <= n; i++) { const px = wx + (ww - n * 15) / 2 + i * 15; pts.push([px, bandY(pc, px, y0)]); }
      } else {
        for (let px = bx + 8; px < bx + bw; px += 15) pts.push([px, y0 + Math.sin(((px - bx) / bw) * Math.PI) * bw * .06]);
      }
      dots(C, 4.6, pts);
      return ops;
    }

    /* ---- the live bench ---- */
    const state = { tool: 'brush', color: 0, size: 1 };
    const store = {};
    const anim = { fireP: 0, glossP: 0, heatP: 0 };
    let rig = null, pc = readPiece('mug'), cur = (store.mug = { ops: [], fired: false });
    let active = null, pointer = null, busy = false, armed = false, raf = 0, tap = null;
    const coarse = matchMedia('(pointer: coarse)');

    const request = () => { if (!raf) raf = requestAnimationFrame(frame); };

    function frame() {
      raf = 0;
      if (!rig) return;
      compose(rig, ctx, pc, { fireP: anim.fireP, glossP: anim.glossP, heatP: anim.heatP, active: !!active, activeAlpha: active ? alphaOf(active, false) : 0 });
      if (pointer && !active && !cur.fired && !busy) {
        U(rig, ctx);
        ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(16, 20, 21, .7)';
        ctx.beginPath();
        if (state.tool === 'band') {
          ctx.setLineDash([3, 3]);
          if (pc.band === 'ring') ctx.arc(pc.c[0], pc.c[1], Math.hypot(pointer[0] - pc.c[0], pointer[1] - pc.c[1]), 0, TAU);
          else if (pc.wheel) {
            const [x0, y0, cx, cy, x1, y1] = bandLine(pc, pointer[1]);
            ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1);
            if (SIZES.band[state.size] >= 10) ctx.lineTo(pc.bbox[0] + pc.bbox[2] + 8, y1);
          }
          else { ctx.moveTo(pc.bbox[0] - 8, pointer[1]); ctx.quadraticCurveTo(pc.bbox[0] + pc.bbox[2] / 2, pointer[1] + pc.bbox[2] * .13, pc.bbox[0] + pc.bbox[2] + 8, pointer[1]); }
        } else {
          ctx.arc(pointer[0], pointer[1], state.tool === 'dots' ? SIZES.dots[state.size] : SIZES.brush[state.size] / 2, 0, TAU);
        }
        ctx.stroke(); ctx.setLineDash([]);
      }
    }

    function fit() {
      const css = canvas.clientWidth;
      if (!css) return;
      const size = Math.min(1200, Math.round(css * Math.min(devicePixelRatio || 1, 2)));
      if (rig && rig.size === size) return;
      canvas.width = canvas.height = size;
      rig = makeRig(size);
      buildPiece(rig, pc);
      renderOps(rig, rig.paint, cur.ops, false, pc);
      if (cur.fired) renderOps(rig, rig.fire, cur.ops, true, pc);
      frame();
    }

    function refresh() {
      undoBtn.disabled = clearBtn.disabled = !cur.ops.length || busy;
      fireBtn.disabled = autoBtn.disabled = busy;
      kit.hidden = cur.fired;
      firedPanel.hidden = !cur.fired;
      stage.classList.toggle('is-done', cur.fired);
      stage.classList.toggle('is-busy', busy);
      const n = cur.ops.length;
      canvas.setAttribute('aria-label', cur.fired
        ? 'Your ' + NAMES[pc.id] + ', glazed and fired'
        : n ? 'A ' + NAMES[pc.id] + ' with ' + n + (n === 1 ? ' coat' : ' coats') + ' of paint, not fired yet' : 'A blank ' + NAMES[pc.id] + ', ready to paint');
    }

    function setPiece(id) {
      if (busy) return;
      pc = readPiece(id);
      cur = store[id] || (store[id] = { ops: [], fired: false });
      anim.fireP = anim.glossP = cur.fired ? 1 : 0; anim.heatP = 0;
      active = null;
      rackBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.piece === id)));
      $('input[name="tool"][value="band"]').nextElementSibling.lastChild.textContent = pc.band === 'ring' ? 'Rings' : 'Stripes';
      showTip();
      if (rig) {
        buildPiece(rig, pc);
        renderOps(rig, rig.paint, cur.ops, false, pc);
        if (cur.fired) renderOps(rig, rig.fire, cur.ops, true, pc);
      }
      refresh(); request();
    }

    const modeBtn = $('[data-mode]');
    const arm = on => {
      armed = on;
      stage.classList.toggle('is-armed', on);
      if (modeBtn) modeBtn.textContent = on ? 'Done painting' : 'Tap the piece to start painting';
    };
    if (modeBtn) modeBtn.addEventListener('click', () => arm(!armed));

    const toUnits = e => {
      const r = canvas.getBoundingClientRect();
      const k = 240 / r.width;
      return [(e.clientX - r.left) * k - 20, (e.clientY - r.top) * k - 20];
    };

    function newOp(p) {
      const seed = Math.random() * 999;
      if (state.tool === 'dots') return { t: 'dots', c: state.color, w: SIZES.dots[state.size], p: [p] };
      if (state.tool === 'band') {
        const w = SIZES.band[state.size];
        if (pc.band === 'ring') return { t: 'band', ring: true, c: state.color, w, k: ringK(p), seed };
        return { t: 'band', c: state.color, w, y: p[1], seed };
      }
      return { t: 'brush', c: state.color, w: SIZES.brush[state.size], p: [p], seed };
    }
    const ringK = p => clamp(Math.hypot(p[0] - pc.c[0], p[1] - pc.c[1]) / (Math.max(pc.bbox[2], pc.bbox[3]) / 2), .05, 1.04);

    function drawActive() {
      const m = rig.tmp.getContext('2d');
      R(m); m.clearRect(0, 0, rig.size, rig.size);
      drawOp(rig, m, active, false, pc);
      request();
    }

    function commit() {
      if (!active) return;
      const t = rig.paint.getContext('2d');
      R(t); t.globalAlpha = alphaOf(active, false); t.drawImage(rig.tmp, 0, 0); t.globalAlpha = 1;
      cur.ops.push(active);
      active = null;
      const m = rig.tmp.getContext('2d'); R(m); m.clearRect(0, 0, rig.size, rig.size);
      refresh(); request();
    }

    function begin(e) {
      if (!rig) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      active = newOp(toUnits(e));
      drawActive();
    }

    canvas.addEventListener('pointerdown', e => {
      if (cur.fired || busy || e.button > 0) return;
      if (e.pointerType === 'touch' && !armed) { tap = { x: e.clientX, y: e.clientY, e }; return; }
      e.preventDefault();
      begin(e);
    });
    canvas.addEventListener('pointermove', e => {
      const p = toUnits(e);
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10) tap = null;
      if (!active) {
        if (e.pointerType !== 'touch') { pointer = p; request(); }
        return;
      }
      if (active.t === 'band') {
        if (active.ring) active.k = ringK(p); else active.y = p[1];
      } else {
        const l = active.p[active.p.length - 1];
        const gap = active.t === 'dots' ? active.w * 2.7 : .9;
        if (Math.hypot(p[0] - l[0], p[1] - l[1]) < gap) return;
        active.p.push(p);
      }
      drawActive();
    });
    const lift = e => {
      if (tap) {
        /* a tap on a phone turns painting on and leaves the first dab */
        const first = tap.e;
        tap = null;
        arm(true);
        active = newOp(toUnits(first));
        drawActive();
      }
      commit();
      if (e && e.pointerType === 'touch') pointer = null;
    };
    canvas.addEventListener('pointerup', lift);
    canvas.addEventListener('pointercancel', () => {
      tap = null;
      if (active) { active = null; const m = rig.tmp.getContext('2d'); R(m); m.clearRect(0, 0, rig.size, rig.size); request(); }
    });
    canvas.addEventListener('pointerleave', () => { pointer = null; request(); });

    /* painting stays armed on a phone only while the bench is on screen */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(en => { if (!en.isIntersecting && armed && coarse.matches) arm(false); }), { threshold: .2 }).observe(stage);
    }
    if (!coarse.matches) arm(true);
    coarse.addEventListener('change', e => arm(!e.matches));

    kit.addEventListener('change', e => {
      const t = e.target;
      if (t.name === 'color') { state.color = +t.value; nameEl.textContent = PAL[state.color].name; }
      if (t.name === 'tool') { state.tool = t.value; showTip(); }
      if (t.name === 'size') state.size = +t.value;
    });
    /* a browser can bring the page back with other choices already made (Back from the booking page) and send no event: read the kit as it stands */
    const readKit = () => {
      const on = n => $('input[name="' + n + '"]:checked', kit);
      const c = on('color'), t = on('tool'), s = on('size');
      if (c) { state.color = +c.value; nameEl.textContent = PAL[state.color].name; }
      if (t) { state.tool = t.value; showTip(); }
      if (s) state.size = +s.value;
    };
    addEventListener('pageshow', readKit);

    undoBtn.addEventListener('click', () => { if (busy || !cur.ops.length) return; cur.ops.pop(); renderOps(rig, rig.paint, cur.ops, false, pc); refresh(); request(); });
    clearBtn.addEventListener('click', () => { if (busy) return; cur.ops = []; renderOps(rig, rig.paint, cur.ops, false, pc); refresh(); request(); });

    /* nothing happens to the piece off screen: bring it into the window first, and say how long that takes */
    function showStage() {
      const r = stage.getBoundingClientRect();
      const edge = top.offsetHeight + 8;
      if (r.top >= edge - 2 && r.bottom <= innerHeight + 2) return 0;
      scrollTo({ top: Math.max(0, scrollY + r.top - edge - 8), behavior: reduce ? 'auto' : 'smooth' });
      return reduce ? 0 : 460;
    }

    /* on a phone the piece is pinned under the header: when the kit and the result panel trade places, the one that arrives starts just below the pin */
    function underPin(el) {
      const pin = stage.closest('.stage__pin');
      if (!pin || getComputedStyle(pin).position !== 'sticky') return false;
      const edge = pin.getBoundingClientRect().bottom + 12;
      const r = el.getBoundingClientRect();
      if (r.top < edge - 2 || r.bottom > innerHeight) scrollBy({ top: r.top - edge, behavior: reduce ? 'auto' : 'smooth' });
      return true;
    }

    autoBtn.addEventListener('click', () => {
      if (busy || cur.fired || !rig) return;
      const ops = recipe(pc);
      cur.ops = [];
      renderOps(rig, rig.paint, cur.ops, false, pc);
      if (reduce) { showStage(); cur.ops = ops; renderOps(rig, rig.paint, ops, false, pc); refresh(); request(); return; }
      busy = true; refresh();
      let i = 0;
      const step = () => {
        const op = ops[i++];
        cur.ops.push(op);
        stamp(rig, rig.paint, op, false, pc);
        request();
        if (i < ops.length) setTimeout(step, 62);
        else { busy = false; refresh(); }
      };
      setTimeout(step, showStage());
    });

    fireBtn.addEventListener('click', () => {
      if (busy || cur.fired || !rig) return;
      busy = true; refresh();
      renderOps(rig, rig.fire, cur.ops, true, pc);
      const T = reduce ? 500 : 3200;
      let t0 = 0;
      const ease = t => t * t * (3 - 2 * t);
      const tick = now => {
        if (!t0) { t0 = now; stage.classList.add('is-hot'); }
        const p = clamp((now - t0) / T, 0, 1);
        anim.heatP = p < .2 ? p / .2 : p > .76 ? clamp((1 - p) / .2, 0, 1) : 1;
        anim.fireP = ease(clamp((p - .16) / .5, 0, 1));
        anim.glossP = ease(clamp((p - .72) / .28, 0, 1));
        dayEl.textContent = p < .3 ? 'Day 1' : p < .54 ? 'Day 2' : p < .76 ? 'Day 3' : '';
        if (p > .76) stage.classList.remove('is-hot');
        frame();
        if (p < 1) { requestAnimationFrame(tick); return; }
        anim.heatP = 0; anim.fireP = anim.glossP = 1;
        cur.fired = true; busy = false;
        dayEl.textContent = '';
        refresh(); frame();
        /* the kit gives way to a shorter panel: keep the piece and the panel's first line in the window */
        if (!underPin(firedPanel)) showStage();
        const h = $('.fired__title', firedPanel);
        if (h) h.focus({ preventScroll: true });
      };
      setTimeout(() => requestAnimationFrame(tick), showStage());
    });

    $('[data-again]').addEventListener('click', () => {
      cur.ops = []; cur.fired = false;
      anim.fireP = anim.glossP = anim.heatP = 0;
      renderOps(rig, rig.paint, cur.ops, false, pc);
      refresh(); request();
      underPin(kit);
    });

    /* a picture of the fired piece, to keep or send */
    const saveBtn = $('[data-save]');
    const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      try {
        const E = makeRig(1000);
        buildPiece(E, pc);
        renderOps(E, E.paint, cur.ops, false, pc);
        renderOps(E, E.fire, cur.ops, true, pc);
        const one = document.createElement('canvas'); one.width = one.height = 1000;
        compose(E, one.getContext('2d'), pc, { fireP: 1, glossP: 1, heatP: 0, active: false, activeAlpha: 0 });
        const out = document.createElement('canvas'); out.width = 1080; out.height = 1350;
        const o = out.getContext('2d');
        o.fillStyle = '#fff'; o.fillRect(0, 0, 1080, 1350);
        o.save(); o.translate(70, 70); o.scale(4.7, 4.7); o.fillStyle = '#00a8d0'; o.fill(new Path2D(BLOB)); o.restore();
        o.drawImage(one, 70 + 75, 70 + 75, 790, 790);
        try {
          const logo = await loadImg('assets/img/logo-black.webp');
          o.drawImage(logo, 360, 1090, 360, 130.5);
        } catch (err) { /* the picture still saves without the wordmark */ }
        o.fillStyle = '#3f474a'; o.textAlign = 'center';
        o.font = '500 30px "Jost", system-ui, sans-serif';
        o.fillText('Paint the real one in Evans, Georgia', 540, 1284);
        const blob = await new Promise(ok => out.toBlob(ok, 'image/png'));
        const file = new File([blob], 'artsy-me-' + pc.id + '.png', { type: 'image/png' });
        if (coarse.matches && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'My Artsy Me ' + NAMES[pc.id] });
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = file.name;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        }
      } catch (err) { /* closing the share sheet lands here; nothing to report */ }
      saveBtn.disabled = false;
    });

    function stills() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const rigs = {};
      $$('.piece, [data-rack] button').forEach(btn => {
        const art = $('.piece__art', btn);
        const css = art && art.clientWidth;
        if (!css) return;
        const size = Math.max(64, Math.round(css * 1.2 * dpr));
        let cv = $('canvas', art);
        if (cv && cv.width === size) return;
        const R0 = rigs[size] || (rigs[size] = makeRig(size));
        const one = readPiece(btn.dataset.piece);
        buildPiece(R0, one);
        if (!cv) { cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); art.append(cv); }
        cv.width = cv.height = size;
        compose(R0, cv.getContext('2d'), one, { fireP: 0, glossP: 0, heatP: 0, active: false, activeAlpha: 0, shadow: '0, 0, 0', shadowA: .7 });
        btn.classList.add('is-drawn');
      });
    }
    let stillTimer = 0;
    addEventListener('resize', () => { clearTimeout(stillTimer); stillTimer = setTimeout(stills, 200); });
    stills();

    rackBtns.forEach(b => b.addEventListener('click', () => setPiece(b.dataset.piece)));
    shelfBtns.forEach(b => b.addEventListener('click', () => {
      setPiece(b.dataset.piece);
      shelfBtns.forEach(o => o.classList.toggle('is-picked', o === b));
      $('#paint').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }));

    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(canvas);
    else addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    fit();
    refresh();

    /* ------------------------------------------- first screen: a taste of it */
    /* one tap of colour paints the bench's own mug, fires it and brings it out glossy */
    const taste = $('[data-taste]');
    const tasteCanvas = $('[data-taste-canvas]');
    if (taste && tasteCanvas) {
      const tx = tasteCanvas.getContext('2d');
      const dayOut = $('[data-taste-day]');
      const nameOut = $('[data-taste-name]');
      const go = $('[data-taste-go]');
      const mug = readPiece('mug');
      /* the second colour that goes with each paint, for two thin stripes */
      const STRIPE = [6, 7, 0, 0, 7, 0, 0, 0, 0, 7];
      const look = { fireP: 0, glossP: 0, heatP: 0 };
      let tRig = null, tOps = [], run = 0, tasted = null;

      /* the mug's shadow lies on the board; in the kiln it lifts with the heat, so the board is one flat ember line */
      const show = () => {
        if (tRig) compose(tRig, tx, mug, { fireP: look.fireP, glossP: look.glossP, heatP: look.heatP, active: false, activeAlpha: 0, shadow: '0, 0, 0', shadowA: .7 * (1 - look.heatP) });
      };
      const size = () => {
        const css = tasteCanvas.clientWidth;
        if (!css) return;
        const px = Math.min(1200, Math.round(css * Math.min(devicePixelRatio || 1, 2)));
        if (tRig && tRig.size === px) return;
        tasteCanvas.width = tasteCanvas.height = px;
        tRig = makeRig(px);
        buildPiece(tRig, mug);
        renderOps(tRig, tRig.paint, tOps, false, mug);
        renderOps(tRig, tRig.fire, tOps, true, mug);
        show();
      };
      const settle = c => {
        tasted = c;
        /* the count ran to three days; the studio's real wait is longer, so the finished mug says so */
        dayOut.textContent = 'Ready in 3 to 7 days';
        taste.classList.add('is-done');
        tasteCanvas.setAttribute('aria-label', 'A mug painted ' + PAL[c].name.toLowerCase() + ', glazed and fired');
        $$('[data-go]', go).forEach(sp => { sp.hidden = sp.dataset.go !== 'paint'; });
        go.setAttribute('href', '#paint');
      };
      const fireIt = (id, c) => {
        if (id !== run || !tRig) return;
        renderOps(tRig, tRig.fire, tOps, true, mug);
        const T = 2600;
        let t0 = 0;
        taste.classList.add('is-hot');
        const ease = t => t * t * (3 - 2 * t);
        const tick = now => {
          if (id !== run) return;
          if (!t0) t0 = now;
          const p = clamp((now - t0) / T, 0, 1);
          look.heatP = p < .2 ? p / .2 : p > .76 ? clamp((1 - p) / .2, 0, 1) : 1;
          look.fireP = ease(clamp((p - .16) / .5, 0, 1));
          look.glossP = ease(clamp((p - .72) / .28, 0, 1));
          dayOut.textContent = p < .3 ? 'Day 1' : p < .54 ? 'Day 2' : p < .76 ? 'Day 3' : '';
          if (p > .76) taste.classList.remove('is-hot');
          show();
          if (p < 1) requestAnimationFrame(tick); else settle(c);
        };
        requestAnimationFrame(tick);
      };
      const paintWith = (c, atOnce) => {
        if (!tRig) size();
        if (!tRig) return;
        const id = ++run;
        const S = () => Math.random() * 999;
        const ops = [];
        for (let y = 60; y <= 186; y += 13) ops.push({ t: 'band', c, w: 22, y, seed: S() });
        /* five dots halfway between the two fine stripes, on the line a stripe would follow */
        ops.push({ t: 'dots', c: c === 9 ? 6 : 9, w: 5.5, p: [55, 75, 95, 115, 135].map(px => [px, bandY(mug, px, 121)]) });
        ops.push({ t: 'band', c: STRIPE[c], w: 6, y: 84, seed: S() }, { t: 'band', c: STRIPE[c], w: 6, y: 158, seed: S() });
        tOps = [];
        look.fireP = look.glossP = look.heatP = 0;
        taste.classList.remove('is-hot', 'is-done');
        dayOut.textContent = '';
        renderOps(tRig, tRig.paint, tOps, false, mug);
        tasteCanvas.setAttribute('aria-label', 'A mug being painted ' + PAL[c].name.toLowerCase());
        if (reduce || atOnce) {
          tOps = ops;
          renderOps(tRig, tRig.paint, tOps, false, mug);
          renderOps(tRig, tRig.fire, tOps, true, mug);
          look.fireP = look.glossP = 1;
          show(); settle(c);
          return;
        }
        let i = 0;
        const step = () => {
          if (id !== run) return;
          const op = ops[i++];
          tOps.push(op);
          stamp(tRig, tRig.paint, op, false, mug);
          show();
          if (i < ops.length) setTimeout(step, 70); else setTimeout(() => fireIt(id, c), 380);
        };
        step();
      };

      $('[data-taste-wells]').addEventListener('change', e => {
        if (e.target.name !== 'taste') return;
        const c = +e.target.value;
        nameOut.textContent = PAL[c].name;
        /* on a short phone the shelf sits below the fold: bring it up before anything happens on it */
        const board = $('.taste__board', taste).getBoundingClientRect();
        if (board.bottom > innerHeight) taste.scrollIntoView({ block: 'end', behavior: reduce ? 'auto' : 'smooth' });
        paintWith(c);
      });
      /* the colour that was tried goes down to the bench with the visitor */
      go.addEventListener('click', () => {
        if (tasted === null) return;
        const r = $('input[name="color"][value="' + tasted + '"]', kit);
        if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      if ('ResizeObserver' in window) new ResizeObserver(size).observe(tasteCanvas);
      else addEventListener('resize', size);
      size();
      /* a browser can bring the page back with a paint still chosen (Back from the map) and send no event: show that mug finished, not a blank one beside a chosen paint */
      addEventListener('pageshow', () => {
        const r = $('input:checked', $('[data-taste-wells]'));
        if (!r || run) return;
        nameOut.textContent = PAL[+r.value].name;
        paintWith(+r.value, true);
      });
    }

  }

  /* ---------------------------------------------------------------- gallery */

  const chips = $$('[data-chips] .chip');
  const gallery = $('[data-gallery]');
  const shots = $$('.shot', gallery || document);
  let filter = 'all';
  const matches = s => filter === 'all' || s.dataset.cat.split(' ').includes(filter);
  chips.forEach(c => c.addEventListener('click', () => {
    filter = c.dataset.filter;
    chips.forEach(o => o.setAttribute('aria-pressed', String(o === c)));
    gallery.classList.toggle('is-filtered', filter !== 'all');
    shots.forEach(s => s.classList.toggle('is-match', matches(s)));
  }));

  const box = $('[data-box]');
  if (box && typeof box.showModal === 'function') {
    const boxImg = new Image();
    boxImg.className = 'box__img';
    boxImg.alt = '';
    $('[data-box-slot]').append(boxImg);
    let list = shots, at = 0;
    const show = i => {
      at = (i + list.length) % list.length;
      const a = list[at];
      boxImg.src = a.getAttribute('href');
      boxImg.alt = $('img', a).alt;
    };
    shots.forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      list = shots.filter(matches);
      if (!list.includes(a)) list = shots;
      show(list.indexOf(a));
      box.showModal();
    }));
    $('[data-box-close]').addEventListener('click', () => box.close());
    $('[data-box-prev]').addEventListener('click', () => show(at - 1));
    $('[data-box-next]').addEventListener('click', () => show(at + 1));
    box.addEventListener('click', e => { if (e.target === box) box.close(); });
    box.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') show(at - 1);
      if (e.key === 'ArrowRight') show(at + 1);
    });
  }

  /* ---------------------------------------------------------- party planner */

  const plan = $('[data-plan]');
  if (plan) {
    const lines = $('[data-lines]');
    const notes = $('[data-notes]');
    const guests = plan.elements.guests;
    const label = $('[data-guests-label]');
    const when = $('[data-when]');
    const book = $('[data-book]');
    const call = $('[data-call]');
    const totalNum = $('[data-total-num]');
    const totalSmall = $('[data-total-small]');
    const photo = $('[data-party-photo]');
    const photoImg = $('img', photo);

    /* ---- the party table: seen from above, one place per head, laid from the count ---- */
    const tablePlan = $('[data-table-plan]');
    const tableNote = $('[data-table-note]');
    /* nine of the ten paints, ordered so neighbours differ (white would not show on a white plate) */
    const RIMS = ['#f7c417', '#d42a1c', '#9fcf2e', '#1f4fb4', '#f1701f', '#1f9a54', '#ee4f8e', '#1c1b1a', '#00a8c6'];
    const SMALL = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
    let laid = '';
    /* one table. Places fill in a zigzag from its left end, starting on the side named `firstRow` ('t' or 'b').
       --x is a place's left edge and --len the table's length, both counted in places */
    function tablePiece(seats, firstRow, cloth, tag, from) {
      const a = Math.ceil(seats / 2), b = seats - a;
      const el = document.createElement('div');
      el.className = 'tbl' + (cloth ? ' tbl--cloth' : '');
      el.style.setProperty('--len', a === b ? a + .5 : a);
      const top = document.createElement('span');
      top.className = 'tbl__top';
      el.append(top);
      for (let k = 0; k < seats; k++) {
        const first = k % 2 === 0;
        const s = document.createElement('span');
        s.className = 'seat seat--' + (first ? firstRow : firstRow === 't' ? 'b' : 't');
        s.style.setProperty('--x', (first ? .25 : .75) + (k >> 1));
        s.style.setProperty('--c', RIMS[(from + k) % RIMS.length]);
        s.dataset.n = from + k + 1;
        const chair = document.createElement('span'), plate = document.createElement('span');
        chair.className = 'seat__chair';
        plate.className = 'seat__plate';
        s.append(chair, plate);
        el.append(s);
      }
      if (tag) {
        const t = document.createElement('span');
        t.className = 'tbl__tag';
        t.textContent = tag;
        el.append(t);
      }
      return el;
    }
    function layTable(kind, studio, n) {
      if (!tablePlan) return;
      /* the kids' flat price is a clothed table of 15 with a bare one of 5 beside it; every other party sits at tables of 20 */
      const tables = kind === 'grown' ? Math.max(1, Math.ceil(n / 20)) : 1;
      const key = kind + tables;
      if (key !== laid) {
        laid = key;
        tablePlan.replaceChildren();
        tablePlan.parentNode.className = 'tables tables--' + (kind === 'artsy' ? 'split' : 'long');
        if (kind === 'artsy') tablePlan.append(tablePiece(15, 't', true, '', 0), tablePiece(5, 'b', false, '+$20 each', 15));
        else for (let t = 0; t < tables; t++) tablePlan.append(tablePiece(20, 't', true, '', t * 20));
      }
      $$('.seat', tablePlan).forEach(s => s.classList.toggle('is-set', +s.dataset.n <= n));
      const lead = document.createElement('b');
      lead.textContent = n + ' places set.';
      let rest;
      if (kind === 'artsy') {
        const d = Math.abs(15 - n);
        rest = n < 15 ? ' ' + SMALL[d] + (d === 1 ? ' more fits' : ' more fit') + ' at the same price.'
          : n === 15 ? ' That fills the flat price.'
          : d === 1 ? ' One is past the flat price, for $20 more.' : ' ' + SMALL[d] + ' are past the flat price, $20 each.';
      } else if (kind === 'glass') rest = ' Each one is $30.';
      else rest = n <= 20 ? ' The party room seats 20.' : ' The party room seats 20; the whole studio seats ' + (studio === 'evans' ? 60 : 40) + '.';
      tableNote.replaceChildren(lead, rest);
      tablePlan.setAttribute('aria-label', 'The party table from above. ' + lead.textContent + rest);
    }
    /* a tap on a place sets the table up to it; the stepper and the number field stay the labelled way in */
    if (tablePlan) tablePlan.addEventListener('click', e => {
      const s = e.target.closest('.seat');
      if (!s) return;
      guests.value = s.dataset.n;
      calc();
    });
    const grovetown = plan.querySelector('input[name="studio"][value="grovetown"]');
    const steps = $$('[data-step]', plan);

    const PHONE = { evans: ['+17064326396', '(706) 432-6396'], grovetown: ['+17063059655', '(706) 305-9655'] };
    const LINK = {
      artsy: { evans: 'artsy-me-party---up-to-20-guests----deposit', grovetown: 'artsy-me---the-gateway-kiddo-birthday-party' },
      glass: { evans: 'artsy-me-party---up-to-20-guests----deposit' },
      grown: { evans: 'private-paint-party--for-the-grownups--41', grovetown: 'private-paint-party--for-the-grownups-' },
    };
    const PHOTO = {
      artsy: ['party-room', 'A party room set for a birthday: checked tablecloths, folding chairs and a chalkboard reading Happy Birthday', [700, 1200]],
      glass: ['glass-panels', 'Two fused glass panels of wildflowers leaning on a weathered fence', [600, 1000]],
      grown: ['grownups', 'A group of women painting pottery at a table in the studio', [600, 1000]],
    };
    let shown = 'artsy';

    function calc() {
      const kind = plan.elements.kind.value;
      if (kind === 'glass') { plan.elements.studio.value = 'evans'; }
      grovetown.disabled = kind === 'glass';
      const studio = plan.elements.studio.value;
      const after = plan.elements.when.value === 'after';
      const grown = kind === 'grown';
      const min = grown ? 10 : 8;
      const max = grown ? (studio === 'evans' ? 60 : 40) : 20;
      guests.min = min; guests.max = max;
      const n = clamp(parseInt(guests.value, 10) || min, min, max);
      if (document.activeElement !== guests) guests.value = n;
      steps[0].disabled = n <= min; steps[1].disabled = n >= max;
      label.textContent = grown ? 'Guests' : 'Kids';
      layTable(kind, studio, n);
      when.hidden = !grown;

      let rows = [], list = [], total = 0, small = n + (grown ? ' guests' : ' kids'), num;
      if (kind === 'artsy') {
        total = 325;
        if (n > 15) {
          rows.push(['Artsy Party, the first 15 kids', money(325)]);
          rows.push([(n - 15) + (n - 15 === 1 ? ' more kid' : ' more kids') + ' at $20', money((n - 15) * 20)]);
          total += (n - 15) * 20;
        } else rows.push(['One flat price covers up to 15 kids', '']);
        list = studio === 'evans'
          ? ['1.5 hours in the Garage Party Room, for ages 5 and up', 'A $40 deposit holds the date and comes off the balance', 'You bring the food, drinks and paper goods', 'Pieces are ready 5 to 7 days later']
          : ['In the party room at 935 Branch Court, next to Walmart', 'The room seats up to 20, with a table for your food', 'We suggest dropping the kids off'];
        num = money(total);
      } else if (kind === 'glass') {
        total = n * 30;
        rows.push([n + ' kids at $30 each', '']);
        list = ['A 6-inch fused glass sun catcher or plaque each', 'For ages 10 and up, at the Evans studio', 'A $40 deposit holds the date and comes off the balance', 'Glass is ready 7 to 10 days later'];
        num = money(total);
      } else {
        const fee = after ? 10 : 5;
        rows.push([n + ' guests at $' + fee + ' each', money(n * fee)]);
        rows.push(['Pottery, picked by each guest', 'from $12 each']);
        total = n * (fee + 12);
        list = ['The total counts a $12 piece for every guest', 'A two-hour slot, for 10 guests or more', 'A $25 deposit reserves the date; food and all beverages are welcome', studio === 'evans' ? 'The party room seats 20 and the whole studio seats 60' : 'The party room seats 20 and the whole studio seats 40'];
        num = money(total);
        small = 'from';
      }

      lines.innerHTML = '';
      rows.forEach(([a, b, isTotal]) => {
        const d = document.createElement('div');
        if (isTotal) d.className = 'is-total';
        const dt = document.createElement('dt'); dt.textContent = a;
        const dd = document.createElement('dd'); dd.textContent = b;
        d.append(dt, dd); lines.append(d);
      });
      notes.innerHTML = '';
      list.forEach(t => { const li = document.createElement('li'); li.textContent = t; notes.append(li); });

      totalNum.textContent = num;
      totalSmall.textContent = small;
      book.href = 'https://artsy-me.placefull.com/' + (LINK[kind][studio] || LINK[kind].evans);
      call.href = 'tel:' + PHONE[studio][0];
      call.textContent = 'Call ' + PHONE[studio][1];

      const want = kind;
      if (want !== shown) {
        shown = want;
        const [file, alt, ws] = PHOTO[want];
        photo.classList.add('is-swapping');
        setTimeout(() => {
          photoImg.srcset = ws.map(w => 'assets/img/' + file + '-' + w + '.webp ' + w + 'w').join(', ');
          photoImg.src = 'assets/img/' + file + '-' + ws[0] + '.webp';
          photoImg.alt = alt;
          const done = () => photo.classList.remove('is-swapping');
          if (photoImg.decode) photoImg.decode().then(done, done); else done();
        }, reduce ? 0 : 280);
      }
    }

    plan.addEventListener('change', calc);
    guests.addEventListener('input', calc);
    guests.addEventListener('blur', calc);
    steps.forEach(b => b.addEventListener('click', () => {
      guests.value = (parseInt(guests.value, 10) || 0) + (+b.dataset.step);
      calc();
    }));
    calc();
    /* a browser can bring the page back with another party already chosen and send no event: price what the planner shows */
    addEventListener('pageshow', calc);
  }

  /* ---------------------------------------------------------------- classes */

  const acts = $$('[data-acts] .act');
  acts.forEach(a => $('.act__head', a).addEventListener('click', () => {
    acts.forEach(o => {
      const on = o === a;
      o.classList.toggle('is-on', on);
      $('.act__head', o).setAttribute('aria-expanded', String(on));
    });
  }));

  /* ------------------------------------------------------------------ story */

  const story = $('[data-story]');
  if (story && !reduce && window.CSS && CSS.supports('position', 'sticky') && CSS.supports('container-type', 'size')) {
    const stops = $$('.stop', story);
    const years = $$('.year', story);
    const texts = $$('.stop__text', story);
    const stopsEl = $('.stops', story);
    /* every stop's words get the tallest paragraph's room, so the year stands on one line through all five */
    const level = () => {
      stopsEl.style.removeProperty('--text-h');
      if (!story.classList.contains('is-pinned')) return;
      let tall = 0;
      texts.forEach(t => { tall = Math.max(tall, t.offsetHeight); });
      stopsEl.style.setProperty('--text-h', tall + 'px');
    };
    const ratios = [1.5, 1, 1.335, .75, .667];
    stops.forEach((s, i) => $('.stop__photo', s).style.setProperty('--arn', ratios[i]));
    const roomy = matchMedia('(min-width: 900px) and (min-height: 620px)');
    let at = -1;
    const set = i => {
      if (i === at) return;
      at = i;
      stops.forEach((s, k) => s.classList.toggle('is-on', k === i));
      years.forEach((y, k) => {
        y.classList.toggle('is-on', k === i);
        y.classList.toggle('is-done', k <= i);
        y.setAttribute('aria-pressed', String(k === i));
      });
    };
    const span = () => story.offsetHeight - innerHeight;
    let queued = false;
    const read = () => {
      queued = false;
      if (!story.classList.contains('is-pinned')) return;
      const p = clamp(-story.getBoundingClientRect().top / span(), 0, .9999);
      set(Math.floor(p * stops.length));
    };
    const pin = () => {
      story.classList.toggle('is-pinned', roomy.matches);
      at = -1;
      if (roomy.matches) read();
      else stops.forEach(s => s.classList.add('is-on'));
      level();
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(read); } }, { passive: true });
    addEventListener('resize', () => { read(); level(); });
    roomy.addEventListener('change', pin);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(level);
    years.forEach((y, k) => y.addEventListener('click', () => {
      scrollTo({ top: scrollY + story.getBoundingClientRect().top + span() * ((k + .5) / stops.length), behavior: 'smooth' });
    }));
    pin();
  }

  /* ---------------------------------------------------------------- studios */

  const tabs = $$('[data-studios] [role="tab"]');
  if (tabs.length) {
    const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
    const pickTab = (i, focus) => {
      tabs.forEach((t, k) => {
        t.setAttribute('aria-selected', String(k === i));
        t.tabIndex = k === i ? 0 : -1;
        panels[k].hidden = k !== i;
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => pickTab(i));
      t.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') pickTab((i + 1) % tabs.length, true);
        if (e.key === 'ArrowLeft') pickTab((i + tabs.length - 1) % tabs.length, true);
      });
    });
    pickTab(0);
  }

  $$('[data-tally] li').forEach(li => {
    const dots = $('.tally__dots', li);
    for (let i = 0; i < +li.dataset.n; i++) dots.append(document.createElement('i'));
  });

  /* the phone bar steps aside wherever the same buttons are already on screen */
  const bar = $('.bar');
  if (bar && 'IntersectionObserver' in window) {
    const phone = matchMedia('(max-width: 599px)');
    const seen = new Set();
    let io = null, io2 = null;
    const tell = es => {
      es.forEach(en => { if (en.isIntersecting) seen.add(en.target); else seen.delete(en.target); });
      bar.classList.toggle('is-off', seen.size > 0);
    };
    const watch = () => {
      if (phone.matches && !io) {
        io = new IntersectionObserver(tell, { threshold: .6 });
        $$('.hero__act, .stage__pin, .plan__act, .studio__act, .facts__in, .foot__cols').forEach(el => io.observe(el));
        /* the first screen's mug and paints are worked with a thumb: no bar over any part of them */
        io2 = new IntersectionObserver(tell, { threshold: 0 });
        $$('.hero__taste, .hero__kit').forEach(el => io2.observe(el));
      } else if (!phone.matches && io) {
        io.disconnect(); io2.disconnect(); io = io2 = null; seen.clear(); bar.classList.remove('is-off');
      }
    };
    watch();
    phone.addEventListener('change', watch);
  }

  /* --------------------------------------------- photographs arrive, once */

  if (!reduce && 'IntersectionObserver' in window) {
    const frames = $$('.frame');
    const show = f => {
      const img = $('img', f);
      let done = false;
      const go = () => { if (done) return; done = true; f.classList.add('is-in'); };
      if (!img || (img.complete && img.naturalWidth)) go();
      else { img.addEventListener('load', go, { once: true }); img.addEventListener('error', go, { once: true }); setTimeout(go, 2500); }
    };
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      show(en.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: .1 });
    frames.forEach(f => {
      if (f.getBoundingClientRect().top < innerHeight * .92) return;
      f.classList.add('will-in');
      io.observe(f);
    });
    addEventListener('load', () => setTimeout(() => frames.forEach(f => {
      if (!f.classList.contains('will-in') || f.classList.contains('is-in')) return;
      const r = f.getBoundingClientRect();
      if (r.width && r.top < innerHeight && r.bottom > 0) show(f);
    }), 3000));
  }
})();
