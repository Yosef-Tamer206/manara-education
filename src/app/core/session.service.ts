import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Profile } from './models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private sb = inject(SupabaseService).client;
  private router = inject(Router);

  readonly userId = signal<string | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly isTeacher = computed(() => this.profile()?.role === 'teacher');
  /** Where the logged-in user's own page lives. */
  readonly homeLink = computed(() => (this.isTeacher() ? '/teacher' : '/me'));

  async init() {
    try {
      if (sessionStorage.getItem('sg')) sessionStorage.removeItem('sg');
    } catch {}
    const {
      data: { session },
    } = await this.sb.auth.getSession();
    const user = session?.user ?? null;
    this.userId.set(user?.id ?? null);
    if (user) {
      const { data } = await this.sb.from('profiles').select('*').eq('id', user.id).single();
      this.profile.set(data as Profile);
    } else {
      this.profile.set(null);
    }
  }

  async logout() {
    await this.sb.auth.signOut();
    this.userId.set(null);
    this.profile.set(null);
    await this.router.navigateByUrl('/');
  }
}
