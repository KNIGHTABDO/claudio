const GLYPHS = {
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [30, 1, 1, 14, 1, 1, 30],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  ':': [0, 4, 4, 0, 4, 4, 0],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 4, 4],
  '-': [0, 0, 0, 31, 0, 0, 0],
  'A': [14, 17, 17, 31, 17, 17, 17],
  'B': [30, 17, 17, 30, 17, 17, 30],
  'C': [14, 17, 16, 16, 16, 17, 14],
  'D': [30, 17, 17, 17, 17, 17, 30],
  'E': [31, 16, 16, 30, 16, 16, 31],
  'F': [31, 16, 16, 30, 16, 16, 16],
  'G': [14, 17, 16, 23, 17, 17, 15],
  'H': [17, 17, 17, 31, 17, 17, 17],
  'I': [14, 4, 4, 4, 4, 4, 14],
  'J': [7, 2, 2, 2, 2, 18, 12],
  'K': [17, 18, 20, 24, 20, 18, 17],
  'L': [16, 16, 16, 16, 16, 16, 31],
  'M': [17, 27, 21, 21, 17, 17, 17],
  'N': [17, 25, 21, 19, 17, 17, 17],
  'O': [14, 17, 17, 17, 17, 17, 14],
  'P': [30, 17, 17, 30, 16, 16, 16],
  'Q': [14, 17, 17, 17, 21, 18, 13],
  'R': [30, 17, 17, 30, 20, 18, 17],
  'S': [15, 16, 16, 14, 1, 1, 30],
  'T': [31, 4, 4, 4, 4, 4, 4],
  'U': [17, 17, 17, 17, 17, 17, 14],
  'V': [17, 17, 17, 17, 17, 10, 4],
  'W': [17, 17, 17, 21, 21, 27, 17],
  'X': [17, 17, 10, 4, 10, 17, 17],
  'Y': [17, 17, 10, 4, 4, 4, 4],
  'Z': [31, 1, 2, 4, 8, 16, 31]
};

const COLS = 5;
const ROWS = 7;

export function measureText(text, dot, gap, letterGap) {
  const cell = dot + gap;
  return text.length * (COLS * cell + letterGap) - letterGap;
}

export function drawText(ctx, text, x, y, dot, gap, letterGap, color, dimColor = null) {
  const cell = dot + gap;
  let cx = x;
  const chars = text.toUpperCase().split('');
  for (const ch of chars) {
    const glyph = GLYPHS[ch] || GLYPHS[' '];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const on = (glyph[r] >> (COLS - 1 - c)) & 1;
        if (on) {
          ctx.fillStyle = color;
        } else if (dimColor) {
          ctx.fillStyle = dimColor;
        } else {
          continue;
        }
        ctx.beginPath();
        ctx.arc(cx + c * cell + dot / 2, y + r * cell + dot / 2, dot / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    cx += COLS * cell + letterGap;
  }
}

export function renderStatic(canvas, text, options = {}) {
  const dpr = window.devicePixelRatio || 1;
  const dot = options.dot || 3;
  const gap = options.gap || 2;
  const letterGap = options.letterGap || 6;
  const cell = dot + gap;
  const w = measureText(text, dot, gap, letterGap);
  const h = ROWS * cell;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const color = options.color || getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
  drawText(ctx, text, 0, 0, dot, gap, letterGap, color, options.dimColor || null);
}

export class DotClock {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.current = '     ';
    this.alphas = [];
    this.targets = [];
    this.running = false;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    const loop = () => {
      if (!this.running) return;
      this.tick();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth || 400;
    this.dot = Math.max(4, Math.floor(cssW / 42));
    this.gap = Math.max(2, Math.floor(this.dot * 0.55));
    this.letterGap = this.dot * 2.4;
    const cell = this.dot + this.gap;
    const w = 5 * (COLS * cell + this.letterGap) - this.letterGap;
    const h = ROWS * cell;
    this.w = w;
    this.h = h;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.height = (h * (cssW / w)) + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  tick() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const colon = now.getSeconds() % 2 === 0 ? ':' : ' ';
    const text = hh + colon + mm;

    const styles = getComputedStyle(document.documentElement);
    const onColor = styles.getPropertyValue('--text').trim();
    const dimColor = styles.getPropertyValue('--dot').trim();

    const cell = this.dot + this.gap;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    const total = 5 * COLS * ROWS;
    if (this.alphas.length !== total) {
      this.alphas = new Array(total).fill(0);
    }

    let idx = 0;
    let cx = 0;
    for (let i = 0; i < 5; i++) {
      const glyph = GLYPHS[text[i]] || GLYPHS[' '];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const on = (glyph[r] >> (COLS - 1 - c)) & 1;
          const target = on ? 1 : 0;
          if (this.reduced) {
            this.alphas[idx] = target;
          } else {
            this.alphas[idx] += (target - this.alphas[idx]) * 0.22;
          }
          const a = this.alphas[idx];
          const x = cx + c * cell + this.dot / 2;
          const y = r * cell + this.dot / 2;
          if (a > 0.02) {
            ctx.globalAlpha = a;
            ctx.fillStyle = onColor;
            ctx.beginPath();
            ctx.arc(x, y, this.dot / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          if (a < 0.9) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = dimColor || 'rgba(128,128,128,0.08)';
            ctx.beginPath();
            ctx.arc(x, y, this.dot / 4, 0, Math.PI * 2);
            ctx.fill();
          }
          idx++;
        }
      }
      cx += COLS * cell + this.letterGap;
    }
    ctx.globalAlpha = 1;
  }
}

export function startDotWave(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 400;
  const h = 70;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t = 0;
  let raf;
  const draw = () => {
    if (!canvas.isConnected || canvas.closest('[hidden]')) {
      cancelAnimationFrame(raf);
      return;
    }
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    ctx.clearRect(0, 0, w, h);
    const cols = Math.floor(w / 10);
    for (let i = 0; i < cols; i++) {
      const x = i * 10 + 5;
      const wave = Math.sin(i * 0.35 + t) * Math.sin(i * 0.11 + t * 0.6);
      const rows = Math.round(Math.abs(wave) * 3) + 1;
      for (let j = 0; j < rows; j++) {
        const y = h / 2 + (j - (rows - 1) / 2) * 9;
        ctx.globalAlpha = 0.25 + Math.abs(wave) * 0.75 - j * 0.08;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (!reduced) t += 0.06;
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
}
