import type { Recipe } from '../core/types';

// Prep machine recipes (fictional). Task definitions reference these for timings.
export const RECIPES: Record<string, Recipe> = {
  sedaStandard: { stationKind: 'sedaprep', name: 'Standard SedaSet', inputs: ['calmBlue', 'comfortGold'], output: 'sedaSet', time: 16 },
  sedaNausea: { stationKind: 'sedaprep', name: 'SedaSet + Nausea', inputs: ['calmBlue', 'comfortGold', 'nauseaGuard'], output: 'sedaSet', time: 18 },
  scopeAir: { stationKind: 'scopeair', name: 'ScopeAir Set', inputs: ['scopeAirKit'], output: 'scopeAirSet', time: 12 },
  standardAirway: { stationKind: 'airready', name: 'Airway Set', inputs: ['airwayKit'], output: 'airwaySet', time: 12 },
  orMonitoring: { stationKind: 'vitadock', name: 'OR Monitor Set', inputs: ['monitorPack', 'pressurePack'], output: 'orMonitorSet', time: 10 },
  recover: { stationKind: 'sedaprep', name: 'RecoverSet', inputs: ['recoverGreen'], output: 'recoverSet', time: 14 },
  specialAirway: { stationKind: 'airready', name: 'Special Airway Kit', inputs: ['airwayKit', 'specialAirwayParts'], output: 'specialAirwayKit', time: 14 },
};
