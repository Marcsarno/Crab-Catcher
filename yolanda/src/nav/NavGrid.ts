// Occupancy grid + 8-way A* with line-of-sight smoothing. Simple and reliable.

export interface Vec2 { x: number; z: number }

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly blocked: Uint8Array;
  readonly x0: number;
  readonly z0: number;

  constructor(public width: number, public depth: number, public cell = 0.25, public margin = 0.35) {
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(depth / cell);
    this.x0 = -width / 2;
    this.z0 = -depth / 2;
    this.blocked = new Uint8Array(this.cols * this.rows);
    // Walls: keep a margin along the room edge.
    this.blockRect(-width / 2 - 1, -depth / 2 - 1, width + 2, 1 + margin + 0.15, false);
    this.blockRect(-width / 2 - 1, -depth / 2 - 1, 1 + margin, depth + 2, false);
    this.blockRect(width / 2 - margin, -depth / 2 - 1, 1 + margin, depth + 2, false);
    this.blockRect(-width / 2 - 1, depth / 2 - margin, width + 2, 1 + margin, false);
  }

  idx(c: number, r: number): number {
    return r * this.cols + c;
  }

  toCell(p: Vec2): { c: number; r: number } {
    return {
      c: Math.max(0, Math.min(this.cols - 1, Math.floor((p.x - this.x0) / this.cell))),
      r: Math.max(0, Math.min(this.rows - 1, Math.floor((p.z - this.z0) / this.cell))),
    };
  }

  toWorld(c: number, r: number): Vec2 {
    return { x: this.x0 + (c + 0.5) * this.cell, z: this.z0 + (r + 0.5) * this.cell };
  }

  /** Mark an axis-aligned rectangle (x, z = min corner) as blocked, padded by the agent radius. */
  blockRect(x: number, z: number, w: number, d: number, pad = true, value = 1): void {
    const m = pad ? this.margin : 0;
    const a = this.toCell({ x: x - m, z: z - m });
    const b = this.toCell({ x: x + w + m - 1e-4, z: z + d + m - 1e-4 });
    for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) this.blocked[this.idx(c, r)] = value;
  }

  /** Footprint centered on (cx, cz). */
  blockCentered(cx: number, cz: number, w: number, d: number, value = 1): void {
    this.blockRect(cx - w / 2, cz - d / 2, w, d, true, value);
  }

  isBlocked(c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return true;
    return this.blocked[this.idx(c, r)] !== 0;
  }

  walkable(p: Vec2): boolean {
    const { c, r } = this.toCell(p);
    return !this.isBlocked(c, r);
  }

  /** Nearest walkable cell center to p (spiral search). */
  nearestWalkable(p: Vec2): Vec2 {
    const s = this.toCell(p);
    if (!this.isBlocked(s.c, s.r)) return p;
    for (let rad = 1; rad < 40; rad++) {
      let best: Vec2 | null = null;
      let bestD = Infinity;
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          if (this.isBlocked(s.c + dc, s.r + dr)) continue;
          const w = this.toWorld(s.c + dc, s.r + dr);
          const d = (w.x - p.x) ** 2 + (w.z - p.z) ** 2;
          if (d < bestD) { bestD = d; best = w; }
        }
      }
      if (best) return best;
    }
    return p;
  }

  /** Grid line of sight (supercover-ish sampling). */
  lineOfSight(a: Vec2, b: Vec2): boolean {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / (this.cell * 0.4));
    for (let i = 0; i <= steps; i++) {
      const t = i / Math.max(1, steps);
      if (!this.walkable({ x: a.x + dx * t, z: a.z + dz * t })) return false;
    }
    return true;
  }

  findPath(from: Vec2, to: Vec2): Vec2[] | null {
    const start = this.nearestWalkable(from);
    const goal = this.nearestWalkable(to);
    const s = this.toCell(start), g = this.toCell(goal);
    const N = this.cols * this.rows;
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const open = new MinHeap();
    const si = this.idx(s.c, s.r), gi = this.idx(g.c, g.r);
    gScore[si] = 0;
    open.push(si, 0);
    const h = (c: number, r: number) => {
      const dx = Math.abs(c - g.c), dr = Math.abs(r - g.r);
      return (dx + dr) + (Math.SQRT2 - 2) * Math.min(dx, dr);
    };
    let found = false;
    while (open.size) {
      const cur = open.pop();
      if (cur === gi) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cc = cur % this.cols, cr = (cur - cc) / this.cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = cc + dc, nr = cr + dr;
          if (this.isBlocked(nc, nr)) continue;
          // no corner cutting
          if (dc && dr && (this.isBlocked(cc + dc, cr) || this.isBlocked(cc, cr + dr))) continue;
          const ni = this.idx(nc, nr);
          if (closed[ni]) continue;
          const ng = gScore[cur] + (dc && dr ? Math.SQRT2 : 1);
          if (ng < gScore[ni]) {
            gScore[ni] = ng;
            came[ni] = cur;
            open.push(ni, ng + h(nc, nr));
          }
        }
      }
    }
    if (!found) return null;
    const cells: Vec2[] = [];
    for (let i = gi; i !== -1; i = came[i]) {
      const c = i % this.cols;
      cells.push(this.toWorld(c, (i - c) / this.cols));
    }
    cells.reverse();
    cells[0] = start;
    cells[cells.length - 1] = goal;
    return this.smooth(cells);
  }

  private smooth(pts: Vec2[]): Vec2[] {
    if (pts.length <= 2) return pts;
    const out: Vec2[] = [pts[0]];
    let anchor = 0;
    while (anchor < pts.length - 1) {
      let next = anchor + 1;
      for (let j = pts.length - 1; j > anchor + 1; j--) {
        if (this.lineOfSight(pts[anchor], pts[j])) { next = j; break; }
      }
      out.push(pts[next]);
      anchor = next;
    }
    return out;
  }
}

class MinHeap {
  private ids: number[] = [];
  private pr: number[] = [];
  get size() { return this.ids.length; }
  push(id: number, p: number) {
    this.ids.push(id); this.pr.push(p);
    let i = this.ids.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.pr[parent] <= this.pr[i]) break;
      this.swap(i, parent); i = parent;
    }
  }
  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop()!, lastP = this.pr.pop()!;
    if (this.ids.length) {
      this.ids[0] = lastId; this.pr[0] = lastP;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.ids.length && this.pr[l] < this.pr[m]) m = l;
        if (r < this.ids.length && this.pr[r] < this.pr[m]) m = r;
        if (m === i) break;
        this.swap(i, m); i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.pr[a], this.pr[b]] = [this.pr[b], this.pr[a]];
  }
}

export function pathLength(p: Vec2[]): number {
  let d = 0;
  for (let i = 1; i < p.length; i++) d += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
  return d;
}
