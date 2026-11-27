import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

const SELECTOR =
  '.hero .htxt>*,.hero .stage2,.sh,.gcard,.card,.shero,.tstat>div,.les,details,.chd,.tabs,.abt-pic,.abt-grid>div,.pt,.faq>*';

/** Fades page blocks in as they scroll into view. Put it on the element that holds the routed pages. */
@Directive({ selector: '[appReveal]' })
export class RevealDirective implements OnInit, OnDestroy {
  private root = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private observer: MutationObserver | undefined;
  private io: IntersectionObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  ngOnInit() {
    this.io =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries) =>
              entries.forEach((e) => {
                if (e.isIntersecting) {
                  this.io!.unobserve(e.target);
                  this.show(e.target as HTMLElement);
                }
              }),
            { threshold: 0.05, rootMargin: '0px 0px -5% 0px' },
          )
        : null;
    this.observer = new MutationObserver(() => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.scan(), 30);
    });
    this.observer.observe(this.root, { childList: true, subtree: true });
    this.scan();
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.io?.disconnect();
    clearTimeout(this.timer);
  }

  private show(el: HTMLElement) {
    const d = Math.min(+(el.dataset['fxi'] || 0), 6) * 110;
    el.style.setProperty('--d', d + 'ms');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    setTimeout(() => {
      el.classList.remove('rv', 'in');
      el.style.removeProperty('--d');
    }, 1000 + d);
  }

  private scan() {
    this.root.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
      if (
        el.dataset['fx'] ||
        el.closest('.lcar,.ccar,.modal') ||
        (el.parentElement && el.parentElement.closest('.rv'))
      )
        return;
      el.dataset['fx'] = '1';
      el.dataset['fxi'] = String([...el.parentElement!.children].indexOf(el));
      el.classList.add('rv');
      if (this.io) this.io.observe(el);
      else this.show(el);
    });
  }
}
