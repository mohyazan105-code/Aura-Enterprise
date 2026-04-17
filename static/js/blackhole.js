/**
 * ACTION AURA — Black Hole Animation Engine
 * Matches the brand logo: rainbow spectrum ring + circuit traces + deep space
 * GPU-accelerated via Canvas2D with pre-rendered offscreen textures.
 * Strictly isolated to Welcome & Login screens only.
 * v2.1 — Domain-adaptive color theming
 */

// ─── Domain color palettes ───────────────────────────────────────────────────
const BH_DOMAIN_THEMES = {
  banking:       { primary: [26, 115, 232],   secondary: [245, 158, 11],  glow: 'rgba(26,115,232,',   ring: [200, 240, 360],  bg: '4, 6, 18'   },
  healthcare:    { primary: [52, 211, 153],   secondary: [255, 255, 255], glow: 'rgba(52,211,153,',   ring: [120, 200, 260],  bg: '4, 14, 10'  },
  education:     { primary: [167, 139, 250],  secondary: [79, 195, 247],  glow: 'rgba(167,139,250,',  ring: [240, 290, 360],  bg: '6, 4, 18'   },
  manufacturing: { primary: [251, 146, 60],   secondary: [148, 163, 184], glow: 'rgba(251,146,60,',   ring: [20, 50, 340],    bg: '14, 8, 4'   },
  default:       { primary: [147, 30, 247],   secondary: [30, 100, 247],  glow: 'rgba(140,50,255,',   ring: [0, 360, 0],      bg: '4, 4, 10'   }
};

class BlackholeRenderer {
  constructor(canvas, domainId) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.mouse = { x: -999, y: -999 };
    this.trails = [];
    this.particles = [];
    this.angle = 0;
    this.active = false;
    this.rafId = null;
    this.ringCanvas = null;
    this.glowCanvas = null;
    this.lastFrameTime = 0;
    this.theme = BH_DOMAIN_THEMES[domainId] || BH_DOMAIN_THEMES.default;

    this._resize = this._resize.bind(this);
    this._resize();
    window.addEventListener('resize', this._resize);
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width  = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width  = window.innerWidth  + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.scale(dpr, dpr);
    this.W  = window.innerWidth;
    this.H  = window.innerHeight;
    this.cx = this.W / 2;
    this.cy = this.H / 2;
    this.R  = Math.min(this.W, this.H) * 0.18;

