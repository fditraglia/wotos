'use strict';

// The three cards, as (side 1, side 2).
const CARDS = [['gaga', 'gaga'], ['obama', 'gaga'], ['obama', 'obama']];
const NAMES = { obama: 'Obama', gaga: 'Gaga' };
const IMAGES = { obama: 'img/obama.jpg', gaga: 'img/gaga.jpg' };

const $ = id => document.getElementById(id);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const wait = ms => new Promise(resolve => setTimeout(resolve, reduceMotion.matches ? 0 : ms));
const fmt = new Intl.NumberFormat('en-US');

function randomInt(n) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
}

// Pick a card uniformly at random, then pick which side faces up.
function drawCard() {
  const card = randomInt(3);
  const [a, b] = CARDS[card];
  return randomInt(2) ? { up: b, down: a } : { up: a, down: b };
}

// ---------------------------------------------------------------- Modes

const tabs = { one: $('tab-one'), many: $('tab-many') };
const panels = { one: $('one'), many: $('many') };

function showMode() {
  const mode = location.hash === '#many' ? 'many' : 'one';
  for (const key of Object.keys(panels)) {
    const active = key === mode;
    panels[key].hidden = !active;
    tabs[key].setAttribute('aria-selected', String(active));
  }
  if (mode === 'many') renderSim();
}

for (const key of Object.keys(tabs)) {
  tabs[key].addEventListener('click', () => {
    history.replaceState(null, '', `#${key}`);
    showMode();
  });
}
window.addEventListener('hashchange', showMode);

// ---------------------------------------------------------------- One at a time

const deck = $('deck');
const drawn = $('drawn');
const flipper = $('flipper');
const frontFace = $('front-face');
const backFace = $('back-face');
const drawBtn = $('draw-btn');
const drawStatus = $('draw-status');

let drawState = 'ready'; // 'ready' -> 'drawn' -> 'flipped' -> 'drawn' -> ...
let current = null;

function setFace(face, who) {
  const img = face.querySelector('img');
  img.src = IMAGES[who];
  img.alt = NAMES[who];
  face.querySelector('figcaption').textContent = NAMES[who];
}

function restart(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

async function shuffleAndDraw() {
  drawBtn.disabled = true;
  // On a phone the setup can leave the card or button partly off screen; bring both into view.
  const stageTop = panels.one.getBoundingClientRect().top;
  if (stageTop < 0 || drawBtn.getBoundingClientRect().bottom > window.innerHeight) {
    panels.one.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }
  drawn.hidden = true;
  deck.hidden = false;
  drawStatus.textContent = 'Shuffling…';
  restart(deck, 'shuffling');
  await wait(950);
  deck.classList.remove('shuffling');

  current = drawCard();
  flipper.classList.add('no-transition');
  flipper.classList.remove('flipped');
  void flipper.offsetWidth;
  flipper.classList.remove('no-transition');
  setFace(frontFace, current.up);
  setFace(backFace, current.down);
  frontFace.removeAttribute('aria-hidden');
  backFace.setAttribute('aria-hidden', 'true');

  deck.hidden = true;
  drawn.hidden = false;
  restart(drawn, 'dealt');
  drawStatus.textContent = `Facing up: ${NAMES[current.up]}.`;
  drawBtn.textContent = 'Flip the card';
  drawState = 'drawn';
  drawBtn.disabled = false;
}

function flipCard() {
  flipper.classList.add('flipped');
  frontFace.setAttribute('aria-hidden', 'true');
  backFace.removeAttribute('aria-hidden');
  drawStatus.textContent = `On the other side: ${NAMES[current.down]}.`;
  drawBtn.textContent = 'Draw again';
  drawState = 'flipped';
  recordRound(current);
}

drawBtn.addEventListener('click', () => {
  if (drawState === 'drawn') flipCard();
  else shuffleAndDraw();
});

// The tally survives a reload, so an accidental refresh mid-class loses nothing.
const TALLY_KEY = 'wotos-tally';
const emptyTally = () => ({ rounds: 0, obamaUp: 0, obamaBoth: 0 });

function loadTally() {
  try {
    const t = JSON.parse(localStorage.getItem(TALLY_KEY));
    if (t && Number.isInteger(t.rounds)) return t;
  } catch {}
  return emptyTally();
}

let tally = loadTally();

function saveTally() {
  try {
    localStorage.setItem(TALLY_KEY, JSON.stringify(tally));
  } catch {}
}

function renderTally() {
  $('t-rounds').textContent = fmt.format(tally.rounds);
  $('t-up').textContent = fmt.format(tally.obamaUp);
  $('t-both').textContent = fmt.format(tally.obamaBoth);
}

function recordRound(d) {
  tally.rounds++;
  if (d.up === 'obama') {
    tally.obamaUp++;
    if (d.down === 'obama') tally.obamaBoth++;
  }
  saveTally();
  renderTally();
}

// Resetting takes two taps, so a stray tap cannot wipe the tally.
const resetBtn = $('tally-reset');
let resetTimer = null;

resetBtn.addEventListener('click', () => {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
    tally = emptyTally();
    saveTally();
    renderTally();
    resetBtn.textContent = 'Reset tally';
    return;
  }
  resetBtn.textContent = 'Tap again to reset';
  resetTimer = setTimeout(() => {
    resetTimer = null;
    resetBtn.textContent = 'Reset tally';
  }, 3000);
});

