// writing.js — Canvas writing practice
// Supports mouse and touch (Chromebook stylus/finger)
//
// Sizing model (deterministic, no observers, no rect-reading races):
//   app.js calls resizeTo(w, h) with explicit pixel dimensions.
//   resizeTo pins the wrap, the canvas bitmap, AND the canvas CSS size to
//   those exact pixels in one synchronous step — bitmap and display can
//   never disagree, so text can never stretch.
'use strict';

class WritingCanvas {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx    = canvasEl.getContext('2d');
    this.strokes = [];
    this.current = null;
    this.isDrawing = false;
    this.color     = '#1565C0';
    this.lineWidth = document.documentElement.clientWidth < 600 ? 7 : 6;
    this.guideText = '';
    this._setupEvents();
    // Redraw once the guide font (Andika) finishes loading, otherwise the
    // first guide renders with fallback-font metrics
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => this.redraw());
    }
  }

  // ── Deterministic sizing ───────────────────────────────────────────────────
  // Pin wrap, bitmap, and CSS to the same explicit pixel size synchronously.
  resizeTo(w, h) {
    const wrap = this.canvas.parentElement;
    wrap.style.width  = w + 'px';
    wrap.style.height = h + 'px';
    this.canvas.width        = w;
    this.canvas.height       = h;
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
    this.redraw();
  }

  // Legacy fallback — measure own displayed size (used only on window resize)
  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.resizeTo(Math.round(rect.width), Math.round(rect.height));
  }

  _setupEvents() {
    // Mouse
    this.canvas.addEventListener('mousedown',  e => { e.preventDefault(); this._start(this._pos(e)); });
    this.canvas.addEventListener('mousemove',  e => { e.preventDefault(); this._move(this._pos(e)); });
    this.canvas.addEventListener('mouseup',    e => { e.preventDefault(); this._end(); });
    this.canvas.addEventListener('mouseleave', e => { this._end(); });

    // Touch (Chromebook finger/stylus)
    this.canvas.addEventListener('touchstart', e => { e.preventDefault(); this._start(this._touchPos(e)); }, { passive: false });
    this.canvas.addEventListener('touchmove',  e => { e.preventDefault(); this._move(this._touchPos(e)); },  { passive: false });
    this.canvas.addEventListener('touchend',   e => { e.preventDefault(); this._end(); }, { passive: false });
  }

  _pos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }
  _touchPos(e) {
    const t = e.touches[0] || e.changedTouches[0];
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (t.clientX - rect.left) * scaleX,
      y: (t.clientY - rect.top)  * scaleY,
    };
  }

  _start(pt) {
    this.isDrawing = true;
    this.current   = [pt];
  }
  _move(pt) {
    if (!this.isDrawing || !this.current) return;
    this.current.push(pt);
    this.redraw();
  }
  _end() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    if (this.current && this.current.length > 1) {
      this.strokes.push([...this.current]);
    }
    this.current = null;
    this.redraw();
  }

  // ── Drawing ──────────────────────────────────────────────────────────────
  redraw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this._drawGuide();
    this._drawRulings();

    ctx.strokeStyle = this.color;
    ctx.lineWidth   = this.lineWidth;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    for (const stroke of this.strokes) this._drawStroke(stroke);

    if (this.current && this.current.length > 1) {
      this._drawStroke(this.current);
    }
  }

  _drawStroke(points) {
    if (points.length < 2) return;
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  // ── Guide text ───────────────────────────────────────────────────────────
  setGuide(text) {
    this.guideText = text || '';
    this.redraw();
  }

  // Guide font: Andika has single-story 'a' and 'g' (schoolbook letterforms).
  // Falls back to Comic Sans (also single-story) then generic sans.
  _guideFont(fs) {
    return '700 ' + fs + 'px Andika, "Comic Sans MS", "Comic Sans", sans-serif';
  }

  _drawGuide() {
    if (!this.guideText) return;
    const ctx  = this.ctx;
    const w    = this.canvas.width;
    const h    = this.canvas.height;
    const pad  = 20;
    const maxW = w - pad * 2;

    const isSentence = this.guideText.includes(' ');
    ctx.fillStyle    = 'rgba(37,99,235,0.13)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';   // middle baseline: descenders never clip

    if (isSentence) {
      // Binary-search the largest font size whose WRAPPED lines fit both
      // width and height.
      const maxH = h - pad * 2;
      let lo = 9, hi = 80;
      let bestLines = null, bestFs = lo;
      while (hi - lo > 1) {
        const mid   = Math.floor((lo + hi) / 2);
        const lines = this._wrapWords(ctx, this.guideText, maxW, mid);
        const lineH = mid * 1.35;
        const fitsH = lines.length * lineH <= maxH;
        ctx.font = this._guideFont(mid);
        const fitsW = lines.every(l => ctx.measureText(l).width <= maxW);
        if (fitsH && fitsW) { lo = mid; bestFs = mid; bestLines = lines; }
        else                { hi = mid; }
      }
      const lines  = bestLines || this._wrapWords(ctx, this.guideText, maxW, bestFs);
      const lineH  = bestFs * 1.35;
      const totalH = lines.length * lineH;
      const startY = (h - totalH) / 2 + lineH / 2;
      ctx.font = this._guideFont(bestFs);
      lines.forEach((line, i) => ctx.fillText(line, w / 2, startY + i * lineH));
    } else {
      // Single word / letter / digraph — fit width, with height capped to
      // ~62% of the canvas so the text sits naturally in the ruling area.
      const capH = h * 0.62;
      let lo = 10, hi = 240;
      while (hi - lo > 1) {
        const mid = (lo + hi) / 2;
        ctx.font = this._guideFont(mid);
        const m     = ctx.measureText(this.guideText);
        const textH = (m.actualBoundingBoxAscent  || mid * 0.8) +
                      (m.actualBoundingBoxDescent || mid * 0.25);
        (m.width <= maxW && textH <= capH) ? (lo = mid) : (hi = mid);
      }
      const fs = Math.floor(lo);
      ctx.font = this._guideFont(fs);
      ctx.fillText(this.guideText, w / 2, h / 2);
    }

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _wrapWords(ctx, text, maxW, fs) {
    ctx.font = this._guideFont(fs);
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word; }
      else { cur = test; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  _drawRulings() {
    const ctx = this.ctx;
    const w   = this.canvas.width;
    const h   = this.canvas.height;
    const pad = 10;

    // 4-line handwriting guide (consistent regardless of canvas size)
    //  Line 1 — cap/ascender:  20% from top  (light solid)
    //  Line 2 — midline/waist: 50% from top  (dotted — marks x-height)
    //  Line 3 — baseline:      76% from top  (stronger solid — where letters sit)
    //  Line 4 — descender:     92% from top  (light solid)
    const lines = [
      { y: 0.20, color: 'rgba(37,99,235,0.13)', width: 1,   dash: []      },
      { y: 0.50, color: 'rgba(37,99,235,0.22)', width: 1.5, dash: [5, 4]  },
      { y: 0.76, color: 'rgba(37,99,235,0.30)', width: 1.5, dash: []      },
      { y: 0.92, color: 'rgba(37,99,235,0.13)', width: 1,   dash: []      },
    ];

    lines.forEach(({ y, color, width, dash }) => {
      const yPx = Math.round(h * y) + 0.5; // +0.5 for crisp 1px lines
      ctx.strokeStyle = color;
      ctx.lineWidth   = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(pad, yPx);
      ctx.lineTo(w - pad, yPx);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  clear() {
    this.strokes = [];
    this.current = null;
    this.isDrawing = false;
    this.redraw();
  }

  undo() {
    this.strokes.pop();
    this.current = null;
    this.redraw();
  }

  isEmpty() {
    return this.strokes.length === 0 && !this.current;
  }

  destroy() {
    // Reset state; the canvas element itself is reused by the next instance
    this.strokes   = [];
    this.current   = null;
    this.isDrawing = false;
    this.guideText = '';
  }
}

// Window resize → re-measure (the only place self-measurement is needed)
window.addEventListener('resize', () => {
  if (window.S && S.wcanvas) S.wcanvas._resize();
});