    this._preRenderRing();
    this._preRenderGlow();
    this._initParticles();
    this._initCircuits();
  }

  /* ─── Offscreen pre-render: Rainbow Ring ─── */
  _preRenderRing() {
    const R = this.R;
    const size = Math.ceil(R * 2 + 120);
    const oc = document.createElement('canvas');
    oc.width = oc.height = size;
    const c = oc.getContext('2d');
    const cx = size / 2, cy = size / 2;
    const ringW = R * 0.14;

    // Outer soft bloom
    const bloom = c.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.4);
    bloom.addColorStop(0, 'rgba(147, 30, 247, 0)');
    bloom.addColorStop(0.5, 'rgba(30, 100, 247, 0.06)');
    bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = bloom;
    c.fillRect(0, 0, size, size);

    // Main rainbow ring — 720 segments pre-baked
    const SEGS = 720;
    for (let s = 0; s < SEGS; s++) {
      const a1 = (s / SEGS) * Math.PI * 2 - Math.PI / 2;
      const a2 = ((s + 2) / SEGS) * Math.PI * 2 - Math.PI / 2;
      const hue = (s / SEGS) * 360;
      c.beginPath();
      c.arc(cx, cy, R, a1, a2);
      c.strokeStyle = `hsl(${hue}, 100%, 58%)`;
      c.lineWidth = ringW;
      c.lineCap = 'butt';
      c.stroke();
    }

    // Bright inner edge highlight
    for (let s = 0; s < 360; s++) {
      const a1 = (s / 360) * Math.PI * 2;
      const a2 = ((s + 2) / 360) * Math.PI * 2;
      const hue = (s / 360) * 360;
      c.beginPath();
      c.arc(cx, cy, R - ringW * 0.35, a1, a2);
      c.strokeStyle = `hsla(${hue}, 100%, 85%, 0.4)`;
      c.lineWidth = ringW * 0.12;
      c.stroke();
    }

    this.ringCanvas = oc;
    this.ringHalf = size / 2;
  }

  /* ─── Offscreen pre-render: Center Glow ─── */
  _preRenderGlow() {
    const R = this.R;
    const size = Math.ceil(R * 2 + 60);
    const oc = document.createElement('canvas');
    oc.width = oc.height = size;
    const c = oc.getContext('2d');
    const cx = size / 2, cy = size / 2;
    const innerR = R * 0.82;

    const grd = c.createRadialGradient(cx, cy, 0, cx, cy, innerR);
    grd.addColorStop(0,   'rgba(2, 2, 8, 1)');
    grd.addColorStop(0.5, 'rgba(4, 4, 12, 1)');
    grd.addColorStop(0.85,'rgba(6, 4, 18, 1)');
    grd.addColorStop(1,   'rgba(8, 6, 22, 0.95)');
    c.beginPath();
    c.arc(cx, cy, innerR, 0, Math.PI * 2);
    c.fillStyle = grd;
    c.fill();

    this.glowCanvas = oc;
    this.glowHalf = size / 2;
  }

  /* ─── Space Particles ─── */
  _initParticles() {
    const count = Math.min(160, Math.floor(Math.sqrt(this.W * this.H) * 0.16));
    this.particles = Array.from({ length: count }, () => this._newParticle());
  }

  _newParticle() {
    const minDist = this.R * 1.3;
    const maxDist = Math.min(this.W, this.H) * 0.65;
    const dist    = minDist + Math.random() * (maxDist - minDist);
    const angle   = Math.random() * Math.PI * 2;
    const speed   = (0.0006 + Math.random() * 0.0015) * (Math.random() > 0.5 ? 1 : -1);
    return {
      dist, angle, speed,
      size:  Math.random() * 1.3 + 0.3,
      alpha: Math.random() * 0.5 + 0.2,
      hue:   Math.random() * 360,
      phase: Math.random() * Math.PI * 2,
    };
  }

  /* ─── Circuit Traces (pre-rendered) ─── */
  _initCircuits() {
    const count = 24;
    this.circuitOC = document.createElement('canvas');
    const size = Math.ceil(this.R * 6 + 40);
    this.circuitOC.width = this.circuitOC.height = size;
    const c = this.circuitOC.getContext('2d');
    const ccx = size / 2, ccy = size / 2;
    this.circuitHalf = size / 2;

    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2;
      const hue = (i / count) * 360;
      this._drawOneCircuit(c, ccx, ccy, baseAngle, hue);
    }
  }

  _drawOneCircuit(c, cx, cy, baseAngle, hue) {
    const R = this.R;
    const startDist = R * 1.08;
    const segCount = Math.floor(3 + Math.random() * 4);
    let dist = startDist;
    let angle = baseAngle;
    const points = [];

    for (let i = 0; i < segCount; i++) {
      points.push({ dist, angle });
      const step = R * (0.3 + Math.random() * 0.5);
      if (i % 2 === 0) {
        dist += step;
      } else {
        angle += (Math.random() > 0.5 ? 1 : -1) * (0.06 + Math.random() * 0.1);
        dist += step * 0.35;
      }
    }

    const toXY = (d, a) => ({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d,
    });

    // Glow
    if (points.length > 1) {
      c.beginPath();
      points.forEach((pt, idx) => {
        const { x, y } = toXY(pt.dist, pt.angle);
        idx === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      });
      c.strokeStyle = `hsla(${hue}, 85%, 60%, 0.25)`;
      c.lineWidth = 2.5;
      c.stroke();
    }

    // Main line
    if (points.length > 1) {
      c.beginPath();
      points.forEach((pt, idx) => {
        const { x, y } = toXY(pt.dist, pt.angle);
        idx === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      });
      c.strokeStyle = `hsla(${hue}, 85%, 58%, 0.6)`;
      c.lineWidth = 0.7;
      c.stroke();
    }

    // Junction dots
    for (let i = 1; i < points.length; i++) {
      const { x, y } = toXY(points[i].dist, points[i].angle);
      c.beginPath();
      c.arc(x, y, 1.3, 0, Math.PI * 2);
      c.fillStyle = `hsla(${hue}, 90%, 70%, 0.7)`;
      c.fill();
    }

    // Random branch
    if (points.length > 2 && Math.random() > 0.4) {
      const pt = points[1];
      const { x: sx, y: sy } = toXY(pt.dist, pt.angle);
      const bDir = pt.angle + (Math.random() > 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.3);
      const bLen = R * (0.2 + Math.random() * 0.4);
      const ex = cx + Math.cos(bDir) * (pt.dist + bLen);
      const ey = cy + Math.sin(bDir) * (pt.dist + bLen);
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(ex, ey);
      c.strokeStyle = `hsla(${hue}, 75%, 55%, 0.35)`;
      c.lineWidth = 0.5;
      c.stroke();
      // Terminal dot
      c.beginPath();
      c.arc(ex, ey, 1, 0, Math.PI * 2);
      c.fillStyle = `hsla(${hue}, 90%, 65%, 0.6)`;
      c.fill();
    }
  }

  /* ─── Mouse ─── */
  onMouseMove(e) {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    if (this.trails.length < 35) {
      this.trails.push({
        x: e.clientX, y: e.clientY,
        alpha: 0.7,
        size: Math.random() * 2.5 + 1,
        hue: Math.random() * 50 + 20,
      });
    }
  }

  /* ─── Lifecycle ─── */
  start() {
    if (this.active) return;
    this.active = true;
    // Use theme background
    const bg = this.theme.bg;
    this.ctx.fillStyle = `rgb(${bg})`;
    this.ctx.fillRect(0, 0, this.W, this.H);
    this._loop(0);
  }

  stop() {
    this.active = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this._resize);
  }

  _loop(ts) {
    if (!this.active) return;
    const delta = ts - this.lastFrameTime;
    if (delta >= 16) {   // Cap ~60fps
      this.lastFrameTime = ts;
      this._draw();
    }
    this.rafId = requestAnimationFrame((t) => this._loop(t));
  }

  /* ─── Main Draw ─── */
  _draw() {
    const { ctx, cx, cy, W, H } = this;

    // Motion-blur fade using theme bg
    const bg = this.theme.bg;
    ctx.fillStyle = `rgba(${bg}, 0.18)`;
    ctx.fillRect(0, 0, W, H);

    this.angle += 0.0175; // spins at 0.5x rate now

    // 1. Particles
    this._drawParticles();

    // 2. Circuit traces
    if (this.circuitOC) {
      const ca = this.angle * 0.075; // slower circuits
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ca);
      ctx.drawImage(this.circuitOC, -this.circuitHalf, -this.circuitHalf);
      ctx.restore();
    }

    // 3. Cursor glow
    this._drawCursorGlow();

    // 4. Energy waves
    this._drawEnergyWaves();

    // 5. Rainbow ring (Change colors by rhythm!)
    if (this.ringCanvas) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.angle);
      
      // Dynamic rhythmic color pulsing based on time (elegant design)
      const timeVal = Date.now() * 0.0015;
      const hueShift = Math.sin(timeVal) * 120; // Smooth 120 deg sweep
      const saturate = 100 + Math.sin(timeVal * 1.5) * 40; 
      ctx.filter = `hue-rotate(${hueShift}deg) saturate(${saturate}%)`;
      
      ctx.drawImage(this.ringCanvas, -this.ringHalf, -this.ringHalf);
      ctx.restore();
    }

    // 6. Black hole center
    if (this.glowCanvas) {
      ctx.drawImage(this.glowCanvas, cx - this.glowHalf, cy - this.glowHalf);
    }

    // 7. Mouse trails
    this._drawTrails();
  }

  _drawParticles() {
    const { ctx, cx, cy } = this;
    const now = Date.now() * 0.001;
    for (const p of this.particles) {
      p.angle += p.speed * 2.0; // spin particles slower
      const x = cx + Math.cos(p.angle) * p.dist;
      const y = cy + Math.sin(p.angle) * p.dist;
      const flicker = 0.35 + Math.sin(now * 4 + p.phase) * 0.4;
      ctx.globalAlpha = p.alpha * flicker;
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${p.hue}, 55%, 78%)`;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawEnergyWaves() {
    const { ctx, cx, cy, R, theme } = this;
    const [r, g, b] = theme.primary;
    const now = Date.now() * 0.0018;
    for (let i = 1; i <= 3; i++) {
      const pulse = 0.5 + Math.sin(now - i * 0.9) * 0.5;
      const radius = R * (1.16 + i * 0.13 + pulse * 0.04);
      const alpha = (0.07 - i * 0.018) * pulse;
      if (alpha <= 0) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  _drawCursorGlow() {
    const { ctx, mouse, W, H, theme } = this;
    if (mouse.x < 0 || mouse.x > W) return;
    const [sr, sg, sb] = theme.secondary;
    const [pr, pg, pb] = theme.primary;
    const grd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 80);
    grd.addColorStop(0, `rgba(${sr}, ${sg}, ${sb}, 0.09)`);
    grd.addColorStop(0.5, `rgba(${pr}, ${pg}, ${pb}, 0.04)`);
    grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }

  _drawTrails() {
    const { ctx } = this;
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.alpha -= 0.03;
      t.size  *= 0.93;
      if (t.alpha <= 0.02) { this.trails.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${t.hue}, 90%, 70%, ${t.alpha})`;
      ctx.fill();
    }
  }
}


