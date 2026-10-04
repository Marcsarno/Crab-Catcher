import * as THREE from 'three';

export type CamMode = 'room' | 'prep' | 'active' | 'intro';

interface Shot {
  target: THREE.Vector3;
  dist: number;
  yaw: number;
  pitch: number;
  /** Lens shift in NDC: centers the shot inside the area the HUD leaves free. */
  sx: number;
  sy: number;
}

/**
 * Fixed elevated 3/4 management camera. Every mode uses the SAME yaw/pitch, so
 * switching modes is only a gentle push in/out (target + distance ease), never a
 * rotation. HUD margins are handled with a projection lens shift.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private cur: Shot;
  private goal: Shot;
  mode: CamMode = 'room';
  zoom = 1;
  private shots: Partial<Record<CamMode, { points: THREE.Vector3[]; yaw: number; pitch: number; margins: [number, number, number, number] }>> = {};
  private shake = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(19, 9 / 16, 1, 400);
    const s = (): Shot => ({ target: new THREE.Vector3(), dist: 30, yaw: 0.5, pitch: 0.75, sx: 0, sy: 0 });
    this.cur = s();
    this.goal = s();
  }

  /** margins = [left, right, bottom, top] in NDC units reserved for UI. */
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
    this.camera.fov = w / h < 0.7 ? 19 : 16; // long lens: near-isometric, little distortion
    this.camera.updateProjectionMatrix();
    this.recompute();
    this.copy(this.cur, this.goal);
  }

  private copy(a: Shot, b: Shot) {
    a.target.copy(b.target); a.dist = b.dist; a.yaw = b.yaw; a.pitch = b.pitch; a.sx = b.sx; a.sy = b.sy;
  }

  private place(cam: THREE.PerspectiveCamera, s: Shot, shift = true) {
    const cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
    cam.position.set(
      s.target.x + Math.sin(s.yaw) * cp * s.dist,
      s.target.y + sp * s.dist,
      s.target.z + Math.cos(s.yaw) * cp * s.dist,
    );
    cam.lookAt(s.target);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    if (shift) {
      // ndc.x += sx: content moves toward the free area of the screen
      cam.projectionMatrix.elements[8] -= s.sx;
      cam.projectionMatrix.elements[9] -= s.sy;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    }
  }

  /** Solve target + distance so the points fill the free area (symmetric fit, then lens shift). */
  recompute(): void {
    const def = this.shots[this.mode];
    if (!def) return;
    const tmp = this.camera.clone();
    const [ml, mr, mb, mt] = def.margins;
    const halfW = (2 - ml - mr) / 2, halfH = (2 - mb - mt) / 2;
    const target = new THREE.Vector3();
    for (const p of def.points) target.add(p);
    target.multiplyScalar(1 / def.points.length);
    target.y = Math.min(target.y, 1.0);
    const shot: Shot = { target, dist: 20, yaw: def.yaw, pitch: def.pitch, sx: (ml - mr) / 2, sy: (mb - mt) / 2 };
    const v = new THREE.Vector3();
    const right = new THREE.Vector3(Math.cos(shot.yaw), 0, -Math.sin(shot.yaw));
    const upGround = new THREE.Vector3(-Math.sin(shot.yaw), 0, -Math.cos(shot.yaw));
    const fits = () => {
      this.place(tmp, shot, false);
      for (const p of def.points) {
        v.copy(p).project(tmp);
        if (v.z > 1 || Math.abs(v.x) > halfW || Math.abs(v.y) > halfH) return false;
      }
      return true;
    };
    for (let iter = 0; iter < 6; iter++) {
      let lo = 1, hi = 300;
      for (let i = 0; i < 30; i++) {
        shot.dist = (lo + hi) / 2;
        if (fits()) hi = shot.dist; else lo = shot.dist;
      }
      shot.dist = hi;
      this.place(tmp, shot, false);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of def.points) {
        v.copy(p).project(tmp);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (Math.abs(cx) < 0.002 && Math.abs(cy) < 0.002) break;
      const halfHWorld = Math.tan(THREE.MathUtils.degToRad(tmp.fov / 2)) * shot.dist;
      shot.target.addScaledVector(right, cx * halfHWorld * tmp.aspect * 0.9);
      shot.target.addScaledVector(upGround, (cy * halfHWorld / Math.sin(shot.pitch)) * 0.9);
    }
    this.copy(this.goal, shot);
  }

  kick(amount = 0.15): void {
    this.shake = Math.max(this.shake, amount);
  }

  update(dt: number, focus?: THREE.Vector3): void {
    const k = 1 - Math.exp(-dt * 2.6);
    const z = this.mode === 'prep' ? 1 : this.zoom;
    const tgt = this.goal.target.clone();
    if (z < 1 && focus) tgt.lerp(new THREE.Vector3(focus.x, tgt.y, focus.z), (1 - z) * 2.2);
    this.cur.target.lerp(tgt, k);
    this.cur.dist += (this.goal.dist * z - this.cur.dist) * k;
    this.cur.yaw = this.goal.yaw;
    this.cur.pitch = this.goal.pitch;
    this.cur.sx += (this.goal.sx - this.cur.sx) * k;
    this.cur.sy += (this.goal.sy - this.cur.sy) * k;
    this.place(this.camera, this.cur);
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-dt * 10);
    }
  }
}
