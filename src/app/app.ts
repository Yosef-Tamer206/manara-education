import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthModal } from './auth/auth-modal';
import { BusyBadge } from './layout/busy-badge';
import { Footer } from './layout/footer';
import { Header } from './layout/header';
import { Toast } from './layout/toast';
import { RevealDirective } from './shared/reveal.directive';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, AuthModal, Toast, BusyBadge, RevealDirective],
  template: `
    <app-header />
    <main id="app" appReveal><router-outlet /></main>
    <app-footer />
    <app-auth-modal />
    <app-toast />
    <app-busy-badge />
  `,
})
export class App {}
