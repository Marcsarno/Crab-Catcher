import type { StationDef } from '../core/types';

// Station archetypes. Where they sit is decided per environment.
export const STATIONS: Record<string, StationDef> = {
  chart: { id: 'chart', kind: 'chart', name: 'Chart Desk', icon: 'chart', w: 2.4, d: 1.3, blurb: 'Review the case' },
  sedaprep: { id: 'sedaprep', kind: 'sedaprep', name: 'SedaPrep', icon: 'syringe', w: 1.9, d: 1.2, machine: true, blurb: 'Prepares cartridges' },
  scopeair: { id: 'scopeair', kind: 'scopeair', name: 'ScopeAir', icon: 'lungs', w: 1.6, d: 1.2, machine: true, blurb: 'Stages breathing kit' },
  supplies: { id: 'supplies', kind: 'supplies', name: 'Supplies', icon: 'cart', w: 1.9, d: 1.1, blurb: 'Open drawers' },
  workstation: { id: 'workstation', kind: 'workstation', name: 'Anesthesia Workstation', icon: 'gear', w: 1.7, d: 1.2, machine: true, blurb: 'Machine check' },
  bay1: { id: 'bay1', kind: 'bay', name: 'Patient Bay', icon: 'bed', w: 1.5, d: 2.9, blurb: 'Patient' },
  bay2: { id: 'bay2', kind: 'preop', name: 'Pre-op Bay', icon: 'bed', w: 1.5, d: 2.9, blurb: 'Next patient' },
  handoff: { id: 'handoff', kind: 'handoff', name: 'Handoff · PACU', icon: 'handoff', w: 2.4, d: 1.0, blurb: 'Recovery handoff' },
  airready: { id: 'airready', kind: 'airready', name: 'AirReady', icon: 'airway', w: 1.6, d: 1.1, machine: true, blurb: 'Builds airway kits' },
};
