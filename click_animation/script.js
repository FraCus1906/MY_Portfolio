const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, DPR;
 
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildGrid();
}
window.addEventListener('resize', resize);
 
// ---------- palette ----------
const PALETTE = [
  { petal: '#c9b6e4', bead: '#e8935a' }, // lavender / orange bead
  { petal: '#f2c14e', bead: '#7a6fb5' }, // yellow / purple bead
  { petal: '#f3a6b2', bead: '#5aa0c9' }, // pink / blue bead
  { petal: '#a9c9e0', bead: '#e85d5d' }, // light blue / red bead
  { petal: '#f0955a', bead: '#f6e27a' }, // orange / yellow bead
  { petal: '#b9cf8a', bead: '#c65fa0' }, // olive green / magenta bead
  { petal: '#d9a7e0', bead: '#8fd0c9' }, // orchid / mint bead
  { petal: '#f4e0c7', bead: '#c98f5a' }, // cream / tan bead
];
 
function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 0xff) + amt, b = (n & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}
function darken(hex, amt) { return lighten(hex, -amt); }
 
// ---------- flower model ----------
let flowers = [];
const COUNT_BASE = 90; // will scale a bit with screen size
 
function rand(a, b) { return a + Math.random() * (b - a); }
 
function makeFlower(i) {
  const col = PALETTE[i % PALETTE.length];
  const f = {
    // current interpolated base position
    x: rand(0, W), y: rand(0, H),
    scatterX: rand(0, W), scatterY: rand(0, H),
    gridX: 0, gridY: 0,
    fromX: 0, fromY: 0, toX: 0, toY: 0,
    size: rand(20, 34),
    rot: rand(0, Math.PI * 2),
    rotSpeed: rand(-0.15, 0.15),
    bobFreq: rand(0.4, 0.9),
    bobPhase: rand(0, Math.PI * 2),
    bobAmp: rand(4, 10),
    petal: col.petal,
    bead: col.bead,
    beadAngle: rand(0, Math.PI * 2),
    // spring-based pointer displacement (persists briefly, eases back to 0)
    offX: 0, offY: 0, offVX: 0, offVY: 0,
    sprite: null, spriteHalf: 0,
  };
  buildSprite(f);
  return f;
}
 
