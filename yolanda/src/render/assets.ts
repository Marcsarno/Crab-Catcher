import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mat } from './palette';

// External CC0 models (see ASSET_MANIFEST.md). Everything is re-materialed onto
// the shared palette at load time so imported pieces match the procedural ones.

// Model files are bundled by Vite (hashed files in normal builds, inlined data URIs
// in the single-file build) so the game works wherever the page is hosted.
// The single-file share build ships models beside the page as embedded-glTF .json files
// (scripts/export-models-json.py), because some hosts only serve web file types.
const SHARE = import.meta.env.MODE === 'single';
const URLS = import.meta.glob('../models/**/*.{glb,gltf}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const urlFor = (file: string) => (SHARE ? `assets/${file.replace(/\.(glb|gltf)$/, '.json')}` : URLS[`../models/${file}`]);

export const MODEL_FILES = {
  // Kenney Furniture Kit (CC0)
  desk: 'kenney-furniture-kit/desk.glb',
  chairDesk: 'kenney-furniture-kit/chairdesk.glb',
  computerScreen: 'kenney-furniture-kit/computerscreen.glb',
  keyboard: 'kenney-furniture-kit/computerkeyboard.glb',
  laptop: 'kenney-furniture-kit/laptop.glb',
  trashcan: 'kenney-furniture-kit/trashcan.glb',
  lampFloor: 'kenney-furniture-kit/lampsquarefloor.glb',
  sink: 'kenney-furniture-kit/bathroomsinksquare.glb',
  cabinetDrawer: 'kenney-furniture-kit/kitchencabinetdrawer.glb',
  bookcase: 'kenney-furniture-kit/bookcaseclosedwide.glb',
  sideTable: 'kenney-furniture-kit/sidetabledrawers.glb',
  stool: 'kenney-furniture-kit/stoolbar.glb',
  coatRack: 'kenney-furniture-kit/coatrackstanding.glb',
  box: 'kenney-furniture-kit/cardboardboxclosed.glb',
  books: 'kenney-furniture-kit/books.glb',
  radio: 'kenney-furniture-kit/radio.glb',
  bench: 'kenney-furniture-kit/benchcushion.glb',
  rug: 'kenney-furniture-kit/rugrounded.glb',
  // Quaternius Sushi Restaurant Kit (CC0) — potted plants
  plantBall: 'quaternius-sushi/Decoration/glTF/Decoration_Plant1.gltf',
  plantTopiary: 'quaternius-sushi/Decoration/glTF/Decoration_Plant2.gltf',
} as const;

export type ModelName = keyof typeof MODEL_FILES;

const cache = new Map<ModelName, GLTF>();
let loadedOk = false;

export function assetsReady(): boolean {
  return loadedOk;
}

/** Load every model up front (small files; ~3.5 MB total). Resolves even if some fail. */
export async function preloadAssets(onProgress?: (done: number, total: number) => void): Promise<number> {
  const loader = new GLTFLoader();
  const names = Object.keys(MODEL_FILES) as ModelName[];
  let done = 0, failed = 0;
  await Promise.all(names.map(async (n) => {
    try {
      const url = urlFor(MODEL_FILES[n]);
      if (!url) throw new Error(`missing bundled file ${MODEL_FILES[n]}`);
      const gltf = await loader.loadAsync(url);
      cache.set(n, gltf);
    } catch (e) {
      failed++;
      console.warn('asset failed', n, e);
    }
    onProgress?.(++done, names.length);
  }));
  loadedOk = cache.size > 0;
  return failed;
}

export function hasModel(n: ModelName): boolean {
  return cache.has(n);
}

export function gltfOf(n: ModelName): GLTF | undefined {
  return cache.get(n);
}

/** Furniture name → palette color, so props match the room. */
const FURNITURE_MATS: Record<string, string> = {
  wood: '#ffffff', woodDark: '#d6dde6', metal: '#c9d3de', metalDark: '#5d6874', plant: '#5fae5a',
  carpet: '#9fc1ec', carpetDarker: '#7fa9e3', glass: '#cfeaff', paper: '#f7f7f2', cloth: '#5a8ade', clothDark: '#3b68c2',
};

/** A static prop clone, re-materialed to the shared palette and scaled to `height` world units. */
export function prop(n: ModelName, height: number, palette: Record<string, string> = {}): THREE.Group {
  const g = new THREE.Group();
  const src = cache.get(n);
  if (!src) return g;
  const obj = src.scene.clone(true);
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const name = (Array.isArray(m.material) ? m.material[0] : m.material).name;
    const color = palette[name] ?? FURNITURE_MATS[name];
    const orig = m.material as THREE.MeshStandardMaterial;
    if (color) m.material = mat(color, { rough: 0.55 });
    else if (orig && 'roughness' in orig) { orig.roughness = Math.max(0.45, orig.roughness); orig.metalness = 0; }
  });
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = height / Math.max(1e-3, size.y);
  obj.scale.setScalar(s);
  obj.position.y = -box.min.y * s;
  g.add(obj);
  return g;
}

