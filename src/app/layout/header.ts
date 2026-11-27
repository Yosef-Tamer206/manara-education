import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { shortName } from '../core/format';
import { ScrollService } from '../core/scroll.service';
import { SessionService } from '../core/session.service';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.html',
})
export class Header {
  protected session = inject(SessionService);
  protected auth = inject(AuthService);
  protected theme = inject(ThemeService);
  private scroller = inject(ScrollService);
  protected shortName = shortName;
  protected progress = signal('0%');

  @HostListener('window:scroll')
  protected onScroll() {
    const h = document.documentElement;
    this.progress.set((h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100 + '%');
  }

  protected goSection(id: string) {
    this.scroller.goSection(id);
  }

  protected homeClick(e: Event) {
    const h = location.hash;
    if (!h || h === '#/' || h === '#') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