renderTally();

// ---------------------------------------------------------------- Many at once

// Outcome codes: 0 = Gaga facing up, 1 = Obama up and Gaga on the other side,
// 2 = Obama on both sides.
const WAFFLE_MAX = 2500;
const DURATION = { 1: 0, 10: 1200, 100: 1600, 1000: 2000 };

const sim = { n: 0, obamaUp: 0, obamaBoth: 0, codes: [], path: [], last: null };
let running = false;
let grouped = false;

function simulateOne() {
  const d = drawCard();
  const code = d.up === 'gaga' ? 0 : d.down === 'gaga' ? 1 : 2;
  sim.n++;
  if (code > 0) {
    sim.obamaUp++;
    if (code === 2) sim.obamaBoth++;
    sim.path.push(sim.obamaBoth / sim.obamaUp);
  }
  if (sim.codes.length < WAFFLE_MAX) sim.codes.push(code);
  sim.last = d;
}

const chips = document.querySelectorAll('.chip');

function setBusy(busy) {
  running = busy;
  for (const chip of chips) chip.disabled = busy;
}

function run(k) {
  if (running) return;
  setBusy(true);
  const duration = reduceMotion.matches ? 0 : DURATION[k];
  const start = performance.now();
  let done = 0;
  const step = now => {
    const target = duration
      ? Math.min(k, Math.max(1, Math.floor((k * (now - start)) / duration)))
      : k;
    while (done < target) {
      simulateOne();
      done++;
    }
    renderSim();
    if (done < k) requestAnimationFrame(step);
    else setBusy(false);
  };
  requestAnimationFrame(step);
}

for (const chip of chips) {
  chip.addEventListener('click', () => run(Number(chip.dataset.k)));
}

$('sim-reset').addEventListener('click', () => {
  if (running) return;
  Object.assign(sim, { n: 0, obamaUp: 0, obamaBoth: 0, codes: [], path: [], last: null });
  renderSim();
});

$('group').addEventListener('change', e => {
  grouped = e.target.checked;
  renderWaffle();
});

$('answer').addEventListener('toggle', renderChart);

function plural(n, word) {
  return `${fmt.format(n)} ${word}${n === 1 ? '' : 's'}`;
}

function renderLatest() {
  for (const [id, side] of [['latest-up', 'up'], ['latest-down', 'down']]) {
    const el = $(id);
    if (!sim.last) {
      el.classList.remove('filled');
      el.innerHTML = '<span>?</span>';
      continue;
    }
    const who = sim.last[side];
    el.classList.add('filled');
    el.innerHTML = `<img src="${IMAGES[who]}" alt="">`;
  }
}