// ---------------------------------------------------------------- characters

export interface Outfit {
  /** Main clothing color (scrubs/gown). */
  top: string;
  /** Pants color (defaults to a darker shade of top). */
  pants?: string;
  shoes?: string;
}

const textureCache = new Map<string, THREE.Texture>();

function hsl(r: number, g: number, b: number) {
  const c = new THREE.Color(r / 255, g / 255, b / 255);
  const o = { h: 0, s: 0, l: 0 };
  c.getHSL(o);
  return o;
}

/**
 * Recolor a character's body texture (not its head) so clothes become the outfit
 * colors while skin keeps its tone. Kenney atlases use flat color cells, so a
 * per-pixel hue test is reliable.
 */
function outfitTexture(src: THREE.Texture, outfit: Outfit): THREE.Texture {
  const key = `${src.uuid}|${outfit.top}|${outfit.pants}|${outfit.shoes}`;
  const hit = textureCache.get(key);
  if (hit) return hit;
  const img = src.image as HTMLImageElement | ImageBitmap;
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(img as CanvasImageSource, 0, 0);
  const data = ctx.getImageData(0, 0, cv.width, cv.height);
  const top = new THREE.Color(outfit.top);
  const pants = new THREE.Color(outfit.pants ?? new THREE.Color(outfit.top).multiplyScalar(0.82).getStyle());
  const shoes = new THREE.Color(outfit.shoes ?? '#f2f4f7');
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    const { h, s, l } = hsl(p[i], p[i + 1], p[i + 2]);
    const hue = h * 360;
    const isSkin = hue >= 12 && hue <= 36 && s > 0.25 && s < 0.8 && l > 0.35 && l < 0.85;
    if (isSkin) continue;
    let target: THREE.Color;
    if (l > 0.9 && s < 0.15) target = shoes; // near-white trims (shoes, cuffs)
    else if (hue >= 200 && hue <= 290 && s > 0.25) target = pants; // blues/purples → pants
    else target = top; // shirts, darks, accents → scrubs
    // keep the cell's shading by scaling with its lightness
    const shade = 0.75 + Math.min(0.5, l) * 0.5;
    p[i] = Math.min(255, target.r * 255 * shade);
    p[i + 1] = Math.min(255, target.g * 255 * shade);
    p[i + 2] = Math.min(255, target.b * 255 * shade);
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = src.flipY;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  textureCache.set(key, tex);
  return tex;
}

export interface CharacterModel {
  object: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationClip>;
  height: number;
}

/** A skinned, animated character clone with an outfit applied, scaled to `height`. */
export function character(n: ModelName, outfit: Outfit | null, height: number): CharacterModel | null {
  const src = cache.get(n);
  if (!src) return null;
  const obj = cloneSkinned(src.scene);
  // keep only skinned body meshes (drops props such as the weapons in the Quaternius rigs)
  const strip: THREE.Object3D[] = [];
  obj.traverse((o) => { if ((o as THREE.Mesh).isMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh) strip.push(o); });
  for (const o of strip) o.parent?.remove(o);
  obj.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.frustumCulled = false;
    const orig = m.material as THREE.MeshStandardMaterial;
    const nm = orig.clone();
    nm.roughness = 0.6;
    nm.metalness = 0;
    if (outfit && /body/i.test(m.name) && orig.map) nm.map = outfitTexture(orig.map, outfit);
    m.material = nm;
  });
  const box = new THREE.Box3().setFromObject(obj);
  const s = height / Math.max(1e-3, box.max.y - box.min.y);
  obj.scale.setScalar(s);
  const clips = new Map(src.animations.map((a) => [a.name, a]));
  return { object: obj, mixer: new THREE.AnimationMixer(obj), clips, height };
}
