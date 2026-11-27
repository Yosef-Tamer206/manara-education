import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal(document.documentElement.dataset['theme'] === 'dark');

  toggle() {
    const dark = !this.dark();
    this.dark.set(dark);
    document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('thm', dark ? 'dark' : 'light');
    } catch {}
  }
}
