import type { ItemId } from './types';

/** Yolanda's Prep Tray: a small fixed number of hand-item slots. */
export class Inventory {
  slots: (ItemId | null)[];

  constructor(public capacity = 4) {
    this.slots = new Array(capacity).fill(null);
  }

  get free(): number {
    return this.slots.filter((s) => s === null).length;
  }

  get items(): ItemId[] {
    return this.slots.filter((s): s is ItemId => s !== null);
  }

  add(id: ItemId): boolean {
    const i = this.slots.indexOf(null);
    if (i < 0) return false;
    this.slots[i] = id;
    return true;
  }

  count(id: ItemId): number {
    return this.slots.filter((s) => s === id).length;
  }

  /** True when every id (as a multiset) is present. */
  hasAll(ids: ItemId[]): boolean {
    const need = new Map<ItemId, number>();
    for (const id of ids) need.set(id, (need.get(id) ?? 0) + 1);
    for (const [id, n] of need) if (this.count(id) < n) return false;
    return true;
  }

  missing(ids: ItemId[]): ItemId[] {
    const have = [...this.items];
    const out: ItemId[] = [];
    for (const id of ids) {
      const i = have.indexOf(id);
      if (i >= 0) have.splice(i, 1);
      else out.push(id);
    }
    return out;
  }

  remove(id: ItemId): boolean {
    const i = this.slots.indexOf(id);
    if (i < 0) return false;
    this.slots[i] = null;
    return true;
  }

  removeAt(i: number): ItemId | null {
    const id = this.slots[i];
    this.slots[i] = null;
    return id;
  }

  removeAll(ids: ItemId[]): void {
    for (const id of ids) this.remove(id);
  }

  clear(): void {
    this.slots.fill(null);
  }
}
