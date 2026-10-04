import type { PatientModifier } from '../core/types';
import { RECIPES } from './recipes';

// Modifiers patch a case's task graph. Same procedure ≠ same preparation.
export const PATIENT_MODIFIERS: Record<string, PatientModifier> = {
  airwayAlert: {
    id: 'airwayAlert',
    name: 'Airway Alert',
    revealedBy: 'assess_patient',
    description: 'Assessment found a tricky airway. Build a Special Airway Kit at AirReady before sedation.',
    planAdd: { label: 'Special Airway', items: ['airwayKit', 'specialAirwayParts'] },
    addTasks: [
      {
        id: 'build_special_airway', name: 'Build Special Airway Kit', label: 'Special Airway Kit',
        stationId: 'airready', phase: 'prep', duration: 1.5, process: RECIPES.specialAirway.time, backgroundProcess: true,
        prerequisites: ['assess_patient'], requiredItems: RECIPES.specialAirway.inputs, producedItems: ['specialAirwayKit'],
        requiresYolanda: true, safetyCritical: true, priority: 6, scoreCategory: 'safety', anim: 'machine',
        hint: 'Airway Kit + Special Parts → AirReady.',
      },
      {
        id: 'stage_special_airway', name: 'Stage airway kit at bedside', label: 'Stage airway kit',
        stationId: '$bay', phase: 'prep', duration: 1.5, prerequisites: ['build_special_airway'],
        requiredItems: ['specialAirwayKit'], producedItems: [], requiresYolanda: true, safetyCritical: true,
        priority: 7, scoreCategory: 'safety', anim: 'interact',
      },
    ],
    patchTasks: [{ id: 'time_out', addPrerequisites: ['stage_special_airway'] }],
    handoffFacts: [
      { text: 'Special airway kit was prepared', correct: true },
      { text: 'Prep used: Calm + Comfort', correct: true },
    ],
  },
  nauseaHistory: {
    id: 'nauseaHistory',
    name: 'Nausea History',
    revealedBy: 'review_chart',
    description: 'Chart shows bad nausea after past sedation. Add NauseaGuard to the SedaPrep batch.',
    planAdd: { label: 'Nausea Protection', items: ['nauseaGuard'] },
    addTasks: [],
    patchTasks: [{ id: 'load_sedaprep', addRequiredItems: ['nauseaGuard'] }],
    handoffFacts: [{ text: 'Nausea protection added (history of nausea)', correct: true }],
  },
};
