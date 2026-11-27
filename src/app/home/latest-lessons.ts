import { Component, OnDestroy, effect, input, signal } from '@angular/core';

export interface LatestLesson {
  course: string;
  title: string;
  grade: string;
}

/** Auto-rotating card showing the most recently added lessons. */
@Component({
  selector: 'app-latest-lessons',
  templateUrl: './latest-lessons.html',
})
export class LatestLessons implements OnDestroy {
  readonly lessons = input.required<LatestLesson[]>();
  protected index = signal(0);
  private hovering = false;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    effect(() => {
      const n = this.lessons().length;
      this.index.set(0);
      clearInterval(this.timer);
      if (n > 1 && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
        this.timer = setInterval(() => {
          if (!this.hovering) this.show(this.index() + 1);
        }, 4500);
      }
    });
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  protected show(n: number) {
    const len = this.lessons().length;
    this.index.set(((n % len) + len) % len);
  }

  protected setHover(v: boolean) {
    this.hovering = v;
  }

  protected onFocusIn(e: Event) {
    if ((e.target as HTMLElement).matches(':focus-visible')) this.hovering = true;
  }
}
