import { Component, HostListener, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BusyService } from '../core/busy.service';
import { GRADES } from '../core/constants';
import { SessionService } from '../core/session.service';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { AuthService } from './auth.service';

const ERRORS: Record<string, string> = {
  'Invalid login credentials': 'البريد أو كلمة السر غلط',
  'User already registered': 'الحساب ده موجود، سجّل دخول',
  'Email not confirmed': 'لازم تأكد بريدك الأول من الرسالة اللي وصلتلك',
};

@Component({
  selector: 'app-auth-modal',
  templateUrl: './auth-modal.html',
})
export class AuthModal {
  protected auth = inject(AuthService);
  private sb = inject(SupabaseService).client;
  private session = inject(SessionService);
  private router = inject(Router);
  private busy = inject(BusyService);
  private toast = inject(ToastService);

  protected grades = GRADES;
  protected name = signal('');
  protected grade = signal(GRADES[0]);
  protected email = signal('');
  protected password = signal('');
  protected newPassword = signal('');
  protected error = signal('');
  protected errorOk = signal(false);
  private pressedOnBackdrop = false;

  constructor() {
    this.sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') this.auth.openAuth('reset');
    });
  }

  protected switchTo(mode: 'in' | 'up') {
    this.error.set('');
    this.auth.openAuth(mode);
  }

  protected onBackdropDown(e: Event) {
    this.pressedOnBackdrop = e.target === e.currentTarget;
  }

  protected onBackdropClick(e: Event) {
    if (this.pressedOnBackdrop && e.target === e.currentTarget) this.auth.close();
    this.pressedOnBackdrop = false;
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    this.auth.close();
  }

  private fail(msg: string) {
    this.errorOk.set(false);
    this.error.set(msg);
  }

  protected googleSignIn() {
    return this.busy.run('google', async () => {
      sessionStorage.setItem('sg', '1');
      const { error } = await this.sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname },
      });
      if (error) this.fail(error.message);
    });
  }

  protected submit() {
    return this.busy.run('auth', async () => {
      this.error.set('');
      const mode = this.auth.mode();
      const email = this.email().trim();
      const password = this.password();
      let res;
      if (mode === 'up') {
        const full_name = this.name().trim();
        if (!full_name) return this.fail('اكتب اسمك');
        res = await this.sb.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: location.origin + location.pathname,
            data: { full_name, grade: this.grade() },
          },
        });
      } else {
        res = await this.sb.auth.signInWithPassword({ email, password });
      }
      if (res.error) return this.fail(ERRORS[res.error.message] || res.error.message);
      if (!res.data.session) {
        this.auth.mode.set('sent');
        return;
      }
      this.auth.close();
      await this.session.init();
      await this.router.navigateByUrl(this.session.homeLink());
    });
  }

  protected forgot() {
    return this.busy.run('forgot', async () => {
      const email = this.email().trim();
      if (!email) return this.fail('اكتب بريدك الأول');
      const { error } = await this.sb.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname,
      });
      if (error) {
        this.fail(/rate|limit/i.test(error.message) ? 'اتبعت عدد كبير من الرسائل، جرّب بعد شوية' : error.message);
      } else {
        this.errorOk.set(true);
        this.error.set('لو البريد مسجّل هتوصلك رسالة فيها رابط تغيير كلمة السر.');
      }
    });
  }

  protected setNewPassword() {
    return this.busy.run('setpass', async () => {
      const p = this.newPassword();
      if (p.length < 6) return this.fail('6 حروف على الأقل');
      const { error } = await this.sb.auth.updateUser({ password: p });
      if (error) return this.fail(error.message);
      this.auth.close();
      this.toast.show('اتغيّرت كلمة السر');
      await this.session.init();
    });
  }
}
