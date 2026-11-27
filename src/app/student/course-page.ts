import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { percent } from '../core/format';
import { Course, Lesson } from '../core/models';
import { SessionService } from '../core/session.service';
import { SupabaseService } from '../core/supabase.service';

@Component({
  selector: 'app-course-page',
  imports: [RouterLink],
  templateUrl: './course-page.html',
})
export class CoursePage {
  private sb = inject(SupabaseService).client;
  private session = inject(SessionService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected loading = signal(true);
  protected course = signal<Course | null>(null);
  protected lessons = signal<Lesson[]>([]);
  protected done = signal(new Set<string>());

  protected doneCount = computed(() => this.lessons().filter((l) => this.done().has(l.id)).length);
  protected pct = computed(() => percent(this.doneCount(), this.lessons().length));
  /** First unfinished lesson, or the first lesson when everything is done. */
  protected next = computed(() => this.lessons().find((l) => !this.done().has(l.id)) || this.lessons()[0]);

  constructor() {
    // Re-run whenever the route id changes.
    this.route.paramMap.subscribe((m) => this.load(m.get('id')!));
  }

  private async load(id: string) {
    const p = this.session.profile();
    if (!p || (!p.approved && p.role !== 'teacher')) {
      this.router.navigateByUrl('/me');
      return;
    }
    this.loading.set(true);
    const [c, ls, pr] = await Promise.all([
      this.sb.from('courses').select('*').eq('id', id).maybeSingle(),
      this.sb.from('lessons').select('*').eq('course_id', id).order('position'),
      this.sb.from('progress').select('lesson_id'),
    ]);
    this.course.set(c.data as Course | null);
    this.lessons.set((ls.data as Lesson[]) || []);
    this.done.set(new Set((pr.data || []).map((x: { lesson_id: string }) => x.lesson_id)));
    this.loading.set(false);
  }
}
