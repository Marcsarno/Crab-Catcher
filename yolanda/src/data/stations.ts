import type { StationDef } from '../core/types';

// Station archetypes. Where they sit is decided per environment. w/d = footprint (world units).
export const STATIONS: Record<string, StationDef> = {
  chart: { id: 'chart', kind: 'chart', name: 'Chart Desk', icon: 'chart', w: 2.6, d: 1.3, blurb: 'Review the case' },
  sedaprep: { id: 'sedaprep', kind: 'sedaprep', name: 'SedaPrep', icon: 'syringe', w: 2.1, d: 1.3, machine: true, blurb: 'Prepares cartridges' },
  scopeair: { id: 'scopeair', kind: 'scopeair', name: 'ScopeAir', icon: 'lungs', w: 2.0, d: 1.3, machine: true, blurb: 'Stages breathing kit' },
  supplies: { id: 'supplies', kind: 'supplies', name: 'Supplies', icon: 'cart', w: 2.0, d: 1.1, blurb: 'Open drawers' },
  workstation: { id: 'workstation', kind: 'workstation', name: 'Anesthesia Workstation', icon: 'gear', w: 2.2, d: 1.3, machine: true, blurb: 'Machine check' },
  bay1: { id: 'bay1', kind: 'bay', name: 'Patient Bay', icon: 'bed', w: 1.4, d: 2.8, blurb: 'Patient' },
  bay2: { id: 'bay2', kind: 'preop', name: 'Pre-op Bay', icon: 'bed', w: 1.4, d: 2.8, blurb: 'Next patient' },
  handoff: { id: 'handoff', kind: 'handoff', name: 'PACU Handoff', icon: 'handoff', w: 2.4, d: 1.0, blurb: 'Recovery handoff' },
  ortable: { id: 'ortable', kind: 'ortable', name: 'OR Table', icon: 'bed', w: 1.5, d: 3.0, blurb: 'Patient' },
  thermanest: { id: 'thermanest', kind: 'thermanest', name: 'ThermaNest', icon: 'heart', w: 1.6, d: 1.1, machine: true, blurb: 'Warms blankets' },
  vitadock: { id: 'vitadock', kind: 'vitadock', name: 'VitaDock', icon: 'gear', w: 1.7, d: 1.1, machine: true, blurb: 'Builds monitor sets' },
  orchart: { id: 'orchart', kind: 'orchart', name: 'Charting Cart', icon: 'chart', w: 1.5, d: 1.1, blurb: 'Document' },
  airready: { id: 'airready', kind: 'airready', name: 'AirReady', icon: 'airway', w: 1.8, d: 1.2, machine: true, blurb: 'Builds airway kits' },
};
