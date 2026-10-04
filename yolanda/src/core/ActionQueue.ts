// Tap-queued station visits. Yolanda works through them in order.

export interface QueuedAction {
  uid: number;
  stationId: string;
}

let nextUid = 1;

export class ActionQueue {
  items: QueuedAction[] = [];
  readonly max = 6;

  add(stationId: string): QueuedAction | null {
    if (this.items.length >= this.max) return null;
    const a = { uid: nextUid++, stationId };
    this.items.push(a);
    return a;
  }

  /** Insert as the very next action (higher priority). */
  insertNext(stationId: string): QueuedAction {
    const a = { uid: nextUid++, stationId };
    this.items.unshift(a);
    if (this.items.length > this.max) this.items.pop();
    return a;
  }

  cancel(uid: number): void {
    this.items = this.items.filter((a) => a.uid !== uid);
  }

  shift(): QueuedAction | undefined {
    return this.items.shift();
  }

  peek(): QueuedAction | undefined {
    return this.items[0];
  }

  clear(): void {
    this.items = [];
  }

  get length(): number {
    return this.items.length;
  }
}