// pre-render a flower (shape + shading + shadow + bead) once onto an
// offscreen canvas, so the animation loop only has to drawImage it —
// avoids recomputing gradients/clip/blur every frame for every flower.
const SS = 2; // supersample factor for crisp edges
function buildSprite(f) {
  const s = f.size;
  const pad = s * 0.9; // room for shadow + highlight bleed
  const half = s * 1.3 + pad;
  const size = Math.ceil(half * 2);
  const off = document.createElement('canvas');
  off.width = size * SS;
  off.height = size * SS;
  const octx = off.getContext('2d');
  octx.scale(SS, SS);
  octx.translate(half, half);
 
  // shadow (blurred once here, not per frame)
  octx.save();
  octx.translate(s * 0.12, s * 0.22);
  octx.filter = 'blur(6px)';
  octx.fillStyle = 'rgba(60,30,50,0.16)';
  petalPathCtx(octx, s * 1.02);
  octx.fill();
  octx.restore();
 
  // shaded body
  octx.save();
  petalPathCtx(octx, s);
  octx.clip();
  const grad = octx.createLinearGradient(-s, -s, s, s);
  grad.addColorStop(0, lighten(f.petal, 45));
  grad.addColorStop(0.45, f.petal);
  grad.addColorStop(1, darken(f.petal, 35));
  octx.fillStyle = grad;
  octx.fillRect(-s * 1.6, -s * 1.6, s * 3.2, s * 3.2);
  const hl = octx.createRadialGradient(-s * 0.4, -s * 0.45, 1, -s * 0.4, -s * 0.45, s * 1.1);
  hl.addColorStop(0, 'rgba(255,255,255,0.75)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  octx.fillStyle = hl;
  octx.fillRect(-s * 1.6, -s * 1.6, s * 3.2, s * 3.2);
  octx.restore();
 
  // bead
  const bx = Math.cos(f.beadAngle) * s * 0.08;
  const by = Math.sin(f.beadAngle) * s * 0.08 - s * 0.05;
  const beadR = s * 0.2;
  const beadGrad = octx.createRadialGradient(bx - beadR * 0.4, by - beadR * 0.4, 1, bx, by, beadR);
  beadGrad.addColorStop(0, lighten(f.bead, 60));
  beadGrad.addColorStop(0.6, f.bead);
  beadGrad.addColorStop(1, darken(f.bead, 30));
  octx.fillStyle = beadGrad;
  octx.beginPath();
  octx.arc(bx, by, beadR, 0, Math.PI * 2);
  octx.fill();
 
  f.sprite = off;
  f.spriteHalf = half;
}
 
function buildGrid() {
  // pick a flower count relative to screen area
  const area = W * H;
  const count = Math.max(24, Math.min(70, Math.round(area / 16000)));
  if (flowers.length !== count) {
    flowers = [];
    for (let i = 0; i < count; i++) flowers.push(makeFlower(i));
  } else {
    flowers.forEach(f => { f.scatterX = rand(0, W); f.scatterY = rand(0, H); });
  }
 
  // compute packed hex-ish grid positions filling the screen
  const n = flowers.length;
  const avgSize = flowers.reduce((s, f) => s + f.size, 0) / n;
  const spacing = avgSize * 1.05;
  const cols = Math.max(1, Math.round(Math.sqrt(n * (W / H))));
  const rows = Math.ceil(n / cols);
  const gridW = cols * spacing;
  const gridH = rows * spacing;
  const offsetX = (W - gridW) / 2 + spacing / 2;
  const offsetY = (H - gridH) / 2 + spacing / 2;
 
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    const rowOffset = (r % 2 === 0) ? 0 : spacing / 2;
    for (let c = 0; c < cols; c++) {
      if (idx >= n) break;
      flowers[idx].gridX = offsetX + c * spacing + rowOffset;
      flowers[idx].gridY = offsetY + r * spacing * 0.87;
      idx++;
    }
  }
}
 
