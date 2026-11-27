import { Component, ElementRef, OnDestroy, effect, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { GRADE_GRADIENT } from '../core/constants';
import { CatalogCourse } from '../core/models';
import { SessionService } from '../core/session.service';
import { SubscriptionService } from '../subscription/subscription.service';

/** Horizontal, snap-scrolling list of published courses with arrows, dots and auto-advance. */
@Component({
  selector: 'app-course-carousel',
  imports: [RouterLink],
  templateUrl: './course-carousel.html',
})
export class CourseCarousel implements OnDestroy {
  protected session = inject(SessionService);
  protected auth = inject(AuthService);
  private subs = inject(SubscriptionService);
  readonly courses = input.required<CatalogCourse[]>();

  protected track = viewChild.required<ElementRef<HTMLElement>>('track');
  protected active = signal(0);
  protected showArrows = signal(true);

  protected gradient = (g: string) => GRADE_GRADIENT[g] || GRADE_GRADIENT['اولي ثانوي'];
  protected price = () => (this.subs.paymentsOpen() ? this.subs.priceMonth() : '');
  protected more = (c: CatalogCourse) => (c.lessons?.length || 0) - 4;

  private timer: ReturnType<typeof setInterval> | undefined;
  private hovering = false;
  private visible = true;
  private reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
  private cleanups: (() => void)[] = [];

  constructor() {
    effect(() => {
      this.courses();
      // Wait for the cards to be in the DOM before measuring them.
      queueMicrotask(() => this.setup());
    });
  }

  ngOnDestroy() {
    this.teardown();
  }

  private teardown() {
    clearInterval(this.timer);
    this.cleanups.forEach((f) => f());
    this.cleanups = [];
  }

  private get trk() {
    return this.track().nativeElement;
  }
  private get cards() {
    return [...this.trk.children] as HTMLElement[];
  }
  private rtl = () => getComputedStyle(this.trk).direction === 'rtl';
  private edge(c: HTMLElement) {
    const a = c.getBoundingClientRect();
    const b = this.trk.getBoundingClientRect();
    const pad = this.rtl() ? -8 : 8;
    return (this.rtl() ? a.right - b.right : a.left - b.left) - pad;
  }
  private current() {
    let k = 0;
    let best = 1e9;
    this.cards.forEach((c, i) => {
      const d = Math.abs(this.edge(c));
      if (d < best) {
        best = d;
        k = i;
      }
    });
    return k;
  }
  private atEnd = () => Math.abs(this.trk.scrollLeft) + this.trk.clientWidth >= this.trk.scrollWidth - 3;
  private atStart = () => Math.abs(this.trk.scrollLeft) < 3;
  private fits = () => this.trk.scrollWidth <= this.trk.clientWidth + 4;
  private behavior = (): ScrollBehavior => (this.reduced ? 'auto' : 'smooth');

  go(i: number) {
    const cs = this.cards;
    i = Math.max(0, Math.min(cs.length - 1, i));
    this.trk.scrollBy({ left: this.edge(cs[i]), behavior: this.behavior() });
  }
  next() {
    this.atEnd() ? this.trk.scrollTo({ left: 0, behavior: this.behavior() }) : this.go(this.current() + 1);
  }
  prev() {
    this.atStart()
      ? this.trk.scrollTo({ left: this.rtl() ? -this.trk.scrollWidth : this.trk.scrollWidth, behavior: this.behavior() })
      : this.go(this.current() - 1);
  }
  protected arrow(dir: 'prev' | 'next') {
    dir === 'prev' ? this.prev() : this.next();
    this.hovering = true;
    setTimeout(() => (this.hovering = false), 9000);
  }

  private updateActive() {
    this.active.set(this.atEnd() ? this.cards.length - 1 : this.current());
  }

  private setup() {
    this.teardown();
    const trk = this.trk;
    const host = trk.parentElement as HTMLElement;
    const check = () => this.showArrows.set(!this.fits());
    check();
    this.active.set(0);

    let raf = 0;
    const listen = (t: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn, opts);
      this.cleanups.push(() => t.removeEventListener(type, fn, opts));
    };
    listen(window, 'resize', check);
    listen(trk, 'scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this.updateActive());
    }, { passive: true });
    listen(host, 'mouseenter', () => (this.hovering = true));
    listen(host, 'mouseleave', () => (this.hovering = false));
    listen(host, 'focusin', (e) => {
      if ((e.target as HTMLElement).matches(':focus-visible')) this.hovering = true;
    });
    listen(host, 'focusout', () => (this.hovering = false));

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => (this.visible = es[0].isIntersecting), { threshold: 0.35 });
      io.observe(host);
      this.cleanups.push(() => io.disconnect());
    }
    if (!this.reduced) {
      this.timer = setInterval(() => {
        if (!this.hovering && this.visible && !document.hidden && !this.fits()) this.next();
      }, 4000);
    }
  }
}
