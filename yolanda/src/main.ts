import * as THREE from 'three';
import './ui/style.css';
import { World } from './render/World';
import { CameraRig } from './render/CameraRig';
import { AudioSys } from './audio/Audio';
import { Save } from './core/Save';
import { Game } from './core/Game';
import { Hud } from './ui/Hud';
import { Screens } from './ui/Screens';
import { DebugPanel } from './ui/Debug';
import { LEVELS } from './data/levels';
import type { LevelDef } from './core/types';

class App {
  readonly app = document.getElementById('app')!;
  readonly renderer: THREE.WebGLRenderer;
  readonly world = new World();
  readonly cam = new CameraRig();
  readonly audio = new AudioSys();
  readonly save = new Save();
  readonly hud: Hud;
  readonly screens: Screens;
  readonly debug: DebugPanel;
  game: Game | null = null;
  level: LevelDef = LEVELS[0];
  private recorded = false;
  private last = performance.now();
  private w = 1;
  private h = 1;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.app.append(this.renderer.domElement);
    this.world.initEnvironment(this.renderer);

    this.hud = new Hud(this.app, {
      pause: () => this.pause(),
      restart: () => this.restart(),
      menu: () => this.title(),
      next: () => this.next(),
      hasNext: () => this.nextLevel() !== null,
      tapStation: (id) => this.game?.tapStation(id),
      longPressStation: (id) => this.game?.tapStation(id, true),
    });
    const scr = document.createElement('div');
    scr.className = 'layer';
    scr.style.zIndex = '20';
    this.app.append(scr);
    this.screens = new Screens(scr);
    this.debug = new DebugPanel(this.app, {
      game: () => this.game,
      levels: LEVELS,
      load: (l) => { this.debug.close(); this.start(l, true); },
      restart: () => this.restart(),
    });

    this.applySettings();
    this.bindInput();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.title();
    requestAnimationFrame((t) => this.frame(t));
    (window as unknown as { __yolanda: App }).__yolanda = this;
  }

  applySettings(): void {
    const s = this.save.data.settings;
    this.audio.setSound(s.sound);
    this.audio.setMusic(s.music);
    if (this.game) this.game.tutorialOn = s.hints;
  }

  private resize(): void {
    const r = this.app.getBoundingClientRect();
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.renderer.setSize(this.w, this.h, false);
    this.cam.resize(this.w, this.h);
  }

  // ------------------------------------------------------------------ flow

  private makeGame(l: LevelDef): Game {
    this.world.dispose();
    this.level = l;
    this.recorded = false;
    const g = new Game(l, this.world, this.cam, this.audio, this.hud, this.save.data.settings.hints);
    this.cam.resize(this.w, this.h);
    this.game = g;
    this.hud.attach(g);
    return g;
  }

  title(): void {
    this.hud.el.classList.add('hidden');
    const g = this.makeGame(this.level ?? LEVELS[0]);
    g.mode = 'card';
    this.cam.setMode('room', true);
    this.screens.title(LEVELS, this.save, (l) => this.start(l), () => this.screens.settings(this.save, () => this.applySettings(), () => this.title()));
  }

  start(l: LevelDef, skipCard = false): void {
    this.audio.unlock();
    const g = this.makeGame(l);
    g.mode = 'card';
    this.cam.setMode('room', true);
    this.hud.el.classList.add('hidden');
    const go = () => {
      this.screens.clear();
      this.hud.el.classList.remove('hidden');
      g.begin();
    };
    if (skipCard) go();
    else this.screens.caseCard(l, go, () => this.title());
  }

  restart(): void {
    this.start(this.level, true);
  }

  private nextLevel(): LevelDef | null {
    const i = LEVELS.indexOf(this.level);
    return LEVELS[i + 1] ?? null;
  }

  next(): void {
    const n = this.nextLevel();
    if (n) this.start(n);
    else this.title();
  }

  pause(): void {
    const g = this.game;
    if (!g) return;
    g.pause();
    this.screens.pause({
      resume: () => g.resume(),
      restart: () => this.restart(),
      menu: () => this.title(),
      save: this.save,
      apply: () => this.applySettings(),
    });
  }

  // ------------------------------------------------------------------ input

  private bindInput(): void {
    const el = this.renderer.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let downAt = 0, downX = 0, downY = 0, longTimer: number | null = null, moved = false, pinchD = 0, longFired = false;
    const ndc = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    };
    el.addEventListener('pointerdown', (e) => {
      this.audio.unlock();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchD = Math.hypot(a.x - b.x, a.y - b.y);
        if (longTimer) clearTimeout(longTimer);
        return;
      }
      downAt = performance.now(); downX = e.clientX; downY = e.clientY; moved = false; longFired = false;
      longTimer = window.setTimeout(() => {
        const g = this.game;
        if (!g || moved) return;
        const hit = this.world.pick(ndc(downX, downY), this.cam.camera);
        if (hit?.station) { longFired = true; g.tapStation(hit.station, true); }
      }, 450);
    });
    el.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 12) moved = true;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchD > 0) this.cam.zoom = Math.max(0.72, Math.min(1.12, this.cam.zoom * (pinchD / d)));
        pinchD = d;
      }
    });
    const up = (e: PointerEvent) => {
      const wasPinch = pointers.size > 1;
      pointers.delete(e.pointerId);
      if (longTimer) clearTimeout(longTimer);
      if (wasPinch || moved || longFired) return;
      if (performance.now() - downAt > 700) return;
      const g = this.game;
      if (!g || g.mode !== 'room') return;
      const hit = this.world.pick(ndc(e.clientX, e.clientY), this.cam.camera);
      if (hit?.station) g.tapStation(hit.station);
      else if (hit?.floor) g.tapFloor(hit.floor);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); if (longTimer) clearTimeout(longTimer); });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cam.zoom = Math.max(0.72, Math.min(1.12, this.cam.zoom * (e.deltaY > 0 ? 1.06 : 0.94)));
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === '~') this.debug.toggle();
      if (e.key === 'Escape' && this.game?.mode === 'room') this.pause();
    });
    // 5 quick taps on the clock open the developer panel (phones have no backtick)
    let taps: number[] = [];
    this.app.addEventListener('pointerdown', (e) => {
      if (!(e.target as HTMLElement).closest('[data-role=clock]')) return;
      const now = performance.now();
      taps = [...taps.filter((t) => now - t < 1500), now];
      if (taps.length >= 5) { taps = []; this.debug.toggle(); }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.game?.mode === 'room') this.pause();
    });
  }

  // ------------------------------------------------------------------ loop

  private frame(t: number): void {
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    const g = this.game;
    if (g) {
      g.update(dt);
      if (g.mode === 'results' && g.result && !this.recorded) {
        this.recorded = true;
        const nx = this.nextLevel();
        this.save.recordResult(this.level.id, g.result.total, g.result.stars, nx?.id);
      }
      this.hud.update(this.cam.camera, this.w, this.h);
    }
    this.renderer.render(this.world.scene, this.cam.camera);
    requestAnimationFrame((tt) => this.frame(tt));
  }
}

new App();
