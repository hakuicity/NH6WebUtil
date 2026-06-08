// writing.js — Canvas writing practice
// Supports mouse and touch (Chromebook stylus/finger)
'use strict';

class WritingCanvas {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx    = canvasEl.getContext('2d');
    this.strokes = [];          // completed strokes
    this.current = null;        // current stroke being drawn
    this.isDrawing = false;
    this.color  = '#1565C0';
    this.lineWidth = document.documentElement.clientWidth < 600 ? 5 : 4;
    this._setupEvents();
    this._resize();
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height, 360);
    this.canvas.width  = size;
    this.canvas.height = size;
    this.redraw();
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

    // Draw ruling lines (notebook feel)
    this._drawRulings();

    // Draw completed strokes
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = this.lineWidth;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    for (const stroke of this.strokes) this._drawStroke(stroke);

    // Draw current stroke
    if (this.current && this.current.length > 1) {
      this._drawStroke(this.current);
    }
  }

  _drawRulings() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.strokeStyle = 'rgba(37,99,235,0.12)';
    ctx.lineWidth   = 1;
    // Baseline at 75% height
    const base = h * 0.75;
    ctx.beginPath(); ctx.moveTo(8, base); ctx.lineTo(w-8, base); ctx.stroke();
    // Midline at 35%
    const mid = h * 0.35;
    ctx.strokeStyle = 'rgba(37,99,235,0.07)';
    ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(8, mid); ctx.lineTo(w-8, mid); ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawStroke(points) {
    if (points.length < 2) return;
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i].x + points[i+1].x) / 2;
      const my = (points[i].y + points[i+1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  // ── Public API ────────────────────────────────────────────────────────────
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
    // No cleanup needed for event listeners bound to canvas element
  }
}
