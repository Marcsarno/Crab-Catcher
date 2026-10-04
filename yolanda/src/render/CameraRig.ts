import * as THREE from 'three';

export type CamMode = 'room' | 'prep' | 'active' | 'intro';

interface Shot {
  target: THREE.Vector3;
  dist: number;
  yaw: number;
  pitch: number;
}

/**
 * Fixed elevated 3/4 management camera. No free rotation: it eases between
 * framed "shots" (room overview, prep close-up, active-care framing) and
 * supports a subtle user zoom that drifts toward Yolanda.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private cur: Shot;
  private goal: Shot;
  mode: CamMode = 'room';
  zoom = 1;
  private shots: Partial<Record<CamMode, { points: THREE.Vector3[]; yaw: number; pitch: number; margins: [number, number, number, number] }>> = {};
  private follow = new THREE.Vector3();
  private shake = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(36, 9 / 16, 0.5, 120);
    this.cur = { target: new THREE.Vector3(), dist: 30, yaw: 0, pitch: 0.95 };
    this.goal = { target: new THREE.Vector3(), dist: 30, yaw: 0, pitch: 0.95 };
  }

  /** Register what a mode must keep in view. margins = [left, right, bottom, top] in NDC units reserved for UI. */
  define(mode: CamMode, points: THREE.Vector3[], yaw: number, pitch: number, margins: [number, number, number, number]): void {
    this.shots[mode] = { points, yaw, pitch, margins };
  }

  setMode(mode: CamMode, instant = false): void {
    this.mode = mode;
    this.recompute();
    if (instant) this.copy(this.cur, this.goal);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    // Narrow portrait screens get a slightly wider lens so stations stay big.
    this.camera.fov = w / h < 0.7 ? 38 : 32;
    this.camera.updateProjectionMatrix();
    this.recompute();
    this.copy(this.cur, this.goal);
  }

  private copy(a: Shot, b: Shot) {
    a.target.copy(b.target); a.dist = b.dist; a.yaw = b.yaw; a.pitch = b.pitch;
  }

  private place(cam: THREE.PerspectiveCamera, s: Shot) {
    const cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
    cam.position.set(
      s.target.x + Math.sin(s.yaw) * cp * s.dist,
      s.target.y + sp * s.dist,
      s.target.z + Math.cos(s.yaw) * cp * s.dist,
    );
    cam.lookAt(s.target);
    cam.updateMatrixWorld(true);
  }

  /** Solve distance + target so all points fit inside the margins. */
  recompute(): void {
    const def = this.shots[this.mode];
    if (!def) return;
    const tmp = this.camera.clone();
    const centroid = new THREE.Vector3();
    for (const p of def.points) centroid.add(p);
    centroid.multiplyScalar(1 / def.points.length);
    const shot: Shot = { target: centroid.clone(), dist: 20, yaw: def.yaw, pitch: def.pitch };
    const [ml, mr, mb, mt] = def.margins;
    const v = new THREE.Vector3();
    for (let iter = 0; iter < 3; iter++) {
      let lo = 2, hi = 120;
      for (let i = 0; i < 28; i++) {
        const mid = (lo + hi) / 2;
        shot.dist = mid;
        this.place(tmp, shot);
        let ok = true;
        for (const p of def.points) {
          v.copy(p).project(tmp);
          const halfW = (2 - ml - mr) / 2, halfH = (2 - mb - mt) / 2;
          if (v.z > 1 || Math.abs(v.x - (ml - mr) / 2) > halfW || Math.abs(v.y - (mb - mt) / 2) > halfH) { ok = false; break; }
        }
        if (ok) hi = mid; else lo = mid;
      }
      shot.dist = hi;
      this.place(tmp, shot);
      // re-center the projected bounding box inside the allowed area
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of def.points) {
        v.copy(p).project(tmp);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
      const wantX = (ml - mr) / 2, wantY = (mb - mt) / 2;
      const dxN = (x0 + x1) / 2 - wantX, dyN = (y0 + y1) / 2 - wantY;
      // convert NDC offset to world offset on the ground plane (approx.)
      const halfHWorld = Math.tan(THREE.MathUtils.degToRad(tmp.fov / 2)) * shot.dist;
      const right = new THREE.Vector3(Math.cos(shot.yaw), 0, -Math.sin(shot.yaw));
      const fwd = new THREE.Vector3(-Math.sin(shot.yaw), 0, -Math.cos(shot.yaw));
      shot.target.addScaledVector(right, dxN * halfHWorld * tmp.aspect);
      shot.target.addScaledVector(fwd, (dyN * halfHWorld) / Math.sin(shot.pitch));
    }
    this.copy(this.goal, shot);
  }

  kick(amount = 0.15): void {
    this.shake = Math.max(this.shake, amount);
  }

  update(dt: number, focus?: THREE.Vector3): void {
    const k = 1 - Math.exp(-dt * 3.2);
    const z = this.mode === 'prep' ? 1 : this.zoom;
    if (focus) this.follow.copy(focus);
    const tgt = this.goal.target.clone();
    if (z < 1 && focus) tgt.lerp(new THREE.Vector3(focus.x, tgt.y, focus.z), (1 - z) * 2.2);
    this.cur.target.lerp(tgt, k);
    this.cur.dist += (this.goal.dist * z - this.cur.dist) * k;
    this.cur.yaw += (this.goal.yaw - this.cur.yaw) * k;
    this.cur.pitch += (this.goal.pitch - this.cur.pitch) * k;
    this.place(this.camera, this.cur);
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-dt * 10);
    }
  }
}
