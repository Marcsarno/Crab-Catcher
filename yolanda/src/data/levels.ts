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
    parWalk: 72,
    glowRequired: true,
    tutorial: [
      { when: 'room', text: 'Tap a station to send Yolanda. Tap several to plan a route. The <b>yellow arrow</b> shows a good next step.' },
      { when: 'task:workstation_check:running', text: 'Machines keep working while you walk away. Start the slow ones first.' },
      { when: 'phase:active', text: 'Sedation started. Yolanda stays inside the <b>patient zone</b> now. Answer alerts quickly.' },
      { when: 'phase:recovery', text: 'Procedure done! Wake-up check, then wheel the patient to the <b>PACU</b>.' },
    ],
  },
  {
    id: 'L2', number: 2, title: 'Rapid Turnover', location: 'Endoscopy Suite',
    cardLines: ['Two adults back-to-back', 'Ms. Chen, 61 → Mr. Haddad, 47 (Pre-op)', 'Cart stock is low: one set of each'],
    lesson: 'Don\'t wait until a case is finished to prepare the next one.',
    environmentId: 'endo2', caseTemplateId: 'routineEndo',
    patients: [
      {
        id: 'A', name: 'Ms. Chen', age: '61', bay: 'bay1', arrival: 0, proceduralistArrival: 105, modifiers: [],
        look: { skin: '#e8c4a0', hair: '#5a5a5a', gown: '#8fb8e8', hairStyle: 'bun' },
      },
      {
        id: 'B', name: 'Mr. Haddad', age: '47', bay: 'bay1', preopBay: 'bay2', arrival: 35, proceduralistArrival: 250, modifiers: [],
        look: { skin: '#a8724c', hair: '#1f1a17', gown: '#a6d3c7', hairStyle: 'curly' },
      },
    ],
    events: endoEvents,
    staff: ['tech'],
    stock: { calmBlue: 1, comfortGold: 1, monitorPack: 1, scopeAirKit: 1 },
    restockTo: 3,
    turnoverTasks: [
      {
        id: 'restock', name: 'Restock supply cart', label: 'Restock cart', stationId: 'supplies', phase: ['prep'], duration: 4,
        prerequisites: [], requiredItems: [], producedItems: [], requiresYolanda: true, levelTask: true, delegatable: ['tech'],
        priority: 8, scoreCategory: 'team', anim: 'drawer', hint: 'Marco can do this while you are busy.',
      },
      {
        id: 'turn_room', name: 'Turn over procedure bay', label: 'Turn over bay', stationId: 'bay1', phase: ['prep'], duration: 5,
        prerequisites: ['A.transport'], requiredItems: [], producedItems: [], requiresYolanda: true, levelTask: true, delegatable: ['tech'],
        priority: 3, scoreCategory: 'team', anim: 'interact',
      },
      {
        id: 'bring_to_bay', name: 'Wheel into procedure bay', label: 'Wheel to procedure bay', stationId: 'bay2', phase: ['prep'], duration: 0.5,
        prerequisites: ['turn_room', 'assess_patient', 'apply_monitors'], requiredItems: [], producedItems: [], requiresYolanda: true,
        priority: 7, scoreCategory: 'team', special: 'moveBed', anim: 'push',
      },
    ],
    casePatches: [
      { caseId: 'B', taskId: 'time_out', addPrerequisites: ['bring_to_bay'] },
      { caseId: 'B', taskId: 'workstation_check', addPrerequisites: ['A.transport'] },
    ],
    delegations: [
      { id: 'restock', roleId: 'tech', name: 'Restock supply cart', eta: 18, completesTask: 'restock', phases: ['prep', 'active', 'recovery'] },
      { id: 'turn_room', roleId: 'tech', name: 'Turn over procedure bay', eta: 14, completesTask: 'turn_room', phases: ['prep', 'active', 'recovery', 'done'] },
    ],
    startClock: 9 * 60 + 5,
    parWalk: 150,
    tutorial: [
      { when: 'room', text: 'Two patients today. The cart holds <b>one set</b> of supplies — someone must <b>Restock</b> before Mr. Haddad\'s prep.', focus: 'supplies' },
      { when: 'phase:active', text: 'Stuck at the bedside? Tap <b>Team</b> — Marco can restock the cart while you work.' },
      { when: 'task:A.transport:done', text: 'Bay is empty: turn it over (or ask Marco), then wheel Mr. Haddad in from <b>Pre-op</b>.', focus: 'bay1' },
    ],
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
    parWalk: 72,
  },
];