/* ─────────────────────────────────────────────────────
   AuraBlackhole — Singleton Lifecycle Manager
   Activates ONLY on Welcome splash, Landing & Login pages.
   Completely stops and frees resources on dashboard entry.
───────────────────────────────────────────────────── */
const AuraBlackhole = (() => {
  let renderer = null;
  let cursorEl = null;
  let mouseHandler = null;
  let currentContainerId = null;

  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function _findOrCreateCanvas(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    let cv = container.querySelector('canvas.bh-canvas');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.className = 'bh-canvas';
      container.insertBefore(cv, container.firstChild);
    }
    return cv;
  }

  function _ensureCursor() {
    if (cursorEl) return;
    cursorEl = document.createElement('div');
    cursorEl.id = 'bh-cursor';
    document.body.appendChild(cursorEl);
  }

  function mountTo(containerId) {
    if (REDUCED_MOTION) return;
    if (currentContainerId === containerId && renderer && renderer.active) return;

    // Stop previous
    stop();

    const cv = _findOrCreateCanvas(containerId);
    if (!cv) return;

    currentContainerId = containerId;
    _ensureCursor();

    // Read active domain from Auth if available
    const domainId = (typeof Auth !== 'undefined' && Auth.domain && Auth.domain.id)
      ? Auth.domain.id
      : (localStorage.getItem('aura_domain') || 'default');

    renderer = new BlackholeRenderer(cv, domainId);
    renderer.start();

    mouseHandler = (e) => {
      if (renderer) renderer.onMouseMove(e);
      if (cursorEl) {
        cursorEl.style.left = e.clientX + 'px';
        cursorEl.style.top  = e.clientY + 'px';
        cursorEl.style.opacity = '1';
      }
    };
    document.addEventListener('mousemove', mouseHandler, { passive: true });
  }

  function stop() {
    if (renderer) { renderer.destroy(); renderer = null; }
    if (mouseHandler) {
      document.removeEventListener('mousemove', mouseHandler);
      mouseHandler = null;
    }
    if (cursorEl) cursorEl.style.opacity = '0';
    currentContainerId = null;
  }

  return { mountTo, stop };
})();

window.AuraBlackhole = AuraBlackhole;

// Legacy compatibility shim
window.VisualFX = {
  init()  { /* noop — replaced by AuraBlackhole */ },
  start() { AuraBlackhole.mountTo('welcome-splash'); },
  stop()  { AuraBlackhole.stop(); },
  destroy() { AuraBlackhole.stop(); }
};
