import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class ScrollService {
  private router = inject(Router);

  /** Smooth-scroll to a section of the home page, going home first if needed. */
  goSection(id: string) {
    const go = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (this.router.url.split('?')[0] !== '/') {
      this.router.navigateByUrl('/');
      setTimeout(go, 250);
    } else {
      go();
    }
  }
}
