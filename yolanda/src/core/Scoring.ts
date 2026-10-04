import type { ScoreCat } from './types';
import type { TaskSystem } from './TaskSystem';

export interface Metrics {
  walk: number;
  wastedVisits: number;
  waitTime: number;
  wrongPicks: number;
  drawerTrips: number;
  handoffCorrect: Record<string, number>;
  handoffWrong: Record<string, number>;
  roomStart: number;
  proceduralistArrived: Record<string, number>;
  delegations: number;
  zoneBlocks: number;
}

export function newMetrics(): Metrics {
  return {
    walk: 0, wastedVisits: 0, waitTime: 0, wrongPicks: 0, drawerTrips: 0, handoffCorrect: {}, handoffWrong: {},
    roomStart: 0, proceduralistArrived: {}, delegations: 0, zoneBlocks: 0,
  };
}

interface Check {
  cat: ScoreCat;
  weight: number;
  score: number; // 0..1
  good: string;
  improve: string;
}

export interface ScoreResult {
  stars: Record<ScoreCat, number>;
  total: number;
  good: string[];
  improve: string[];
  raw: Record<ScoreCat, number>;
}

export const CAT_LABEL: Record<ScoreCat, string> = {
  safety: 'Safety', anticipation: 'Anticipation', efficiency: 'Efficiency', care: 'Patient Care', team: 'Team Flow',
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function scoreLevel(ts: TaskSystem, m: Metrics, parWalk: number): ScoreResult {
  const checks: Check[] = [];
  const multi = ts.cases.length > 1;
  const named = (c: { patient: { name: string } }, s: string) => (multi ? `${c.patient.name}: ${s}` : s);

  for (const c of ts.cases) {
    const g = (id: string) => ts.get(c.id, id);
    const ws = g('workstation_check'), seda = g('load_sedaprep'), scope = g('load_scopeair');
    const assess = g('assess_patient'), timeOut = g('time_out'), pacu = g('call_pacu'), doc = g('document_case');
    const wake = g('wake_check'), transport = g('transport');
    const recoveryAt = c.phaseAt.recovery ?? ts.time;
    const activeAt = c.phaseAt.active ?? ts.time;
    const roomStart = Math.max(m.roomStart, c.patient.arrival);

    // ---- anticipation: slow machines started early
    if (ws?.startedAt != null) {
      const delay = ws.startedAt - roomStart;
      checks.push({ cat: 'anticipation', weight: 2, score: clamp01(1 - (delay - 6) / 30),
        good: named(c, 'Started the workstation check early.'), improve: named(c, 'Start the workstation check sooner — it is the slowest step.') });
    }
    const machineDelay = [seda, scope].filter((t) => t?.startedAt != null).map((t) => t!.startedAt! - roomStart);
    if (machineDelay.length) {
      const worst = Math.max(...machineDelay);
      checks.push({ cat: 'anticipation', weight: 1.5, score: clamp01(1 - (worst - 15) / 35),
        good: named(c, 'Got SedaPrep and ScopeAir running early.'), improve: named(c, 'Load SedaPrep/ScopeAir earlier so they finish while you work.') });
    }
    if (pacu?.doneAt != null || pacu?.startedAt != null) {
      const readyAt = pacu.doneAt ?? Infinity;
      const late = readyAt - recoveryAt;
      checks.push({ cat: 'anticipation', weight: 2, score: clamp01(1 - late / 20),
        good: named(c, 'PACU bed was ready when the procedure ended.'), improve: named(c, 'Request the PACU bed earlier — it takes time.') });
    } else if (pacu) {
      checks.push({ cat: 'anticipation', weight: 2, score: 0, good: '', improve: named(c, 'Request the PACU bed during the procedure.') });
    }
    // reveal-driven: modifier tasks started soon after reveal
    for (const t of ts.list().filter((x) => x.caseId === c.id && x.def.id === 'build_special_airway')) {
      if (t.startedAt != null && assess?.doneAt != null) {
        const d = t.startedAt - assess.doneAt;
        checks.push({ cat: 'anticipation', weight: 2, score: clamp01(1 - (d - 12) / 30),
          good: named(c, 'Adapted fast: built the Special Airway Kit right after assessment.'), improve: named(c, 'After the airway alert, head to AirReady sooner.') });
      }
    }
    if (assess?.doneAt != null && c.patient.modifiers.length) {
      const d = assess.doneAt - roomStart;
      checks.push({ cat: 'anticipation', weight: 1.5, score: clamp01(1 - (d - 25) / 40),
        good: named(c, 'Assessed the patient early and caught the change.'), improve: named(c, 'Assess earlier — the patient can change your plan.') });
    }

    // ---- team flow: nobody waiting on Yolanda
    const procArr = m.proceduralistArrived[c.id];
    if (procArr != null && timeOut?.doneAt != null) {
      const wait = Math.max(0, timeOut.doneAt - procArr - 3);
      checks.push({ cat: 'team', weight: 2, score: clamp01(1 - wait / 25),
        good: named(c, `${c.template.proceduralist.name} started without waiting.`), improve: named(c, `${c.template.proceduralist.name} waited ${Math.round(wait)}s for you to be ready.`) });
    }
    if (wake?.doneAt != null && transport?.startedAt != null) {
      const wait = Math.max(0, (pacu?.doneAt ?? transport.startedAt) - wake.doneAt);
      checks.push({ cat: 'team', weight: 1.5, score: clamp01(1 - wait / 15),
        good: named(c, 'Recovery handoff flowed smoothly.'), improve: named(c, 'Patient waited for a PACU bed after waking up.') });
    }
    if (doc?.doneAt != null) {
      const during = doc.doneAt <= recoveryAt;
      checks.push({ cat: 'efficiency', weight: 1.5, score: during ? 1 : 0.4,
        good: named(c, 'Documented during the procedure, not after.'), improve: named(c, 'Document while the procedure runs to save time later.') });
    }

    // ---- care
    const chat = g('comfort_chat');
    checks.push({ cat: 'care', weight: 1.5, score: chat?.doneAt != null ? 1 : 0.2,
      good: named(c, 'Warm blanket + reassurance before sedation.'), improve: named(c, 'Spend a moment reassuring the patient (blanket & chat).') });
    if (wake?.doneAt != null) {
      const d = wake.doneAt - recoveryAt;
      checks.push({ cat: 'care', weight: 1, score: clamp01(1 - (d - 6) / 20),
        good: named(c, 'Prompt wake-up check.'), improve: named(c, 'Do the wake-up check right after the procedure.') });
    }
    if (assess?.doneAt != null) {
      const before = assess.doneAt < activeAt;
      checks.push({ cat: 'care', weight: 0.5, score: before ? 1 : 0, good: '', improve: '' });
    }

    // ---- handoff accuracy
    const right = m.handoffCorrect[c.id] ?? 0, wrong = m.handoffWrong[c.id] ?? 0;
    checks.push({ cat: 'safety', weight: 2, score: clamp01((right - wrong * 1.5) / 3),
      good: named(c, 'Clear, accurate handoff report.'), improve: named(c, 'Handoff included wrong details — report only what happened.') });
  }

  // ---- attention events (safety / care)
  for (const t of ts.list().filter((x) => x.event)) {
    const ev = t.event!;
    const resp = (t.doneAt ?? ts.time) - ev.createdAt;
    const score = t.by === 'missed' ? 0 : clamp01(1 - Math.max(0, resp - ev.def.window * 0.5) / ev.def.window);
    checks.push({
      cat: ev.def.scoreCategory, weight: 1.2, score,
      good: `Responded quickly to "${ev.def.bubble}".`, improve: `Slow response to "${ev.def.bubble}".`,
    });
  }

  // ---- efficiency
  const walkRatio = m.walk / Math.max(1, parWalk);
  checks.push({ cat: 'efficiency', weight: 2, score: clamp01(1 - (walkRatio - 1.1) / 0.9),
    good: 'Efficient route — very little extra walking.', improve: `Walked ${Math.round(m.walk)}m (tidy route ≈ ${parWalk}m). Plan multi-stop routes.` });
  checks.push({ cat: 'efficiency', weight: 1.5, score: clamp01(1 - m.wastedVisits / 4),
    good: 'No wasted trips.', improve: `${m.wastedVisits} trip(s) arrived with nothing to do.` });
  checks.push({ cat: 'efficiency', weight: 1, score: clamp01(1 - m.wrongPicks / 3),
    good: 'Picked exactly what the case plan needed.', improve: 'Took items the case plan did not need.' });
  checks.push({ cat: 'anticipation', weight: 1.5, score: clamp01(1 - m.waitTime / 20),
    good: 'Never stood around waiting for a machine.', improve: `Stood waiting at machines for ${Math.round(m.waitTime)}s — do something else meanwhile.` });

  const cats: ScoreCat[] = ['safety', 'anticipation', 'efficiency', 'care', 'team'];
  const raw = {} as Record<ScoreCat, number>;
  const stars = {} as Record<ScoreCat, number>;
  for (const cat of cats) {
    const cs = checks.filter((c) => c.cat === cat);
    const w = cs.reduce((a, c) => a + c.weight, 0);
    raw[cat] = w ? cs.reduce((a, c) => a + c.weight * c.score, 0) / w : 1;
    stars[cat] = raw[cat] >= 0.85 ? 3 : raw[cat] >= 0.55 ? 2 : 1;
  }
  const good = checks.filter((c) => c.score >= 0.85 && c.good).sort((a, b) => b.weight - a.weight).map((c) => c.good);
  const improve = checks.filter((c) => c.score < 0.7 && c.improve).sort((a, b) => b.weight * (1 - b.score) - a.weight * (1 - a.score)).map((c) => c.improve);
  const total = cats.reduce((a, c) => a + stars[c], 0);
  return { stars, total, good: [...new Set(good)].slice(0, 3), improve: [...new Set(improve)].slice(0, 3), raw };
}
