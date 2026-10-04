// Shared type definitions. Content lives in src/data; these are the shapes.

export type Phase = 'prep' | 'active' | 'closing' | 'recovery' | 'done';

/** Phases in which the patient is under active anesthesia care (Yolanda stays in the zone). */
export const CARE_PHASES: Phase[] = ['active', 'closing'];
export type ScoreCat = 'safety' | 'anticipation' | 'efficiency' | 'care' | 'team';

export type ItemId = string;
export type ItemKind = 'cartridge' | 'kit' | 'pack' | 'output';

export interface ItemDef {
  id: ItemId;
  name: string;
  /** Very short label for tray slots. */
  short: string;
  kind: ItemKind;
  /** CSS color used for icon + 3D tray token. */
  color: string;
  /** Which supply drawer holds it (outputs come from machines, not drawers). */
  drawer?: string;
  /** Fictional category it satisfies on a case plan, e.g. "Calm". */
  category?: string;
  blurb: string;
  /** Allowed past the MRI screening threshold. */
  mriSafe?: boolean;
}

export interface DrawerDef {
  id: string;
  name: string;
  color: string;
}

/** Visual + interaction archetype for a station. Placement comes from environments. */
export type StationKind =
  | 'chart' | 'sedaprep' | 'scopeair' | 'supplies' | 'workstation' | 'bay'
  | 'handoff' | 'airready' | 'vitadock' | 'thermanest' | 'ortable' | 'preop' | 'orchart';

export interface StationDef {
  id: string;
  kind: StationKind;
  name: string;
  /** Glyph key for the HTML label icon. */
  icon: string;
  /** Footprint in world units (blocks navigation). */
  w: number;
  d: number;
  /** Machine with a single process slot. */
  machine?: boolean;
  /** Short verb shown under the label when idle. */
  blurb: string;
}

export interface StationPlacement {
  id: string;            // station def id
  x: number;
  z: number;
  /** Rotation in quarter turns (0 = front faces +z, toward the camera). */
  rot?: number;
  /** Interaction point as a WORLD-space offset from the center. Default: in front. */
  stand?: { x: number; z: number };
}

export interface Rect { x0: number; z0: number; x1: number; z1: number }

export interface EnvironmentDef {
  id: string;
  name: string;
  /** Sign painted on the back wall. */
  sign: string;
  width: number;   // x extent
  depth: number;   // z extent
  stations: StationPlacement[];
  /** Area Yolanda may move within while a patient is under active care. */
  patientZone: Rect;
  /** Where Yolanda starts. */
  start: { x: number; z: number };
  /** Door where visitors enter. */
  door: { x: number; z: number };
  /** Decorative props: plants, posters, windows. */
  decor: { kind: 'plant' | 'window' | 'poster' | 'bench' | 'lights' | 'sink' | 'sign' | 'door' | 'boxes' | 'trash' | 'bookcase' | 'coatrack' | 'defib' | 'wheelchair' | 'lamp' | 'wetsign'; x: number; z: number; rot?: number; scale?: number }[];
  floor: 'tile' | 'or';
  /** Fixed camera yaw/pitch (radians). The camera NEVER rotates away from these. */
  camYaw: number;
  camPitch: number;
}

/** A task node in the case graph. */
export interface TaskDef {
  id: string;
  name: string;
  /** Station id or a role token like "$bay" resolved per case. */
  stationId: string;
  /** Case phase(s) in which the task can be performed. */
  phase: Phase | Phase[];
  /** Hands-on time Yolanda spends at the station (seconds). */
  duration: number;
  /** Background process time that runs after the hands-on part. */
  process?: number;
  /** Task ids (same case) that must be done first. */
  prerequisites: string[];
  /** Items consumed from the Prep Tray when the task starts. */
  requiredItems: ItemId[];
  /** Items produced when a process finishes; must be collected. */
  producedItems: ItemId[];
  /** When true the background process counts as a parallel timer in the HUD. */
  backgroundProcess?: boolean;
  requiresYolanda: boolean;
  /** Can be performed by a staff member instead. */
  delegatable?: string[];
  safetyCritical?: boolean;
  priority: number;
  /** Task ids this one makes visible (purely informational for the debug panel). */
  unlocks?: string[];
  scoreCategory: ScoreCat;
  optional?: boolean;
  /** Starts automatically when available (no one needs to walk there). */
  auto?: boolean;
  /** Changes the case phase on completion. */
  setsPhase?: Phase;
  /** Requires the proceduralist to be present at the bay. */
  needsProceduralist?: boolean;
  /** Animation Yolanda plays during the hands-on part. */
  anim?: AnimName;
  /** Special interaction handled by the game layer. */
  special?: 'transport' | 'handoff' | 'assess' | 'moveBed';
  /** Done in the pre-op bay when the patient has one (e.g. assessment). */
  preop?: boolean;
  /** Level logistics task: available regardless of patient arrival. */
  levelTask?: boolean;
  /** Hint shown when this is the suggested next step. */
  hint?: string;
  /** Hidden from the task list until unlocked by a modifier reveal. */
  hidden?: boolean;
  /** Shorter label for the compact task list. */
  label?: string;
}

