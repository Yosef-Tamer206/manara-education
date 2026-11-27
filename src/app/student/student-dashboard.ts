import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { arDate, percent } from '../core/format';
import { Announcement, Course, QuizResult } from '../core/models';
import { SessionService } from '../core/session.service';
import { SupabaseService } from '../core/supabase.service';

@Component({
  selector: 'app-student-dashboard',
  imports: [RouterLink],
  templateUrl: './student-dashboard.html',
})
export class StudentDashboard {
  protected session = inject(SessionService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private sb = inject(SupabaseService).client;

  protected loading = signal(true);
  protected courses = signal<Course[]>([]);
  protected lessons = signal<{ id: string; course_id: string }[]>([]);
  protected done = signal(new Set<string>());
  protected announcements = signal<Announcement[]>([]);
  protected results = signal<QuizResult[]>([]);

  protected arDate = arDate;

  /** Lessons (and how many are finished) across the student's own courses. */
  protected totals = computed(() => {
    const mine = new Set(this.courses().map((c) => c.id));
    const my = this.lessons().filter((l) => mine.has(l.course_id));
    return { total: my.length, done: my.filter((l) => this.done().has(l.id)).length };
  });

  protected average = computed(() => {
    const r = this.results();
    if (!r.length) return null;
    return Math.round((r.reduce((a, x) => a + (x.total ? x.score / x.total : 0), 0) * 100) / r.length);
  });

  protected progress = (courseId: string) => {
    const ls = this.lessons().filter((l) => l.course_id === courseId);
    const d = ls.filter((l) => this.done().has(l.id)).length;
    return { done: d, total: ls.length, pct: percent(d, ls.length) };
  };

  constructor() {
    // Runs on first render and again whenever the profile changes (login / logout).
    effect(() => {
      const p = this.session.profile();
      if (!p) return untracked(() => this.auth.openAuth());
      if (p.role === 'teacher') return void this.router.navigateByUrl('/teacher');
      if (p.approved) untracked(() => this.load(p.grade));
    });
  }

  private async load(grade: string | null) {
    this.loading.set(true);
    const [cs, ls, pr, an, qr] = await Promise.all([
      this.sb.from('courses').select('*').eq('published', true).eq('grade', grade),
      this.sb.from('lessons').select('id,course_id'),
      this.sb.from('progress').select('lesson_id'),
      this.sb.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
      this.sb.from('quiz_results').select('*').order('taken_at', { ascending: false }),
    ]);
    this.courses.set((cs.data as Course[]) || []);
    this.lessons.set(ls.data || []);
    this.done.set(new Set((pr.data || []).map((x: { lesson_id: string }) => x.lesson_id)));
    this.announcements.set((an.data as Announcement[]) || []);
    this.results.set((qr.data as QuizResult[]) || []);
    this.loading.set(false);
  }
}
