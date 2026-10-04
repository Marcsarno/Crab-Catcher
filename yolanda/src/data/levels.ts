import type { AttentionEventDef, LevelDef } from '../core/types';

// A level = CASE TEMPLATE + PATIENT MODIFIERS + ENVIRONMENT + OPERATIONAL EVENTS.

const endoEvents: AttentionEventDef[] = [
  { at: 6, id: 'vitals1', name: 'Chart vitals', stationId: 'workstation', duration: 1.5, window: 14, scoreCategory: 'safety', bubble: 'Vitals due', anim: 'monitor' },
  { at: 17, id: 'spo2', name: 'Support airway', stationId: '$bay', duration: 2, window: 9, scoreCategory: 'safety', vitals: { spo2: -7, hr: 8 }, bubble: 'SpO₂ dipping', anim: 'interact' },
  { at: 31, id: 'stir', name: 'Comfort check', stationId: '$bay', duration: 2, window: 10, scoreCategory: 'care', vitals: { hr: 14, comfort: -40 }, bubble: 'Patient stirring', anim: 'talk' },
  { at: 42, id: 'vitals2', name: 'Chart vitals', stationId: 'workstation', duration: 1.5, window: 12, scoreCategory: 'safety', bubble: 'Vitals due', anim: 'monitor' },
];

export const LEVELS: LevelDef[] = [
  {
    id: 'L1', number: 1, title: 'Routine Endoscopy', location: 'Endoscopy Suite',
    cardLines: ['Adult · Mr. Alvarez, 54', 'Routine upper endoscopy', 'No major modifier'],
    lesson: 'Start slow machines first, then do quick tasks while they run.',
    environmentId: 'endo', caseTemplateId: 'routineEndo',
    patients: [{
      id: 'A', name: 'Mr. Alvarez', age: '54', bay: 'bay1', arrival: 0, proceduralistArrival: 105, modifiers: [],
      look: { skin: '#c98e62', hair: '#2e2420', gown: '#8fb8e8', hairStyle: 'short' },
    }],
    events: endoEvents,
    staff: [],
    delegations: [],
    startClock: 7 * 60 + 30,
    parWalk: 70,
    glowRequired: true,
    tutorial: [
      { when: 'room', text: 'Machine checks take a while. Tap the <b>Workstation</b> first to start its check.', focus: 'workstation' },
      { when: 'task:workstation_check:running', text: 'While it runs, drop the cartridges into <b>SedaPrep</b>. Tip: tap several stations to queue a route.', focus: 'sedaprep' },
      { when: 'task:load_sedaprep:running', text: 'Now stage the <b>ScopeAir</b> kit. Two machines working for you!', focus: 'scopeair' },
      { when: 'task:load_scopeair:running', text: 'Review the <b>Chart</b> while the machines run.', focus: 'chart' },
      { when: 'task:review_chart:done', text: 'Meet Mr. Alvarez at the <b>Patient Bay</b>: assess, then attach monitors.', focus: '$bay' },
      { when: 'task:apply_monitors:done', text: 'Collect the <b>READY</b> sets from the machines and bring them to the bay.' },
      { when: 'available:time_out', text: 'All set! Begin sedation at the <b>Patient Bay</b> once Dr. Okafor is here.', focus: '$bay' },
      { when: 'phase:active', text: 'Yolanda stays with her patient now. Answer alerts on the bay and workstation.' },
      { when: 'active:24', text: 'About halfway. Request a <b>PACU bed</b> at the workstation now so it\'s ready in time.', focus: 'workstation' },
      { when: 'phase:recovery', text: 'Procedure done! Wake-up check, then wheel Mr. Alvarez to <b>Handoff</b>.', focus: '$bay' },
    ],
  },
  {
    id: 'L2', number: 2, title: 'Rapid Turnover', location: 'Endoscopy Suite',
    cardLines: ['Two adults back-to-back', 'Ms. Chen, 61 → Mr. Haddad, 47', 'Routine endoscopy ×2'],
    lesson: 'Don\'t wait until a case is finished to prepare the next one.',
    environmentId: 'endo2', caseTemplateId: 'routineEndo',
    patients: [
      {
        id: 'A', name: 'Ms. Chen', age: '61', bay: 'bay1', arrival: 0, proceduralistArrival: 95, modifiers: [],
        look: { skin: '#e8c4a0', hair: '#5a5a5a', gown: '#8fb8e8', hairStyle: 'bun' },
      },
      {
        id: 'B', name: 'Mr. Haddad', age: '47', bay: 'bay2', arrival: 40, proceduralistArrival: 60, modifiers: [],
        look: { skin: '#a8724c', hair: '#1f1a17', gown: '#a6d3c7', hairStyle: 'curly' },
      },
    ],
    events: endoEvents,
    staff: ['tech'],
    delegations: [
      { id: 'restock', roleId: 'tech', name: 'Restock supplies', eta: 18, completesTask: 'restock', phases: ['prep', 'active', 'recovery', 'done'] },
      { id: 'turn_room', roleId: 'tech', name: 'Turn over the room', eta: 16, completesTask: 'turn_room', phases: ['done', 'prep'] },
    ],
    startClock: 9 * 60 + 5,
    parWalk: 140,
  },
  {
    id: 'L3', number: 3, title: 'Patient Modifier', location: 'Endoscopy Suite',
    cardLines: ['Adult · Ms. Okoye, 58', 'Routine endoscopy', 'Assessment pending…'],
    lesson: 'Same procedure does not always mean same preparation. Assess early.',
    environmentId: 'endo3', caseTemplateId: 'routineEndo',
    patients: [{
      id: 'A', name: 'Ms. Okoye', age: '58', bay: 'bay1', arrival: 0, proceduralistArrival: 120, modifiers: ['airwayAlert'],
      look: { skin: '#7a4b30', hair: '#1a1412', gown: '#8fb8e8', hairStyle: 'curly' },
    }],
    events: endoEvents,
    staff: [],
    delegations: [],
    startClock: 11 * 60 + 20,
    parWalk: 95,
  },
];
