// localStorage persistence: unlocked levels, best scores, settings, tutorial flag.

export interface SaveData {
  version: 1;
  unlocked: string[];
  best: Record<string, { total: number; stars: Record<string, number> }>;
  settings: { sound: boolean; music: boolean; hints: boolean };
  tutorialDone: boolean;
}

const KEY = 'yolanda.anesthesia-shift.save.v1';

const fresh = (): SaveData => ({
  version: 1,
  unlocked: ['L1'],
  best: {},
  settings: { sound: true, music: true, hints: true },
  tutorialDone: false,
});

export class Save {
  data: SaveData;

  constructor() {
    this.data = fresh();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SaveData;
        if (parsed.version === 1) this.data = { ...fresh(), ...parsed, settings: { ...fresh().settings, ...parsed.settings } };
      }
    } catch {
      /* storage unavailable: play without persistence */
    }
  }

  write(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
  }

  recordResult(levelId: string, total: number, stars: Record<string, number>, nextId?: string): void {
    const prev = this.data.best[levelId];
    if (!prev || total > prev.total) this.data.best[levelId] = { total, stars };
    if (nextId && !this.data.unlocked.includes(nextId)) this.data.unlocked.push(nextId);
    if (levelId === 'L1') this.data.tutorialDone = true;
    this.write();
  }

  reset(): void {
    const settings = this.data.settings;
    this.data = fresh();
    this.data.settings = settings;
    this.write();
  }
}
