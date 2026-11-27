import { Injectable, signal } from '@angular/core';

export type AuthMode = 'in' | 'up' | 'sent' | 'reset';

/** Open/closed state of the login modal; the modal component renders it. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly open = signal(false);
  readonly mode = signal<AuthMode>('in');

  openAuth(mode: AuthMode = 'in') {
    this.mode.set(mode);
    this.open.set(true);
  }

  close() {
    this.open.set(false);
  }
}