export type AnimName =
  | 'idle' | 'walk' | 'carry' | 'interact' | 'drawer' | 'machine' | 'monitor'
  | 'chart' | 'talk' | 'push' | 'handoff' | 'wait' | 'cheer';

export interface CaseTemplate {
  id: string;
  name: string;
  procedure: string;
  /** Fictional preparation categories shown on the Case Plan. */
  plan: { label: string; items: ItemId[] }[];
  tasks: TaskDef[];
  /** Seconds the procedure itself lasts once active. */
  procedureTime: number;
  proceduralist: { name: string; title: string };
  handoffFacts: { text: string; correct: boolean }[];
}

export interface PatientModifier {
  id: string;
  name: string;
  /** Revealed when this task completes (e.g. assessment). Null = known up front. */
  revealedBy: string | null;
  description: string;
  addTasks: TaskDef[];
  /** Extra required items appended to existing tasks. */
  patchTasks: { id: string; addRequiredItems?: ItemId[]; addPrerequisites?: string[] }[];
  planAdd?: { label: string; items: ItemId[] };
  handoffFacts?: { text: string; correct: boolean }[];
}

export interface Recipe {
  stationKind: StationKind;
  name: string;
  inputs: ItemId[];
  output: ItemId;
  time: number;
}

export interface StaffRole {
  id: string;
  name: string;
  title: string;
  color: string;
  /** Delegation verbs this role can do. */
  can: string[];
}

export interface AttentionEventDef {
  /** Seconds after the case becomes active. */
  at: number;
  id: string;
  name: string;
  stationId: string;   // usually "$bay" or "workstation"
  duration: number;
  /** Seconds before a response counts as late. */
  window: number;
  scoreCategory: ScoreCat;
  /** Vitals effect while unresolved. */
  vitals?: { spo2?: number; hr?: number; comfort?: number };
  bubble: string;
  anim?: AnimName;
}

export interface PatientDef {
  id: string;
  name: string;
  age: string;
  /** Which bay station the procedure happens in. */
  bay: string;
  /** Pre-op bay the patient waits in before moving to `bay`. */
  preopBay?: string;
  /** Seconds after level start that the patient becomes available (arrives). */
  arrival: number;
  /** Seconds after the case is ready that the proceduralist arrives on their own. */
  proceduralistArrival: number;
  modifiers: string[];
  look: { skin: string; hair: string; gown: string; hairStyle: 'short' | 'bun' | 'curly' | 'bald'; model?: string };
  anxious?: boolean;
}

export interface TutorialStep {
  /** Fires when this condition holds. */
  when: string;
  text: string;
  /** Station label to pulse. */
  focus?: string;
}

export interface DelegationDef {
  id: string;
  roleId: string;
  name: string;
  /** Seconds until done. */
  eta: number;
  /** Item delivered to Yolanda's work area (dropped in tray if room, else on cart). */
  deliversItem?: ItemId;
  /** Task id completed by the delegate. */
  completesTask?: string;
  /** Available only in these phases (of the focus case). */
  phases: Phase[];
}

export interface LevelDef {
  id: string;
  number: number;
  title: string;
  location: string;
  /** Lines shown on the case card. */
  cardLines: string[];
  environmentId: string;
  caseTemplateId: string;
  patients: PatientDef[];
  events: AttentionEventDef[];
  staff: string[];
  delegations: DelegationDef[];
  startClock: number; // minutes since midnight
  /** Distance a tidy route takes (for the efficiency score). */
  parWalk: number;
  tutorial?: TutorialStep[];
  /** Required items glow in the prep close-up. */
  glowRequired?: boolean;
  /** One-line teaching goal. */
  lesson: string;
  /** Turnover tasks between cases (level 2). Attached to the last case. */
  turnoverTasks?: TaskDef[];
  /** Extra prerequisites per case, e.g. "B.time_out needs B.bring_to_bay". */
  casePatches?: { caseId: string; taskId: string; addPrerequisites: string[] }[];
  /** Limited supply-cart stock (items not listed are unlimited). */
  stock?: Record<string, number>;
  /** Stock level after a restock. */
  restockTo?: number;
}