function renderEstimate() {
  const { n, obamaUp: N, obamaBoth: m } = sim;
  $('f-num').textContent = fmt.format(m);
  $('f-den').textContent = fmt.format(N);
  $('f-dec').textContent = N ? `= ${(m / N).toFixed(3)}` : '';
  $('fraction').style.visibility = N ? 'visible' : 'hidden';
  let text;
  if (n === 0) {
    text = 'No draws yet. Choose how many cards to draw.';
  } else if (N === 0) {
    text = `Obama hasn’t been facing up yet in ${plural(n, 'draw')}.`;
  } else {
    text = `Obama was facing up in ${fmt.format(N)} of ${plural(n, 'draw')}. ` +
      `In ${fmt.format(m)} of those ${fmt.format(N)}, he was on the other side too.`;
  }
  $('summary').textContent = text;
  $('l-both').textContent = fmt.format(m);
  $('l-mixed').textContent = fmt.format(N - m);
  $('l-void').textContent = fmt.format(n - N);
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function renderWaffle() {
  const canvas = $('waffle');
  const size = canvas.clientWidth;
  if (!size) return;
  const dpr = window.devicePixelRatio || 1;
  const px = Math.round(size * dpr);
  if (canvas.width !== px) canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const colors = [cssVar('--void'), cssVar('--gaga'), cssVar('--obama')];
  const empty = cssVar('--empty');
  const codes = grouped ? [...sim.codes].sort((a, b) => b - a) : sim.codes;
  const count = codes.length;
  const cols = count <= 100 ? 10 : count <= 400 ? 20 : 50;
  const cell = size / cols;
  const gap = cols === 50 ? 1 : cell * 0.14;
  const radius = cols === 50 ? 0 : cell * 0.12;

  for (let i = 0; i < cols * cols; i++) {
    const x = (i % cols) * cell + gap / 2;
    const y = Math.floor(i / cols) * cell + gap / 2;
    ctx.fillStyle = i < count ? colors[codes[i]] : empty;
    ctx.beginPath();
    if (radius && ctx.roundRect) ctx.roundRect(x, y, cell - gap, cell - gap, radius);
    else ctx.rect(x, y, cell - gap, cell - gap);
    ctx.fill();
  }

  $('waffle-note').textContent = sim.n > WAFFLE_MAX
    ? `Showing the first ${fmt.format(WAFFLE_MAX)} of ${plural(sim.n, 'draw')}; the counts include them all.`
    : '';
}

function niceStep(max, count) {
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

function renderChart() {
  const svg = $('chart');
  const W = svg.clientWidth;
  if (!W) return;
  const H = Math.round(Math.max(200, Math.min(320, W * 0.6)));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('height', H);

  const m = { l: 34, r: 40, t: 12, b: 34 };
  const N = sim.path.length;
  const xmax = Math.max(10, N);
  const x = i => m.l + (i / xmax) * (W - m.l - m.r);
  const y = v => m.t + (1 - v) * (H - m.t - m.b);
  const ink = cssVar('--ink');
  const soft = cssVar('--ink-soft');
  const rule = cssVar('--stock-edge');
  const revealed = $('answer').open;

  let out = '';
  for (const [v, label] of [[0, '0'], [0.5, '1/2'], [1, '1']]) {
    const dash = v === 0.5 ? ' stroke-dasharray="4 4"' : '';
    out += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0.5 ? soft : rule}"${dash}/>`;
    out += `<text x="${m.l - 6}" y="${y(v)}" text-anchor="end" dominant-baseline="middle" font-size="12" fill="${soft}">${label}</text>`;
  }
  if (revealed) {
    const brass = cssVar('--brass-dark');
    out += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(2 / 3)}" y2="${y(2 / 3)}" stroke="${brass}" stroke-width="2"/>`;
    out += `<text x="${W - m.r + 6}" y="${y(2 / 3)}" dominant-baseline="middle" font-size="12" font-weight="600" fill="${brass}">2/3</text>`;
  }

  const step = niceStep(xmax, 4);
  for (let t = 0; t <= xmax; t += step) {
    out += `<text x="${x(t)}" y="${H - m.b + 18}" text-anchor="middle" font-size="12" fill="${soft}">${fmt.format(t)}</text>`;
  }
  out += `<text x="${(m.l + W - m.r) / 2}" y="${H - 2}" text-anchor="middle" font-size="12" fill="${soft}">Draws with Obama facing up</text>`;

  if (N) {
    // Thin the path to at most ~800 vertices; always keep the latest point.
    const stride = Math.max(1, Math.ceil(N / 800));
    let d = '';
    for (let i = 1; i <= N; i += stride) d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(sim.path[i - 1]).toFixed(1)}`;
    d += `L${x(N).toFixed(1)},${y(sim.path[N - 1]).toFixed(1)}`;
    out += `<path d="${d}" fill="none" stroke="${ink}" stroke-width="1.75" stroke-linejoin="round"/>`;
    out += `<circle cx="${x(N)}" cy="${y(sim.path[N - 1])}" r="3.5" fill="${ink}"/>`;
  }
  svg.innerHTML = out;
}

function renderSim() {
  if (panels.many.hidden) return;
  renderLatest();
  renderEstimate();
  renderWaffle();
  renderChart();
}

new ResizeObserver(() => renderSim()).observe(panels.many);

showMode();

// Offline support once deployed; skipped locally so edits show up on reload.
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('sw.js');
}