// ---------- pointer interaction ----------
const pointer = { x: -9999, y: -9999, active: false };
function setPointer(x, y) { pointer.x = x; pointer.y = y; pointer.active = true; }
window.addEventListener('mousemove', e => setPointer(e.clientX, e.clientY));
window.addEventListener('mouseleave', () => pointer.active = false);
window.addEventListener('touchmove', e => {
  if (e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });
window.addEventListener('touchend', () => pointer.active = false);
 
// click / tap gives a stronger radial burst
function burst(x, y) {
  flowers.forEach(f => {
    const dx = (f.x + f.offX) - x, dy = (f.y + f.offY) - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const radius = 260;
    if (dist < radius) {
      const push = (1 - dist / radius) * 30;
      f.offVX += (dx / dist) * push;
      f.offVY += (dy / dist) * push;
    }
  });
}
window.addEventListener('click', e => burst(e.clientX, e.clientY));
window.addEventListener('touchstart', e => {
  if (e.touches[0]) burst(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });
 
// ---------- phase state machine ----------
// phases: scatter -> converge -> packed -> disperse -> scatter ...
const DURATIONS = { scatter: 3600, converge: 2200, packed: 2200, disperse: 2200 };
let phase = 'scatter';
let phaseStart = performance.now();
 
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
 
function startPhase(name, now) {
  phase = name;
  phaseStart = now;
  if (name === 'converge') {
    flowers.forEach(f => { f.fromX = f.x; f.fromY = f.y; f.toX = f.gridX; f.toY = f.gridY; });
  } else if (name === 'disperse') {
    flowers.forEach(f => {
      f.scatterX = rand(0, W); f.scatterY = rand(0, H);
      f.fromX = f.x; f.fromY = f.y; f.toX = f.scatterX; f.toY = f.scatterY;
    });
  }
}
 
function updatePhase(now) {
  const elapsed = now - phaseStart;
  const dur = DURATIONS[phase];
  if (elapsed >= dur) {
    const order = { scatter: 'converge', converge: 'packed', packed: 'disperse', disperse: 'scatter' };
    startPhase(order[phase], now);
  }
}
 
// ---------- drawing ----------
function drawFlower(f, t) {
  const bob = Math.sin(t * 0.001 * f.bobFreq * Math.PI * 2 + f.bobPhase) * f.bobAmp;
  let px = f.x + f.offX;
  let py = f.y + f.offY + (phase === 'packed' ? bob * 0.3 : bob);
 
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(f.rot);
  const h = f.spriteHalf;
  ctx.drawImage(f.sprite, -h, -h, h * 2, h * 2);
  ctx.restore();
}
 
// 4-lobe puffy flower shape built from overlapping circles, path only (no fill)
// accepts a context so it can be used both on the main canvas and offscreen sprites
function petalPathCtx(c, s) {
  c.beginPath();
  const lobeR = s * 0.62;
  const dist = s * 0.5;
  const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  angles.forEach(a => {
    c.moveTo(Math.cos(a) * dist + lobeR, Math.sin(a) * dist);
    c.arc(Math.cos(a) * dist, Math.sin(a) * dist, lobeR, 0, Math.PI * 2);
  });
  // center circle to fill the middle gap
  const cR = s * 0.5;
  c.moveTo(cR, 0);
  c.arc(0, 0, cR, 0, Math.PI * 2);
}
 
function updatePositions(now) {
  const elapsed = now - phaseStart;
  const dur = DURATIONS[phase];
  const t = Math.min(1, elapsed / dur);
  const et = easeInOutCubic(t);
 
  flowers.forEach(f => {
    f.rot += f.rotSpeed * 0.016;
 
    // --- pointer spring physics: push away from cursor, ease back to 0 ---
    const radius = 160;
    const strength = phase === 'packed' ? 0.35 : 1;
    if (pointer.active) {
      const dx = (f.x + f.offX) - pointer.x;
      const dy = (f.y + f.offY) - pointer.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius && dist > 0.001) {
        const push = (1 - dist / radius) * 9 * strength;
        f.offVX += (dx / dist) * push;
        f.offVY += (dy / dist) * push;
      }
    }
    // spring back toward 0 + damping
    f.offVX += -f.offX * 0.06;
    f.offVY += -f.offY * 0.06;
    f.offVX *= 0.82;
    f.offVY *= 0.82;
    f.offX += f.offVX;
    f.offY += f.offVY;
 
    if (phase === 'scatter') {
      // gentle drift toward a slowly wandering target within scatter position
      f.x += (f.scatterX - f.x) * 0.02;
      f.y += (f.scatterY - f.y) * 0.02;
    } else if (phase === 'converge' || phase === 'disperse') {
      f.x = f.fromX + (f.toX - f.fromX) * et;
      f.y = f.fromY + (f.toY - f.fromY) * et;
    } else if (phase === 'packed') {
      f.x += (f.gridX - f.x) * 0.15;
      f.y += (f.gridY - f.y) * 0.15;
    }
  });
}
 
function loop(now) {
  updatePhase(now);
  updatePositions(now);
 
  ctx.clearRect(0, 0, W, H);
 
  // z-order: sort by y so lower flowers overlap upper ones slightly (depth feel)
  const sorted = [...flowers].sort((a, b) => a.y - b.y);
  sorted.forEach(f => drawFlower(f, now));
 
  requestAnimationFrame(loop);
}
 
resize();
flowers.forEach(f => { f.x = f.scatterX; f.y = f.scatterY; });
requestAnimationFrame(loop);