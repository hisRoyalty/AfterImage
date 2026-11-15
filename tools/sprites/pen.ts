// Just enough of a drawing API to render the default sprite art onto a 2D canvas.
type Radius = number | { tl: number; tr: number; bl: number; br: number };

export class Pen {
  private ctx: CanvasRenderingContext2D;
  private fill = 'rgba(0,0,0,1)';
  private stroke = 'rgba(0,0,0,1)';
  invert = false; // hole() paints a soft blob instead of a soft hole

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  private rgba(c: number, a: number): string {
    return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
  }

  fillStyle(c: number, a = 1): this { this.fill = this.rgba(c, a); return this; }

  lineStyle(w: number, c: number, a = 1): this { this.ctx.lineWidth = w; this.stroke = this.rgba(c, a); return this; }

  fillRect(x: number, y: number, w: number, h: number): this {
    this.ctx.fillStyle = this.fill;
    this.ctx.fillRect(x, y, w, h);
    return this;
  }

  private round(x: number, y: number, w: number, h: number, r: Radius): void {
    const rr = typeof r === 'number' ? [r, r, r, r] : [r.tl, r.tr, r.br, r.bl];
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, rr);
  }

  fillRoundedRect(x: number, y: number, w: number, h: number, r: Radius = 4): this {
    this.round(x, y, w, h, r);
    this.ctx.fillStyle = this.fill;
    this.ctx.fill();
    return this;
  }

  strokeRoundedRect(x: number, y: number, w: number, h: number, r: Radius = 4): this {
    this.round(x, y, w, h, r);
    this.ctx.strokeStyle = this.stroke;
    this.ctx.stroke();
    return this;
  }

  fillCircle(x: number, y: number, r: number): this {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.fillStyle = this.fill;
    this.ctx.fill();
    return this;
  }

  strokeCircle(x: number, y: number, r: number): this {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.strokeStyle = this.stroke;
    this.ctx.stroke();
    return this;
  }

  fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineTo(x3, y3);
    this.ctx.closePath();
    this.ctx.fillStyle = this.fill;
    this.ctx.fill();
    return this;
  }

  // Fills w x h with colour, leaving a soft transparent hole (fully clear inside r0, opaque beyond r1).
  hole(w: number, h: number, cx: number, cy: number, r0: number, r1: number, c: number, a: number): this {
    const g = this.ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
    g.addColorStop(0, this.rgba(c, this.invert ? a : 0));
    g.addColorStop(1, this.rgba(c, this.invert ? 0 : a));
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, w, h);
    return this;
  }

  lineBetween(x1: number, y1: number, x2: number, y2: number): this {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.strokeStyle = this.stroke;
    this.ctx.stroke();
    return this;
  }
}
