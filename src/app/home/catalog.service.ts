import { Injectable, computed, inject, signal } from '@angular/core';
import { GRADES } from '../core/constants';
import { CatalogCourse } from '../core/models';
import { SupabaseService } from '../core/supabase.service';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private sb = inject(SupabaseService).client;

  readonly courses = signal<CatalogCourse[]>([]);
  readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  readonly filter = signal<string>('all');

  readonly visible = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.courses() : this.courses().filter((c) => c.grade === f);
  });

  /** Number of published courses per grade, in GRADES order. */
  readonly gradeCounts = computed(() => GRADES.map((g) => this.courses().filter((c) => c.grade === g).length));

  /** The three most recently added lessons, newest first. */
  readonly latestLessons = computed(() => {
    const all: { course: string; title: string; grade: string }[] = [];
    this.courses().forEach((c) => (c.lessons || []).forEach((t) => all.push({ course: c.title, title: t, grade: c.grade })));
    return all.slice(-3).reverse();
  });

  async load() {
    this.status.set('loading');
    const { data, error } = await this.sb.rpc('public_catalog');
    if (error) {
      this.status.set('error');
      return;
    }
    this.courses.set((data as CatalogCourse[]) || []);
    this.status.set('ready');
  }
}
