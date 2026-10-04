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
const coreStations: StationPlacement[] = [
  P('chart', -2.3, -3.9, 1),
  P('sedaprep', 2.2, -3.7, 0),
  P('scopeair', -2.5, -0.6, 1),
  P('supplies', 2.3, -0.4, 0),
  P('bay1', -2.1, 2.6, 0, { x: 1.25, z: 0.1 }),
  P('workstation', 2.3, 2.4, 0),
];
const endoStations: StationPlacement[] = [...coreStations, P('handoff', -0.3, -6.2, 0)];
// Rooms with an extra station put it at the back and the PACU handoff at the front.
const frontHandoff = P('handoff', 0.1, 5.6, 3);

const base = {
  name: 'Endoscopy Suite', sign: 'ENDOSCOPY', width: 13, depth: 15, floor: 'tile' as const,
  camYaw: CAM_YAW, camPitch: CAM_PITCH,
  start: uv(0.2, -0.6), door: { x: -5.4, z: -7.0 },
};

const endoDecor: EnvironmentDef['decor'] = [
  { kind: 'door', x: -5.4, z: -7.5 },
  { kind: 'window', x: 1.6, z: -7.5 },
  { kind: 'sign', x: -1.6, z: -7.5 },
  { kind: 'poster', x: -6.5, z: -3.0, rot: 1 },
  { kind: 'window', x: -6.5, z: -6.0, rot: 1 },
  { kind: 'plant', ...uv(4.2, -3.6), scale: 1.25 },
  { kind: 'plant', x: 2.9, z: -6.9, scale: 1.3 },
  { kind: 'plant', x: -6.0, z: -0.6, scale: 1.2 },
  { kind: 'plant', ...uv(-4.4, 5.6), scale: 1.2 },
  { kind: 'plant', ...uv(4.7, 5.6), scale: 1.3 },
];

// Operating room: bigger, prep machines up top, the surgical field below.
const orStations: StationPlacement[] = [
  P('thermanest', -0.3, -6.4, 0),
  P('handoff', -3.0, -4.7, 1),
  P('sedaprep', 2.6, -4.5, 0),
  P('vitadock', -2.9, -1.5, 1),
  P('supplies', 2.8, -1.1, 0),
  P('ortable', -0.2, 2.4, 0, { x: 1.3, z: 0.1 }),
  P('workstation', -3.1, 1.6, 1),
  P('airready', 3.0, 2.1, 0),
  P('orchart', -2.6, 5.1, 1),
];

export const ENVIRONMENTS: Record<string, EnvironmentDef> = {
  or: {
    id: 'or', name: 'Operating Room 3', sign: 'OR 3', width: 15, depth: 17, floor: 'or',
    camYaw: CAM_YAW, camPitch: CAM_PITCH,
    start: uv(0.2, -1.0), door: { x: -6.0, z: -8.0 },
    stations: orStations,
    patientZone: { x0: -5.6, z0: -0.6, x1: 4.6, z1: 7.2 },
    decor: [
      { kind: 'door', x: -6.0, z: -8.5 },
      { kind: 'sign', x: -2.4, z: -8.5 },
      { kind: 'poster', x: -7.5, z: -3.0, rot: 1 },
      { kind: 'plant', ...uv(4.4, -3.4), scale: 1.2 },
      { kind: 'plant', ...uv(-4.6, -6.0), scale: 1.1 },
    ],
  },
  endo: {
    ...base, id: 'endo', stations: endoStations,
    patientZone: { x0: -3.4, z0: 0.0, x1: 5.6, z1: 6.6 },
    decor: endoDecor,
  },
  endo2: {
    ...base, id: 'endo2',
    stations: [...coreStations, frontHandoff, P('bay2', -0.3, -6.2, 0, { x: 1.25, z: 0.1 })],
    patientZone: { x0: -3.4, z0: 0.0, x1: 5.6, z1: 6.6 },
    decor: endoDecor,
  },
  endo3: {
    ...base, id: 'endo3',
    stations: [...coreStations, frontHandoff, P('airready', -0.3, -6.2, 0)],
    patientZone: { x0: -3.4, z0: 0.0, x1: 5.6, z1: 6.6 },
    decor: endoDecor,
  },
};
