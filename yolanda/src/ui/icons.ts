import type { ItemDef } from '../core/types';

// Inline SVG icons (no external assets). Simple, bold, readable at small sizes.

const S = (body: string, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICON: Record<string, string> = {
  chart: S('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 10h7M8.5 14h7M8.5 18h4"/>'),
  syringe: S('<path d="M18 3l3 3M16 5l3 3M17.5 6.5L8 16l-3 1 1-3 9.5-9.5M10 10l2 2M12.5 7.5l2 2M5 19l-2 2"/>'),
  lungs: S('<path d="M12 4v8M12 10c-2 0-3 1-3 1M12 10c2 0 3 1 3 1M8.5 7C6 7 4 12 4 16c0 2 1.5 3 3 3s2.5-1 2.5-3v-6M15.5 7c2.5 0 4.5 5 4.5 9 0 2-1.5 3-3 3s-2.5-1-2.5-3v-6"/>'),
  cart: S('<path d="M3 4h2l2.5 11h11L21 7H7"/><circle cx="9" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>'),
  gear: S('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  bed: S('<path d="M3 7v12M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="12" r="2"/>'),
  handoff: S('<path d="M4 12h9M10 8l4 4-4 4"/><path d="M16 5h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3"/>'),
  airway: S('<path d="M7 20V12a5 5 0 0 1 10 0v2"/><path d="M17 14v6M5 20h4M15 20h4"/>'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  clock: S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  menu: S('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  pause: S('<path d="M9 5v14M15 5v14"/>'),
  x: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5-4.9-4.5 6.6-.8z"/></svg>',
  lock: S('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  person: S('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
  phone: S('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  heart: S('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'),
  alert: S('<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>'),
  sound: S('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'),
  team: S('<circle cx="8" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M2.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5M14 15.5c3 0 6 1.5 6 4.5"/>'),
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
};

/** Tray / drawer item icon, colored by item. */
export function itemIcon(it: ItemDef): string {
  const c = it.color;
  if (it.kind === 'cartridge') {
    return `<svg viewBox="0 0 40 40"><rect x="13" y="4" width="14" height="32" rx="6" fill="${c}"/><rect x="13" y="4" width="14" height="10" rx="5" fill="#fff" opacity=".55"/><rect x="16" y="20" width="8" height="2.6" rx="1.3" fill="#fff" opacity=".8"/></svg>`;
  }
  if (it.kind === 'pack') {
    return `<svg viewBox="0 0 40 40"><rect x="6" y="9" width="28" height="24" rx="5" fill="${c}"/><path d="M10 22h5l2.5-5 3.5 9 2.5-4H30" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (it.kind === 'output') {
    return `<svg viewBox="0 0 40 40"><rect x="5" y="8" width="30" height="25" rx="6" fill="${c}"/><rect x="5" y="8" width="30" height="8" rx="4" fill="#fff" opacity=".35"/><path d="M13 22.5l4.5 4.5 9-9" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  return `<svg viewBox="0 0 40 40"><rect x="6" y="11" width="28" height="21" rx="4" fill="${c}"/><rect x="14" y="7" width="12" height="6" rx="2" fill="${c}" opacity=".75"/><path d="M20 16v12M14 22h12" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;
}
