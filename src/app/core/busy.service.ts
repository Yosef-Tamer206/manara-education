import { Injectable, signal } from '@angular/core';

/** Tracks running actions: shows a spinner badge and ignores double clicks per key. */
@Injectable({ providedIn: 'root' })
export class BusyService {
  readonly visible = signal(false);
  private count = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = new Set<string>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
    if (this.running.has(key)) return undefined;
    this.running.add(key);
    this.change(1);
    try {
      return await fn();
    } finally {
      this.running.delete(key);
      this.change(-1);
    }
  }

  isRunning(key: string) {
    return this.running.has(key);
  }

  private change(d: number) {
    this.count = Math.max(0, this.count + d);
    clearTimeout(this.timer);
    if (this.count > 0) this.timer = setTimeout(() => this.visible.set(true), 250);
    else this.visible.set(false);
  }
}
