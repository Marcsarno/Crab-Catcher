import type { EnvironmentDef, StationPlacement } from '../core/types';

// Room layouts. One fixed diagonal 3/4 camera per room; stations are laid out in
// SCREEN space (u = right, v = down toward the camera) so the phone view reads like
// the concept art: two columns of stations with an open walking lane between them.

const CAM_YAW = 0.5;   // ~29° diagonal
const CAM_PITCH = 0.74; // ~42° down

const right = { x: Math.cos(CAM_YAW), z: -Math.sin(CAM_YAW) };
const down = { x: Math.sin(CAM_YAW), z: Math.cos(CAM_YAW) };

/** Screen-space (u, v) → world (x, z) on the floor. */
export function uv(u: number, v: number): { x: number; z: number } {
  return { x: +(u * right.x + v * down.x).toFixed(2), z: +(u * right.z + v * down.z).toFixed(2) };
}

const P = (id: string, u: number, v: number, rot = 0, stand?: { x: number; z: number }): StationPlacement => ({ id, ...uv(u, v), rot, stand });

// Shared endoscopy layout (mirrors the "Routine Endoscopy · Prep Phase" mockup).
const endoStations: StationPlacement[] = [
  P('chart', -2.5, -5.4, 1),
  P('sedaprep', 2.5, -4.8, 0),
  P('scopeair', -2.9, -1.4, 1),
  P('supplies', 2.7, -1.0, 0),
  P('bay1', -2.4, 2.8, 0, { x: 1.25, z: 0.1 }),
  P('workstation', 2.7, 2.5, 0),
  P('handoff', 0.9, 6.0, 3),
];

const base = {
  name: 'Endoscopy Suite', sign: 'ENDOSCOPY', width: 13, depth: 15, floor: 'tile' as const,
  camYaw: CAM_YAW, camPitch: CAM_PITCH,
  start: uv(0.2, -1.0), door: { x: -2.2, z: -7.2 },
};

const endoDecor: EnvironmentDef['decor'] = [
  { kind: 'window', x: -4.6, z: -7.5 },
  { kind: 'door', x: -2.2, z: -7.5 },
  { kind: 'sign', x: 0.6, z: -7.5 },
  { kind: 'poster', x: -6.5, z: -3.0, rot: 1 },
  { kind: 'window', x: -6.5, z: -6.0, rot: 1 },
  { kind: 'plant', ...uv(-0.3, -7.0), scale: 1.2 },
  { kind: 'plant', ...uv(4.6, -3.0), scale: 1.1 },
  { kind: 'plant', ...uv(-4.4, 5.6), scale: 1.2 },
  { kind: 'plant', ...uv(4.7, 5.6), scale: 1.3 },
];

export const ENVIRONMENTS: Record<string, EnvironmentDef> = {
  endo: {
    ...base, id: 'endo', stations: endoStations,
    patientZone: { x0: -3.4, z0: 0.0, x1: 5.6, z1: 6.6 },
    decor: endoDecor,
  },
  endo2: {
    ...base, id: 'endo2',
    stations: [...endoStations, P('bay2', 0.1, -3.4, 0, { x: 1.25, z: 0.1 })],
    patientZone: { x0: -3.4, z0: 0.0, x1: 5.6, z1: 6.6 },
    decor: endoDecor,
  },
  endo3: {
    ...base, id: 'endo3',
    stations: [...endoStations, P('airready', -0.2, -3.6, 0)],
    patientZone: { x0: -3.4, z0: 0.0, x1: 5.6, z1: 6.6 },
    decor: endoDecor,
  },
};
