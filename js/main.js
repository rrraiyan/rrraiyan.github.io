(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const D = window.DATA;
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const mlabel = s => MON[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4);
const fmtK = n => n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace('.0', '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n));
const fmtM = n => '$' + Math.round(n / 1e6) + 'M';
function nice(v) {
  const p = 10 ** Math.floor(Math.log10(v)), r = v / p;
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(s => s >= r) * p;
}
function tween(ms, fn, done) {
  if (reduce) { fn(1); done && done(); return; }
  const t0 = performance.now();
  requestAnimationFrame(function f(t) {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    fn(e);
    k < 1 ? requestAnimationFrame(f) : done && done();
  });
}
const sleep = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
function once(node, fn, threshold = 0.4) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { io.disconnect(); fn(); }
  }), { threshold });
  io.observe(node);
}
function drawIn(path, ms, delay = 0) {
  if (reduce) return;
  const L = path.getTotalLength();
  path.style.strokeDasharray = L;
  path.style.strokeDashoffset = L;
  path.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }],
    { duration: ms, delay, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards' });
}

/* ================= Time-series chart (hero + phones) ================= */
function timeChart(box, opt) {
  const { hist, fc, animate, onHover } = opt;
  box.innerHTML = '';
  const W = box.clientWidth, H = box.clientHeight;
  if (!W) return;
  const narrow = W < 520;
  const m = { l: narrow ? 38 : 46, r: 10, t: 22, b: 26 };
  const pts = hist.map(d => ({ d: d[0], v: d[1] }))
    .concat(fc.map(d => ({ d: d[0], v: d[1], lo: d[2], hi: d[3], f: true })));
  const n = pts.length, hn = hist.length;
  const raw = Math.max(...pts.map(p => p.hi || p.v));
  const stepPow = 10 ** Math.floor(Math.log10(raw / 4));
  const tick = [1, 2, 2.5, 5, 10].find(s => s * stepPow * 4 >= raw / 1.25 && s * stepPow >= raw / 5) * stepPow;
  const nt = Math.ceil(raw / tick), ymax = nt * tick;
  const x = i => m.l + i / (n - 1) * (W - m.l - m.r);
  const y = v => H - m.b - v / ymax * (H - m.t - m.b);
  const svg = el('svg', { class: 'c', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' }, box);

  const g = el('g', { class: 'grid' }, svg), ax = el('g', { class: 'ax' }, svg);
  for (let k = 0; k <= nt; k++) {
    const v = tick * k, yy = y(v);
    el('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy }, g);
    el('text', { x: m.l - 8, y: yy + 4, 'text-anchor': 'end' }, ax).textContent = fmtK(v);
  }
  let last = -1e9;
  pts.forEach((p, i) => {
    if (!p.d.endsWith('-01')) return;
    const xx = x(i);
    if (xx - last < (narrow ? 44 : 56) || xx > W - 16) return;
    last = xx;
    el('text', { x: xx, y: H - 6, 'text-anchor': 'middle' }, ax).textContent = p.d.slice(0, 4);
  });

  // forecast divider
  const xf = (x(hn - 1) + x(hn)) / 2;
  el('line', { x1: xf, x2: xf, y1: m.t - 10, y2: H - m.b, style: 'stroke:var(--muted);stroke-dasharray:3 4' }, svg);
  const roomRight = W - m.r - xf > 72;
  el('text', { x: roomRight ? xf + 6 : xf - 6, y: m.t - 8, class: 'ax', 'text-anchor': roomRight ? 'start' : 'end' }, svg)
    .textContent = roomRight ? 'forecast →' : 'forecast ↘';

  // band
  let bd = `M${x(hn - 1)},${y(pts[hn - 1].v)}`;
  for (let i = hn; i < n; i++) bd += `L${x(i)},${y(pts[i].hi)}`;
  for (let i = n - 1; i >= hn; i--) bd += `L${x(i)},${y(pts[i].lo)}`;
  const band = el('path', { d: bd + 'Z', style: 'fill:var(--c-acc);opacity:.16' }, svg);

  const line = (a, b) => pts.slice(a, b).map((p, j) => (j ? 'L' : 'M') + x(a + j).toFixed(1) + ',' + y(p.v).toFixed(1)).join('');
  const ph = el('path', { d: line(0, hn), style: 'fill:none;stroke:var(--ink);stroke-width:2;stroke-linejoin:round' }, svg);
  const pf = el('path', { d: line(hn - 1, n), style: 'fill:none;stroke:var(--c-acc);stroke-width:2.2;stroke-linejoin:round' }, svg);

  if (opt.pulse) {
    const lp = pts[n - 1];
    el('circle', { cx: x(n - 1), cy: y(lp.v), r: 5, class: 'pulse', style: 'fill:var(--c-acc)' }, svg);
    el('circle', { cx: x(n - 1), cy: y(lp.v), r: 4, style: 'fill:var(--c-acc);stroke:var(--paper);stroke-width:2' }, svg);
  }
  if (animate) {
    drawIn(ph, 1800);
    drawIn(pf, 800, 1700);
    if (!reduce) band.animate([{ opacity: 0 }, { opacity: .16 }], { duration: 700, delay: 2000, fill: 'backwards' });
  }

  // hover layer
  const cross = el('line', { y1: m.t, y2: H - m.b, style: 'stroke:var(--ink);stroke-width:1;opacity:0' }, svg);
  const dot = el('circle', { r: 5, style: 'fill:var(--ink);stroke:var(--card);stroke-width:2;opacity:0' }, svg);
  const tip = document.createElement('div');
  tip.className = 'tip';
  box.appendChild(tip);
  const hit = el('rect', { x: m.l, y: 0, width: W - m.l - m.r, height: H, style: 'fill:transparent;cursor:crosshair' }, svg);
  function show(i) {
    const p = pts[i], xx = x(i), yy = y(p.v);
    cross.setAttribute('x1', xx); cross.setAttribute('x2', xx);
    dot.setAttribute('cx', xx); dot.setAttribute('cy', yy);
    dot.style.fill = p.f ? 'var(--c-acc)' : 'var(--ink)';
    cross.style.opacity = .35; dot.style.opacity = 1; tip.style.opacity = 1;
    tip.innerHTML = p.f
      ? `${mlabel(p.d)} · forecast <b>${fmtK(p.v)}</b><br><span style="opacity:.75">band ${fmtK(p.lo)} to ${fmtK(p.hi)}</span>`
      : `${mlabel(p.d)} · <b>${fmtK(p.v)}</b> units`;
    tip.style.left = Math.max(70, Math.min(W - 70, xx)) + 'px';
    tip.style.top = Math.max(yy, 52) + 'px';
    onHover && onHover(p);
  }
  function hide() { cross.style.opacity = 0; dot.style.opacity = 0; tip.style.opacity = 0; onHover && onHover(null); }
  hit.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect();
    const i = Math.round((e.clientX - r.left - m.l) / (W - m.l - m.r) * (n - 1));
    show(Math.max(0, Math.min(n - 1, i)));
  });
  hit.addEventListener('pointerleave', hide);
}

/* ---- hero ---- */
const heroBox = $('#heroChart');
let heroDrawn = false;
function drawHero(animate) {
  timeChart(heroBox, { hist: D.phones.hist.Apple, fc: D.phones.fc.Apple, animate, pulse: true });
}

/* ---- phones ---- */
let brand = 'Apple';
const phoneBox = $('#phoneChart'), phoneRead = $('#phoneReadout');
function phoneSummary() {
  const h = D.phones.hist[brand], f = D.phones.fc[brand];
  const next = f.reduce((s, d) => s + d[1], 0);
  const prev = h.slice(-12).reduce((s, d) => s + d[1], 0);
  const ch = (next / prev - 1) * 100;
  const peak = f.reduce((a, d) => d[1] > a[1] ? d : a);
  const chs = Math.abs(ch) < 1 ? `${ch >= 0 ? '+' : '−'}${Math.abs(ch).toFixed(1)}%` : `${ch >= 0 ? '+' : '−'}${Math.abs(ch).toFixed(0)}%`;
  phoneRead.innerHTML = `<strong>${fmtK(next)} ${brand} phones in 12 months</strong>`
    + `Forecast for Dec 2025 to Nov 2026 · ${chs} vs the year before · peak: ${mlabel(peak[0])}`;
}
function drawPhones(animate) {
  const start = D.phones.hist[brand].findIndex(d => d[0] === '2022-01');
  timeChart(phoneBox, { hist: D.phones.hist[brand].slice(start), fc: D.phones.fc[brand], animate });
  phoneSummary();
}
$$('#phoneTabs button').forEach(b => b.addEventListener('click', () => {
  $$('#phoneTabs button').forEach(x => x.setAttribute('aria-selected', x === b));
  brand = b.dataset.b;
  drawPhones(true);
}));

/* ================= Adobe: Prophet vs N-HiTS ================= */
const A = D.adobe, adobeBox = $('#adobeChart'), slider = $('#adobeSlider'), adobeRead = $('#adobeReadout');
let adobeSel = 0, adobeSet = null, adobeTouched = false;
function adobeText(i) {
  const h = A.horizons[i], nh = A.nhits[i], pr = A.prophet[i];
  const win = nh < pr ? 'N-HiTS' : 'Prophet', lo = Math.min(nh, pr), hi = Math.max(nh, pr);
  const pct = Math.round((hi - lo) / hi * 100);
  const head = pct < 5 ? `${h} days ahead: nearly a tie` : `${h} days ahead: ${win} wins`;
  adobeRead.innerHTML = `<strong>${head}</strong>N-HiTS $${nh.toFixed(2)} vs Prophet $${pr.toFixed(2)} · ${win} is ${pct}% more accurate`;
}
function drawAdobe(animate) {
  adobeBox.innerHTML = '';
  const W = adobeBox.clientWidth, H = adobeBox.clientHeight;
  if (!W) return;
  const narrow = W < 520, n = 6;
  const m = { l: 40, r: narrow ? 70 : 108, t: 26, b: 28 };
  const ymax = 60;
  const x = i => m.l + (i + .5) / n * (W - m.l - m.r), step = (W - m.l - m.r) / n;
  const y = v => H - m.b - v / ymax * (H - m.t - m.b);
  const svg = el('svg', { class: 'c', viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': 'Line chart of forecast error by horizon. N-HiTS has lower error up to 60 days; Prophet has lower error from 90 to 250 days.' }, adobeBox);
  const g = el('g', { class: 'grid' }, svg), ax = el('g', { class: 'ax' }, svg);
  const hl = el('rect', { y: m.t - 8, height: H - m.t - m.b + 8, width: step * .78, rx: 8, style: 'fill:var(--paper-2);transition:x .45s cubic-bezier(.2,.7,.2,1)' }, svg);
  for (let v = 0; v <= ymax; v += 15) {
    el('line', { x1: m.l, x2: W - m.r + 8, y1: y(v), y2: y(v) }, g);
    el('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, ax).textContent = '$' + v;
  }
  A.horizons.forEach((h, i) => { el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, ax).textContent = h + 'd'; });
  // crossover marker between 60d and 90d
  const xc = (x(2) + x(3)) / 2;
  el('line', { x1: xc, x2: xc, y1: m.t - 6, y2: H - m.b, style: 'stroke:var(--c-sec);stroke-width:1.5;stroke-dasharray:2 4' }, svg);
  el('text', { x: xc, y: m.t - 12, 'text-anchor': 'middle', class: 'lbl m' }, svg).textContent = 'winner flips';

  const series = [
    ['naive', narrow ? 'Naive' : 'Naive baseline', 'var(--c-ref)', '5 5'],
    ['prophet', 'Prophet', 'var(--c-main)', ''],
    ['nhits', 'N-HiTS', 'var(--c-acc)', ''],
  ];
  const dots = {};
  series.forEach(([k, name, col, dash], si) => {
    const d = A[k].map((v, i) => (i ? 'L' : 'M') + x(i) + ',' + y(v)).join('');
    const p = el('path', { d, style: `fill:none;stroke:${col};stroke-width:2;stroke-dasharray:${dash || 'none'}` }, svg);
    if (animate && !dash) drawIn(p, 1200, si * 150);
    dots[k] = A[k].map((v, i) => el('circle', { cx: x(i), cy: y(v), r: 4,
      style: `fill:${col};stroke:var(--card);stroke-width:2;transition:r .3s` }, svg));
    el('text', { x: x(n - 1) + 12, y: y(A[k][n - 1]) + 4, class: 'lbl' + (dash ? ' m' : '') }, svg).textContent = name;
  });
  // click targets per column
  A.horizons.forEach((h, i) => {
    const r = el('rect', { x: x(i) - step / 2, y: 0, width: step, height: H, style: 'fill:transparent;cursor:pointer' }, svg);
    r.addEventListener('click', () => { adobeTouched = true; selAdobe(i); });
  });
  adobeSet = i => {
    hl.setAttribute('x', x(i) - step * .39);
    ['prophet', 'nhits', 'naive'].forEach(k => dots[k].forEach((c, j) => c.setAttribute('r', j === i ? (k === 'naive' ? 4.5 : 6.5) : 4)));
  };
  adobeSet(adobeSel);
}
function selAdobe(i) { adobeSel = i; slider.value = i; adobeSet && adobeSet(i); adobeText(i); }
slider.addEventListener('input', () => { adobeTouched = true; selAdobe(+slider.value); });
adobeText(0);
async function adobeSweep() {
  for (let i = 1; i <= 5 && !adobeTouched; i++) { await sleep(900); if (!adobeTouched) selAdobe(i); }
  await sleep(900);
  if (!adobeTouched) selAdobe(0);
}

/* ================= Avatar post-mortem ================= */
const AV = D.avatar, avBox = $('#avChart'), avNote = $('#avNote'), avBtn = $('#avReveal');
let avIdx = 0, avState = { base: 0, fin: 0, act: 0 }, avDraw = null, avRevealed = false;
function buildAv() {
  avBox.innerHTML = '';
  const W = avBox.clientWidth, H = avBox.clientHeight;
  if (!W) return;
  const narrow = W < 520;
  const m = { l: 46, r: 8, t: 30, b: 40 }, ymax = 250e6;
  const bw = (W - m.l - m.r) / 4, w = bw * (narrow ? .62 : .5);
  const cx = i => m.l + bw * (i + .5);
  const y = v => H - m.b - v / ymax * (H - m.t - m.b);
  const svg = el('svg', { class: 'c', viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': 'Waterfall: raw model prediction, uplift adjustment, final prediction, and actual opening weekend.' }, avBox);
  const g = el('g', { class: 'grid' }, svg), ax = el('g', { class: 'ax' }, svg);
  for (let v = 0; v <= ymax; v += 50e6) {
    el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, g);
    el('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, ax).textContent = v ? fmtM(v) : '0';
  }
  const cats = narrow ? ['Raw model', 'Correction', 'Forecast', 'Actual'] : ['Raw model', 'Correction ×1.76', 'My forecast', 'Actual first week'];
  cats.forEach((c, i) => { el('text', { x: cx(i), y: H - 14, 'text-anchor': 'middle', class: 'lbl m' }, svg).textContent = c; });
  const mk = (col, extra = '') => el('rect', { x: 0, width: w, rx: 3, style: `fill:${col};${extra}` }, svg);
  const r1 = mk('var(--c-main)'), r2 = mk('var(--c-acc)'), r3 = mk('var(--ink)', 'opacity:.88'), r4 = mk('var(--c-sec)');
  [r1, r2, r3, r4].forEach((r, i) => r.setAttribute('x', cx(i) - w / 2));
  const c12 = el('line', { style: 'stroke:var(--muted);stroke-dasharray:3 3' }, svg);
  const c23 = el('line', { style: 'stroke:var(--muted);stroke-dasharray:3 3' }, svg);
  const lab = [0, 1, 2, 3].map(i => el('text', { x: cx(i), 'text-anchor': 'middle', class: 'lbl' }, svg));
  const aLine = el('line', { x1: m.l, x2: W - m.r, style: 'stroke:var(--c-sec);stroke-width:1.5;stroke-dasharray:6 4' }, svg);
  avDraw = s => {
    const set = (r, a, b) => { r.setAttribute('y', y(Math.max(a, b))); r.setAttribute('height', Math.max(0, Math.abs(y(a) - y(b)))); };
    set(r1, 0, s.base); set(r2, s.base, s.fin); set(r3, 0, s.fin); set(r4, 0, AV.actual * s.act);
    c12.setAttribute('x1', cx(0) + w / 2); c12.setAttribute('x2', cx(1) - w / 2); c12.setAttribute('y1', y(s.base)); c12.setAttribute('y2', y(s.base));
    c23.setAttribute('x1', cx(1) + w / 2); c23.setAttribute('x2', cx(2) - w / 2); c23.setAttribute('y1', y(s.fin)); c23.setAttribute('y2', y(s.fin));
    const vals = [s.base, s.fin - s.base, s.fin, AV.actual * s.act];
    const tops = [s.base, s.fin, s.fin, AV.actual * s.act];
    lab.forEach((t, i) => {
      t.setAttribute('y', y(tops[i]) - 8);
      t.textContent = i === 1 ? '+' + fmtM(vals[i]) : (vals[i] > 1e6 ? fmtM(vals[i]) : '');
      t.style.opacity = i === 3 ? s.act : 1;
    });
    aLine.setAttribute('y1', y(AV.actual)); aLine.setAttribute('y2', y(AV.actual));
    aLine.style.opacity = s.act;
  };
  avDraw(avState);
}
function avTo(idx) {
  const sc = AV.scenarios[idx], from = { ...avState }, to = { base: sc.base, fin: sc.final, act: avRevealed ? 1 : 0 };
  tween(900, e => {
    avState = { base: from.base + (to.base - from.base) * e, fin: from.fin + (to.fin - from.fin) * e, act: from.act + (to.act - from.act) * e };
    avDraw && avDraw(avState);
  });
  if (avRevealed) {
    const off = v => { const d = Math.round((v / AV.actual - 1) * 100); return `${Math.abs(d)}% ${d >= 0 ? 'over' : 'under'}`; };
    avNote.innerHTML = `Actual first week: <b>$153.8M</b>. The raw model was ${off(sc.base)}; the corrected forecast was ${off(sc.final)}.`;
  }
}
avBtn.addEventListener('click', () => {
  avRevealed = !avRevealed;
  avBtn.textContent = avRevealed ? 'Hide the actual' : 'Show the actual first week';
  if (!avRevealed) avNote.textContent = 'Actual: $153.8M, Dec 19 to 25, 2025 (The Numbers).';
  avTo(avIdx);
});

/* ================= Tender pipeline ================= */
const pipe = $('#pipe'), dotsBox = $('#pipeDots'), stages = $$('#pipe .stage'), pipeBtn = $('#pipeRun'), pipeNote = $('#pipeNote');
let piping = false;
function sbox(i) {
  const r = stages[i].getBoundingClientRect(), p = pipe.getBoundingClientRect();
  return { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height };
}
const rndIn = b => [b.x + 10 + Math.random() * (b.w - 26), b.y + 10 + Math.random() * (b.h * .58 - 10)];
function mv(d, x, y, o = {}) {
  const to = `translate(${x}px,${y}px) scale(${o.s ?? 1})`;
  const a = d.animate([{ transform: d.style.transform, opacity: d.style.opacity || 1 }, { transform: to, opacity: o.o ?? 1 }],
    { duration: reduce ? 1 : (o.dur || 750), delay: reduce ? 0 : (o.delay || 0), easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
  d.style.transform = to; d.style.opacity = o.o ?? 1; d._x = x; d._y = y;
  return a.finished;
}
async function runPipe() {
  if (piping) return;
  piping = true; pipeBtn.disabled = true;
  dotsBox.innerHTML = ''; stages.forEach(s => s.classList.remove('on'));
  const N = 100, keep = new Set();
  while (keep.size < 4) keep.add(Math.floor(Math.random() * N));
  const dots = [];
  const b0 = sbox(0);
  for (let i = 0; i < N; i++) {
    const d = document.createElement('i');
    const [x, y] = rndIn(b0);
    d.style.transform = `translate(${x}px,${y}px) scale(0)`;
    d.style.opacity = 1;
    dotsBox.appendChild(d); dots.push(d);
  }
  stages[0].classList.add('on');
  pipeNote.textContent = 'Fetching about 1,000 new notices from several portals…';
  await Promise.all(dots.map((d, i) => { const [x, y] = rndIn(b0); return mv(d, x, y, { delay: i * 9, dur: 500 }); }));
  await sleep(300);
  stages[1].classList.add('on');
  pipeNote.textContent = 'Removing duplicates, then a keyword filter on titles, in English and Bangla…';
  const b1 = sbox(1);
  await Promise.all(dots.map((d, i) => { const [x, y] = rndIn(b1); return mv(d, x, y, { delay: i * 5 }); }));
  await sleep(250);
  pipeNote.textContent = 'About 1,000 → about 40 left.';
  await Promise.all(dots.map((d, i) => {
    if (keep.has(i)) { d.classList.add('keep'); return Promise.resolve(); }
    return mv(d, d._x, d._y + 60, { o: 0, s: .4, delay: Math.random() * 300, dur: 600 });
  }));
  stages[2].classList.add('on');
  pipeNote.textContent = 'An AI model rates each shortlisted tender\'s fit from 0 to 10 and writes a one-line reason.';
  const b2 = sbox(2), kept = dots.filter((d, i) => keep.has(i));
  await Promise.all(kept.map((d, j) => mv(d, b2.x + b2.w / 2 - 5, b2.y + 18 + j * 24, { delay: j * 90 })));
  await sleep(700);
  stages[3].classList.add('on');
  const b3 = sbox(3);
  await Promise.all(kept.map((d, j) => mv(d, b3.x + b3.w / 2 - 5 + (j - 1.5) * 4, b3.y + 40, { delay: j * 90, s: 1.2 })));
  pipeNote.textContent = 'The ranked digest goes out by email, and the results are logged to the Google Sheet.';
  pipeBtn.textContent = 'Run it again';
  pipeBtn.disabled = false; piping = false;
}
pipeBtn.addEventListener('click', runPipe);

/* ================= TripMate agent replay ================= */
const agentBtn = $('#agentRun'), tools = $$('#agentTools li'), plan = $('#agentPlan'), agentNote = $('#agentNote');
let agentRunning = false;
async function runAgent() {
  if (agentRunning) return;
  agentRunning = true; agentBtn.disabled = true;
  tools.forEach(l => { l.className = ''; });
  plan.classList.toggle('on', false);
  agentNote.textContent = 'Reading the request…';
  await sleep(600);
  agentNote.textContent = 'Calling tools…';
  for (let i = 0; i < tools.length; i++) {
    tools[i].className = 'on busy';
    await sleep(420);
    tools[i].className = 'on done';
  }
  agentNote.textContent = 'Writing the plan from the results.';
  await sleep(500);
  plan.classList.toggle('on', true);
  agentBtn.textContent = '↻ Replay';
  agentBtn.disabled = false; agentRunning = false;
}
agentBtn.addEventListener('click', runAgent);

/* ================= YouTube steps ================= */
const ySteps = $$('#ytSteps li'), yDetail = $('#ytDetail'), yList = $('#ytSteps');
let yCur = 0, yTimer = null;
ySteps.forEach((li, i) => {
  const b = li.querySelector('button');
  b.dataset.n = i + 1;
  b.setAttribute('aria-label', `Step ${i + 1}: ${li.querySelector('b').textContent}`);
  b.addEventListener('click', () => { clearInterval(yTimer); ySet(i); });
});
function ySet(i) {
  yCur = i;
  ySteps.forEach((li, j) => { li.classList.toggle('done', j <= i); li.classList.toggle('cur', j === i); });
  yList.style.setProperty('--prog', (i / (ySteps.length - 1) * 86) + '%');
  yDetail.innerHTML = `<b>${ySteps[i].querySelector('b').textContent}.</b>${ySteps[i].querySelector('p').textContent}`;
}
ySet(0);
function yPlay() {
  if (reduce) return;
  yTimer = setInterval(() => ySet((yCur + 1) % ySteps.length), 1700);
}

/* ================= Research phases ================= */
const PH = [
  'Default is treated as a technical matter. The circulars talk about classification, overdue periods and provisioning: how long a loan has gone unpaid, and how much a bank must set aside for it.',
  'Rule after rule gives borrowers more room. We argue that this decade of forbearance normalised delayed loss recognition and weakened repayment discipline: problems were pushed forward instead of recognised.',
  'The language turns moral. With the Bank Company (Amendment) Act 2023, the focus shifts to the <q>willful defaulter</q>: a borrower who could pay but won\'t. The question is no longer only how late a loan is, but what the borrower intended. We recommend independent viability assessment and risk-based supervision instead.'
];
const phText = $('#phaseText'), phFill = $('#phaseFill');
function phSet(i) {
  $$('#phases button').forEach(b => b.setAttribute('aria-selected', +b.dataset.p === i));
  phFill.style.width = ((i + 1) / 3 * 100) + '%';
  phText.animate && !reduce && phText.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 400 });
  phText.innerHTML = PH[i];
}
$$('#phases button').forEach(b => b.addEventListener('click', () => phSet(+b.dataset.p)));
phSet(0);

/* ================= Internship report ================= */
const IR = { said: 42, did: 20, n: 44 };
const dotsBox44 = $('#dots44'), gapNum = $('#gapNum');
for (let i = 0; i < IR.n; i++) dotsBox44.appendChild(document.createElement('i'));
const dot44 = [...dotsBox44.children];
function irShow(k) {
  $$('#irGap .chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.k === k));
  const v = IR[k];
  dot44.forEach((d, i) => { d.className = i < v ? 'on ' + k : ''; d.style.transitionDelay = reduce ? '0s' : (i * 12) + 'ms'; });
  gapNum.innerHTML = k === 'said'
    ? `<strong>${v} of ${IR.n}</strong> rated checking AI output essential`
    : `<strong>${v} of ${IR.n}</strong> had used AI output without reviewing it in the past month`;
}
$$('#irGap .chip').forEach(c => c.addEventListener('click', () => { irAuto = false; irShow(c.dataset.k); }));
irShow('said');
let irAuto = true;
once(dotsBox44, async () => { await sleep(1400); if (irAuto) irShow('did'); }, 0.6);

const DOM = [
  ['D1', 'Understanding how AI works and its limits', ['How AI produces outputs', 'What a tool can and cannot reliably do, including in Bangla', 'AI inside everyday software']],
  ['D2', 'Choosing which tasks to use AI for', ['Tasks AI can support', 'Whether to use AI at all', 'Dividing work between AI and people', 'Choosing and judging a tool', 'Setting up a simple automation or agent, and limiting what it may do without approval']],
  ['D3', 'Giving instructions and working with AI', ['Instructing AI using only permitted inputs', 'Refining results and knowing when to stop', "Keeping one's own reasoning and voice", 'Using AI in shared work with consent']],
  ['D4', 'Checking AI outputs for errors and bias', ['Checking against trusted sources', 'Judging fitness for purpose', 'Spotting biased or unfair content']],
  ['D5', 'Protecting data and privacy', ['Deciding what may be entered', 'Handling personal data lawfully, including transfer abroad', 'Using approved tools and recognizing unsafe services']],
  ['D6', 'Staying responsible for AI-assisted work', ['Taking full responsibility; never submitting unchecked work', 'Keeping decisions about people under human judgement', 'Matching checks to the stakes and escalating']],
  ['D7', 'Ethical, fair and lawful use', ['Following organizational AI rules and law, including approval', 'Respecting copyright and disclosing AI use', 'Recognizing and reporting misuse', 'Weighing the fairness of a particular use', "Describing AI's wider social and environmental effects"]],
  ['DX', 'Keeping skills current and helping colleagues', ["Keeping one's own competence current", 'Helping colleagues use AI well']],
];
const domList = $('#domains'), domDetail = $('#domDetail');
DOM.forEach((d, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<button type="button" aria-pressed="false"><span>${d[0]}</span>${d[1]}<em>${d[2].length}</em></button>`;
  li.querySelector('button').addEventListener('click', () => domSel(i));
  domList.appendChild(li);
});
function domSel(i) {
  $$('#domains button').forEach((b, j) => b.setAttribute('aria-pressed', j === i));
  domDetail.innerHTML = `<b>${DOM[i][0]} · ${DOM[i][1]}</b><ul>${DOM[i][2].map(c => `<li>${c}</li>`).join('')}</ul>`;
}
domSel(3);
$$('#irTabs button').forEach(b => b.addEventListener('click', () => {
  $$('#irTabs button').forEach(x => x.setAttribute('aria-selected', x === b));
  $('#irGap').hidden = b.dataset.v !== 'gap';
  $('#irFw').hidden = b.dataset.v !== 'fw';
}));

/* ================= Gantt ================= */
const G = [
  { k: 'b', role: 'Intern', org: 'BuildNation Limited', s: '2026-08', e: '2026-11', sub: 'AI Accelerator programs · public & private partnerships', pts: [
    'Built a 5-year project valuation in Excel (NPV, IRR, payback, sensitivity) that helped management decide whether to invest BDT 14 lakh+ in a training centre and recording studio.',
    'Researched grants, partners and competitors for top management, engaged government and international stakeholders, and completed registrations on UNGM, UNDP Quantum, e-GP, BRAC eTender and other procurement portals.',
    'Helped plan and coordinate AI Accelerator upskilling programs; audited LMS platforms and built an acceptance-testing tracker that turned required features into end-to-end user journeys for the vendor.',
    'Main vendor contact for the website and LMS build: designed the website UI and directed design and content.',
    'Built TenderScreener to automate tender screening.'] },
  { k: 't', role: 'AI Trainer', org: 'Talent Technologies and Solutions', s: '2026-05', e: '2026-08', pts: [
    'Audited AI annotation data against strict QA guidelines, found and resolved discrepancies, and applied consistent judgement to ambiguous cases so the data was fit for model training.'] },
  { k: 'r', role: 'Research Assistant', org: 'Freelance financial & economic research', s: '2024-12', e: '2026-08', pts: [
    'Analysed financial statements, bank asset-quality metrics and regulatory reports across four papers on RMG policy, banking governance, credit risk and trade finance. The papers are accepted or under review.',
    'Designed and ran interviews, surveys and stakeholder mapping with banking and trade-finance practitioners to test desk findings.'] },
  { k: 'edu', role: 'BBA, Finance', org: 'IBA, University of Dhaka', s: '2022-08', e: '2026-08', pts: [
    'Major in Finance, minor in Data Analytics. CGPA 3.31 / 4.00.'] },
];
const gBox = $('#gantt'), gDet = $('#ganttDetail');
const mi = s => +s.slice(0, 4) * 12 + (+s.slice(5, 7) - 1);
const A0 = mi('2024-06'), A1 = mi('2026-12');
const pos = s => Math.max(0, (mi(s) - A0) / (A1 - A0) * 100);
const span = (s, e) => {
  const f = s => MON[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4);
  return f(s) + ' to ' + f(e);
};
function buildGantt() {
  let h = '<div class="g-axis"><span class="g-lab"></span><div class="g-track">';
  ['2024-07', '2025-01', '2025-07', '2026-01', '2026-07'].forEach(t => {
    h += `<span style="left:${pos(t)}%">${t.endsWith('01') ? t.slice(0, 4) : 'Jul'}</span>`;
  });
  h += '</div></div>';
  G.forEach((r, i) => {
    const l = pos(r.s), w = pos(r.e) - l;
    h += `<button class="g-row" type="button" data-i="${i}" aria-pressed="false">
      <span class="g-lab"><b>${r.role}</b><small>${r.org}</small></span>
      <span class="g-track"><span class="g-bar ${r.k}" style="left:${l}%;width:${w}%">${mi(r.s) < A0 ? '<em>← since 2022</em>' : ''}</span></span>
    </button>`;
  });
  gBox.innerHTML = h;
  $$('.g-row').forEach(b => b.addEventListener('click', () => gSel(+b.dataset.i)));
}
function gSel(i) {
  $$('.g-row').forEach(b => b.setAttribute('aria-pressed', +b.dataset.i === i));
  const r = G[i];
  gDet.innerHTML = `<h4>${r.role} · ${r.org}</h4><p class="when">${span(r.s, r.e)}${r.sub ? ' · ' + r.sub : ''}</p><ul>${r.pts.map(p => `<li>${p}</li>`).join('')}</ul>`;
}
buildGantt(); gSel(0);
once(gBox, () => gBox.classList.add('in'), 0.3);

/* ================= Count-up ================= */
$$('[data-count]').forEach(n => {
  const end = +n.dataset.count;
  if (reduce) return;
  // the real number stays in the HTML until the count-up starts on screen
  once(n, () => tween(1200, e => { n.textContent = Math.round(end * e).toLocaleString('en-US'); }), 0.6);
});

/* ================= Reveal, nav, progress ================= */
const rio = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); }
}), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
$$('.rv').forEach(n => rio.observe(n));

const nav = $('#nav'), bar = $('#progress');
const links = $$('.nav nav a');
function onScroll() {
  const s = scrollY, max = document.documentElement.scrollHeight - innerHeight;
  bar.style.width = (max > 0 ? s / max * 100 : 0) + '%';
  nav.classList.toggle('scrolled', s > 8);
}
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const sio = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
['work', 'research', 'path', 'contact'].forEach(id => sio.observe(document.getElementById(id)));

/* ================= Theme ================= */
$('#theme').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
});

/* ================= Boot ================= */
function drawAll(animate) {
  drawHero(animate && !heroDrawn); heroDrawn = true;
  drawPhones(false);
  drawAdobe(false);
  buildAv();
}
drawAll(true);
// trigger on the figure itself, not the whole chapter: stacked chapters on phones are taller than the screen
once($('#adobeChart'), () => { drawAdobe(true); adobeSweep(); }, 0.6);
once($('#phoneChart'), () => drawPhones(true), 0.6);
once($('#avChart'), () => avTo(avIdx), 0.6);
once($('#pipe'), () => setTimeout(runPipe, 300), 0.6);
once($('#agentTools'), () => setTimeout(runAgent, 300), 0.5);
once($('#ytSteps'), yPlay, 0.6);

let lastW = innerWidth, rt;
addEventListener('resize', () => {
  if (innerWidth === lastW) return;
  lastW = innerWidth;
  clearTimeout(rt);
  rt = setTimeout(() => { drawHero(false); drawPhones(false); drawAdobe(false); buildAv(); }, 150);
});
})();
