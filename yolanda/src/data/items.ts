import type { DrawerDef, ItemDef } from '../core/types';

// Fictional preparation items. These are GAME OBJECTS, not medication instructions.

export const DRAWERS: DrawerDef[] = [
  { id: 'cartridges', name: 'Prep Cartridges', color: '#5b8fd6' },
  { id: 'monitoring', name: 'Monitoring', color: '#2ba8a0' },
  { id: 'airway', name: 'Airway & ScopeAir', color: '#f2b33d' },
];

export const ITEMS: Record<string, ItemDef> = {
  calmBlue: {
    id: 'calmBlue', name: 'CalmBlue', short: 'Calm', kind: 'cartridge', color: '#4f86d9',
    drawer: 'cartridges', category: 'Calm', blurb: 'Fictional "Calm" prep cartridge. Load into SedaPrep.',
  },
  comfortGold: {
    id: 'comfortGold', name: 'ComfortGold', short: 'Comfort', kind: 'cartridge', color: '#efb43a',
    drawer: 'cartridges', category: 'Comfort', blurb: 'Fictional "Comfort" prep cartridge. Load into SedaPrep.',
  },
  nauseaGuard: {
    id: 'nauseaGuard', name: 'NauseaGuard', short: 'Nausea', kind: 'cartridge', color: '#9a7fd8',
    drawer: 'cartridges', category: 'Nausea Protection', blurb: 'Fictional "Nausea Protection" cartridge.',
  },
  recoverGreen: {
    id: 'recoverGreen', name: 'RecoverGreen', short: 'Recover', kind: 'cartridge', color: '#4cc38a',
    drawer: 'cartridges', category: 'Recovery Support', blurb: 'Fictional "Recovery Support" cartridge.',
  },
  monitorPack: {
    id: 'monitorPack', name: 'Monitor Pack', short: 'Monitor', kind: 'pack', color: '#2ba8a0',
    drawer: 'monitoring', blurb: 'Standard adult monitoring accessories.',
  },
  pedsMonitorPack: {
    id: 'pedsMonitorPack', name: 'Pediatric Monitor Pack', short: 'Peds Mon', kind: 'pack', color: '#f08bb0',
    drawer: 'monitoring', blurb: 'Small-size monitoring accessories for children.',
  },
  pressurePack: {
    id: 'pressurePack', name: 'Pressure Pack', short: 'Pressure', kind: 'pack', color: '#e0705a',
    drawer: 'monitoring', blurb: 'Extra pressure-monitoring accessories for bigger cases.',
  },
  scopeAirKit: {
    id: 'scopeAirKit', name: 'ScopeAir Kit', short: 'ScopeAir', kind: 'kit', color: '#57b6e8',
    drawer: 'airway', blurb: 'Oxygen + breath-sensing parts. Stage it in the ScopeAir unit.',
  },
  airwayKit: {
    id: 'airwayKit', name: 'Standard Airway Kit', short: 'Airway', kind: 'kit', color: '#f2b33d',
    drawer: 'airway', blurb: 'Standard airway backup kit.',
  },
  specialAirwayParts: {
    id: 'specialAirwayParts', name: 'Special Airway Parts', short: 'Spec Parts', kind: 'kit', color: '#ee7a3c',
    drawer: 'airway', blurb: 'Extra airway components. Build into a Special Airway Kit at AirReady.',
  },
  // Machine outputs — never in drawers.
  sedaSet: {
    id: 'sedaSet', name: 'SedaSet (prepared)', short: 'SedaSet', kind: 'output', color: '#3c74c9',
    blurb: 'Prepared fictional sedation set from SedaPrep.',
  },
  scopeAirSet: {
    id: 'scopeAirSet', name: 'ScopeAir Set (staged)', short: 'ScopeSet', kind: 'output', color: '#2f97cf',
    blurb: 'Staged breathing support set from the ScopeAir unit.',
  },
  airwaySet: {
    id: 'airwaySet', name: 'Airway Set (ready)', short: 'AirSet', kind: 'output', color: '#e9a52a',
    blurb: 'Standard airway set staged by AirReady.',
  },
  orMonitorSet: {
    id: 'orMonitorSet', name: 'OR Monitor Set', short: 'MonSet', kind: 'output', color: '#1f9c94',
    blurb: 'Full monitoring set assembled by VitaDock.',
  },
  recoverSet: {
    id: 'recoverSet', name: 'RecoverSet (prepared)', short: 'Recover', kind: 'output', color: '#2fae73',
    blurb: 'Prepared fictional recovery-support set for waking up.',
  },
  specialAirwayKit: {
    id: 'specialAirwayKit', name: 'Special Airway Kit', short: 'Spec Kit', kind: 'output', color: '#d9622a',
    blurb: 'Assembled special airway kit from AirReady.',
  },
};

export function item(id: string): ItemDef {
  const it = ITEMS[id];
  if (!it) throw new Error(`Unknown item ${id}`);
  return it;
}
