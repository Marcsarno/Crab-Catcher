import type { CaseTemplate } from '../core/types';
import { RECIPES } from './recipes';

// Case templates turn a procedure type into a task graph.
// WHY each task exists comes from real anesthesia workflow; HOW it plays is fictional.
// "$bay" is replaced by the bay the patient occupies.

export const CASE_TEMPLATES: Record<string, CaseTemplate> = {
  routineEndo: {
    id: 'routineEndo',
    name: 'Routine Endoscopy',
    procedure: 'Endoscopy',
    procedureTime: 55,
    proceduralist: { name: 'Dr. Okafor', title: 'Endoscopist' },
    plan: [
      { label: 'Calm', items: ['calmBlue'] },
      { label: 'Comfort', items: ['comfortGold'] },
      { label: 'Monitoring', items: ['monitorPack'] },
      { label: 'ScopeAir', items: ['scopeAirKit'] },
    ],
    handoffFacts: [
      { text: 'Routine endoscopy, finished without problems', correct: true },
      { text: 'Prep used: Calm + Comfort', correct: true },
      { text: 'Awake, comfortable, vitals steady', correct: true },
      { text: 'Pediatric monitoring was used', correct: false },
      { text: 'Special airway kit was prepared', correct: false },
      { text: 'Needs to go straight back to the OR', correct: false },
    ],
    tasks: [
      // ---------------- PREP ----------------
      {
        id: 'workstation_check', name: 'Start workstation check', label: 'Workstation check',
        stationId: 'workstation', phase: 'prep', duration: 1.5, process: 22, backgroundProcess: true,
        prerequisites: [], requiredItems: [], producedItems: [], requiresYolanda: true,
        safetyCritical: true, priority: 5, scoreCategory: 'safety', anim: 'machine',
        hint: 'Machine checks take a while — start it first.',
      },
      {
        id: 'load_sedaprep', name: 'Load SedaPrep', label: 'SedaPrep',
        stationId: 'sedaprep', phase: 'prep', duration: 1.5, process: RECIPES.sedaStandard.time, backgroundProcess: true,
        prerequisites: [], requiredItems: RECIPES.sedaStandard.inputs, producedItems: ['sedaSet'],
        requiresYolanda: true, priority: 4, scoreCategory: 'anticipation', anim: 'machine',
        hint: 'Load the Calm + Comfort cartridges.',
      },
      {
        id: 'load_scopeair', name: 'Stage ScopeAir', label: 'ScopeAir',
        stationId: 'scopeair', phase: 'prep', duration: 1.5, process: RECIPES.scopeAir.time, backgroundProcess: true,
        prerequisites: [], requiredItems: RECIPES.scopeAir.inputs, producedItems: ['scopeAirSet'],
        requiresYolanda: true, priority: 4, scoreCategory: 'anticipation', anim: 'machine',
        hint: 'Stage the ScopeAir kit.',
      },
      {
        id: 'review_chart', name: 'Review chart', label: 'Review chart',
        stationId: 'chart', phase: 'prep', duration: 3, prerequisites: [], requiredItems: [], producedItems: [],
        requiresYolanda: true, priority: 3, scoreCategory: 'safety', anim: 'chart', unlocks: ['assess_patient'],
        hint: 'Know your patient before you meet them.',
      },
      {
        id: 'assess_patient', name: 'Assess patient', label: 'Assess patient',
        stationId: '$bay', phase: 'prep', duration: 3.5, prerequisites: ['review_chart'], requiredItems: [], producedItems: [],
        requiresYolanda: true, safetyCritical: true, priority: 6, scoreCategory: 'care', anim: 'talk', special: 'assess', preop: true,
        hint: 'Talk with the patient — it can change your plan.',
      },
      {
        id: 'apply_monitors', name: 'Attach monitors', label: 'Attach monitors',
        stationId: '$bay', phase: 'prep', duration: 2.5, prerequisites: ['assess_patient'], requiredItems: ['monitorPack'], producedItems: [],
        requiresYolanda: true, safetyCritical: true, priority: 5, scoreCategory: 'safety', anim: 'interact', preop: true,
      },
      {
        id: 'comfort_chat', name: 'Warm blanket & reassure', label: 'Blanket & reassure (bonus)',
        stationId: '$bay', phase: 'prep', duration: 2.5, prerequisites: ['assess_patient'], requiredItems: [], producedItems: [],
        requiresYolanda: true, optional: true, priority: 2, scoreCategory: 'care', anim: 'talk', preop: true,
      },
      {
        id: 'time_out', name: 'Time out & begin sedation', label: 'Begin sedation',
        stationId: '$bay', phase: 'prep', duration: 3,
        prerequisites: ['workstation_check', 'load_sedaprep', 'load_scopeair', 'apply_monitors'],
        requiredItems: ['sedaSet', 'scopeAirSet'], producedItems: [], requiresYolanda: true,
        safetyCritical: true, priority: 9, scoreCategory: 'safety', needsProceduralist: true, setsPhase: 'active', anim: 'interact',
      },
      // ---------------- ACTIVE ----------------
      {
        id: 'procedure', name: 'Procedure', label: 'Procedure underway',
        stationId: '$bay', phase: 'active', duration: 0, process: 55, prerequisites: [], requiredItems: [], producedItems: [],
        requiresYolanda: false, auto: true, priority: 0, scoreCategory: 'team', setsPhase: 'recovery',
      },
      {
        id: 'call_pacu', name: 'Request PACU bed', label: 'Request PACU bed',
        stationId: 'workstation', phase: 'active', duration: 1, process: 20, backgroundProcess: true,
        prerequisites: [], requiredItems: [], producedItems: [], requiresYolanda: true, priority: 3,
        scoreCategory: 'anticipation', anim: 'monitor', hint: 'Recovery will need a bed. Ask early.',
      },
      {
        id: 'document_case', name: 'Document case', label: 'Document case',
        stationId: 'workstation', phase: ['active', 'recovery'], duration: 3, prerequisites: [], requiredItems: [], producedItems: [],
        requiresYolanda: true, priority: 2, scoreCategory: 'efficiency', anim: 'chart',
        hint: 'Chart while the procedure runs.',
      },
      // ---------------- RECOVERY ----------------
      {
        id: 'wake_check', name: 'Wake-up check', label: 'Wake-up check',
        stationId: '$bay', phase: 'recovery', duration: 3, prerequisites: [], requiredItems: [], producedItems: [],
        requiresYolanda: true, safetyCritical: true, priority: 7, scoreCategory: 'care', anim: 'talk',
      },
      {
        id: 'transport', name: 'Wheel to Handoff', label: 'Wheel to PACU',
        stationId: '$bay', phase: 'recovery', duration: 0.5, prerequisites: ['wake_check', 'call_pacu'], requiredItems: [], producedItems: [],
        requiresYolanda: true, priority: 6, scoreCategory: 'team', special: 'transport', anim: 'push',
      },
      {
        id: 'handoff', name: 'Handoff report', label: 'Handoff report',
        stationId: 'handoff', phase: 'recovery', duration: 0.5, prerequisites: ['transport', 'document_case'], requiredItems: [], producedItems: [],
        requiresYolanda: true, safetyCritical: true, priority: 8, scoreCategory: 'safety', special: 'handoff', setsPhase: 'done', anim: 'handoff',
      },
    ],
  },
  generalOR: {
    id: 'generalOR',
    name: 'Laparoscopic Gallbladder Surgery',
    procedure: 'Surgery',
    procedureTime: 60,
    proceduralist: { name: 'Dr. Lin', title: 'Surgeon' },
    plan: [
      { label: 'Calm', items: ['calmBlue'] },
      { label: 'Comfort', items: ['comfortGold'] },
      { label: 'Airway', items: ['airwayKit'] },
      { label: 'Monitoring + Pressure', items: ['monitorPack', 'pressurePack'] },
      { label: 'Recovery Support', items: ['recoverGreen'] },
    ],
    handoffFacts: [
      { text: 'Gallbladder surgery under general anesthesia', correct: true },
      { text: 'Kept warm with ThermaNest throughout', correct: true },
      { text: 'Woke up smoothly with RecoverGreen support', correct: true },
      { text: 'ScopeAir was used for the procedure', correct: false },
      { text: 'Pediatric monitoring was used', correct: false },
      { text: 'Needs a second surgery today', correct: false },
    ],
    tasks: [
      // ---------------- PREP ----------------
      {
        id: 'thermanest_start', name: 'Start ThermaNest', label: 'Warm ThermaNest',
        stationId: 'thermanest', phase: 'prep', duration: 1.5, process: 32, backgroundProcess: true,
        prerequisites: [], requiredItems: [], producedItems: [], requiresYolanda: true,
        priority: 6, scoreCategory: 'anticipation', anim: 'machine',
        hint: 'ThermaNest is the slowest machine in the room — start it first.',
      },
      {
        id: 'workstation_check', name: 'Start workstation check', label: 'Workstation check',
        stationId: 'workstation', phase: 'prep', duration: 1.5, process: 26, backgroundProcess: true,
        prerequisites: [], requiredItems: [], producedItems: [], requiresYolanda: true,
        safetyCritical: true, priority: 5, scoreCategory: 'safety', anim: 'machine',
        hint: 'General anesthesia needs a full machine check. Start it early.',
      },
      {
        id: 'load_sedaprep', name: 'Load SedaPrep', label: 'SedaPrep',
        stationId: 'sedaprep', phase: 'prep', duration: 1.5, process: RECIPES.sedaStandard.time, backgroundProcess: true,
        prerequisites: [], requiredItems: RECIPES.sedaStandard.inputs, producedItems: ['sedaSet'],
        requiresYolanda: true, priority: 4, scoreCategory: 'anticipation', anim: 'machine',
        hint: 'Load the Calm + Comfort cartridges.',
      },
      {
        id: 'build_airway', name: 'Build airway set', label: 'Airway set',
        stationId: 'airready', phase: 'prep', duration: 1.5, process: RECIPES.standardAirway.time, backgroundProcess: true,
        prerequisites: [], requiredItems: RECIPES.standardAirway.inputs, producedItems: ['airwaySet'],
        requiresYolanda: true, safetyCritical: true, priority: 4, scoreCategory: 'safety', anim: 'machine',
        hint: 'AirReady turns the Airway Kit into a ready set.',
      },
      {
        id: 'build_monitoring', name: 'Build OR monitor set', label: 'Monitor set',
        stationId: 'vitadock', phase: 'prep', duration: 1.5, process: RECIPES.orMonitoring.time, backgroundProcess: true,
        prerequisites: [], requiredItems: RECIPES.orMonitoring.inputs, producedItems: ['orMonitorSet'],
        requiresYolanda: true, priority: 4, scoreCategory: 'anticipation', anim: 'machine',
        hint: 'VitaDock combines Monitor + Pressure packs.',
      },
      {
        id: 'prep_recover', name: 'Prepare RecoverSet', label: 'RecoverSet (for closing)',
        stationId: 'sedaprep', phase: ['prep', 'active', 'closing'], duration: 1.5, process: RECIPES.recover.time, backgroundProcess: true,
        prerequisites: ['load_sedaprep'], requiredItems: RECIPES.recover.inputs, producedItems: ['recoverSet'],
        requiresYolanda: true, priority: 3, scoreCategory: 'anticipation', anim: 'machine', delegatable: ['circulator'],
        hint: 'You will need RecoverSet at closing, and you can\'t leave the patient then. Make it now.',
      },
      {
        id: 'review_chart', name: 'Review chart', label: 'Review chart',
        stationId: 'orchart', phase: 'prep', duration: 3, prerequisites: [], requiredItems: [], producedItems: [],
        requiresYolanda: true, priority: 3, scoreCategory: 'safety', anim: 'chart',
        hint: 'Know your patient before you meet them.',
      },
      {
        id: 'assess_patient', name: 'Assess patient', label: 'Assess patient',
        stationId: '$bay', phase: 'prep', duration: 3.5, prerequisites: ['review_chart'], requiredItems: [], producedItems: [],
        requiresYolanda: true, safetyCritical: true, priority: 6, scoreCategory: 'care', anim: 'talk', special: 'assess',
        hint: 'Talk with the patient before anything else happens.',
      },
      {
        id: 'apply_monitors', name: 'Attach OR monitors', label: 'Attach monitors',
        stationId: '$bay', phase: 'prep', duration: 2.5, prerequisites: ['assess_patient'], requiredItems: ['orMonitorSet'], producedItems: [],
        requiresYolanda: true, safetyCritical: true, priority: 5, scoreCategory: 'safety', anim: 'interact',
      },
      {
        id: 'warm_patient', name: 'Warm blanket on', label: 'Warm the patient',
        stationId: '$bay', phase: 'prep', duration: 2, prerequisites: ['assess_patient', 'thermanest_start'], requiredItems: [], producedItems: [],
        requiresYolanda: true, priority: 4, scoreCategory: 'care', anim: 'talk',
        hint: 'ThermaNest is warm — tuck the patient in.',
      },
      {
        id: 'time_out', name: 'Time out & induction', label: 'Induction',
        stationId: '$bay', phase: 'prep', duration: 3,
        prerequisites: ['workstation_check', 'load_sedaprep', 'build_airway', 'apply_monitors', 'warm_patient'],
        requiredItems: ['sedaSet', 'airwaySet'], producedItems: [], requiresYolanda: true,
        safetyCritical: true, priority: 9, scoreCategory: 'safety', needsProceduralist: true, setsPhase: 'active', anim: 'interact',
      },
      // ---------------- ACTIVE (procedure) ----------------
      {
        id: 'procedure', name: 'Surgery', label: 'Surgery underway',
        stationId: '$bay', phase: 'active', duration: 0, process: 60, prerequisites: [], requiredItems: [], producedItems: [],
        requiresYolanda: false, auto: true, priority: 0, scoreCategory: 'team', setsPhase: 'closing',
      },
      {
        id: 'call_pacu', name: 'Request PACU bed', label: 'Request PACU bed',
        stationId: 'workstation', phase: ['active', 'closing'], duration: 1, process: 22, backgroundProcess: true,
        prerequisites: [], requiredItems: [], producedItems: [], requiresYolanda: true, priority: 3,
        scoreCategory: 'anticipation', anim: 'monitor', hint: 'Recovery will need a bed. Ask early.',
      },
      {
        id: 'document_case', name: 'Document case', label: 'Document case',
        stationId: 'orchart', phase: ['active', 'closing', 'recovery'], duration: 3, prerequisites: [], requiredItems: [], producedItems: [],
        requiresYolanda: true, priority: 2, scoreCategory: 'efficiency', anim: 'chart',
        hint: 'Chart while the surgery runs.',
      },
      // ---------------- CLOSING ----------------
      {
        id: 'closing_proc', name: 'Surgeon closing', label: 'Closing',
        stationId: '$bay', phase: 'closing', duration: 0, process: 20, prerequisites: [], requiredItems: [], producedItems: [],
        requiresYolanda: false, auto: true, priority: 0, scoreCategory: 'team', setsPhase: 'recovery',
      },
      {
        id: 'emergence', name: 'Begin emergence', label: 'Begin emergence',
        stationId: 'workstation', phase: ['closing', 'recovery'], duration: 2.5, prerequisites: [], requiredItems: ['recoverSet'], producedItems: [],
        requiresYolanda: true, safetyCritical: true, priority: 8, scoreCategory: 'anticipation', anim: 'machine',
        hint: 'Surgeon is closing. Start emergence with the RecoverSet.',
      },
      // ---------------- RECOVERY ----------------
      {
        id: 'wake_check', name: 'Wake-up check', label: 'Wake-up check',
        stationId: '$bay', phase: 'recovery', duration: 3, prerequisites: ['emergence'], requiredItems: [], producedItems: [],
        requiresYolanda: true, safetyCritical: true, priority: 7, scoreCategory: 'care', anim: 'talk',
      },
      {
        id: 'transport', name: 'Wheel to PACU', label: 'Wheel to PACU',
        stationId: '$bay', phase: 'recovery', duration: 0.5, prerequisites: ['wake_check', 'call_pacu'], requiredItems: [], producedItems: [],
        requiresYolanda: true, priority: 6, scoreCategory: 'team', special: 'transport', anim: 'push',
      },
      {
        id: 'handoff', name: 'Handoff report', label: 'Handoff report',
        stationId: 'handoff', phase: 'recovery', duration: 0.5, prerequisites: ['transport', 'document_case'], requiredItems: [], producedItems: [],
        requiresYolanda: true, safetyCritical: true, priority: 8, scoreCategory: 'safety', special: 'handoff', setsPhase: 'done', anim: 'handoff',
      },
    ],
  },
};
