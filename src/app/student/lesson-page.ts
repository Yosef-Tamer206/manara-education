import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BusyService } from '../core/busy.service';
import { arDateTime } from '../core/format';
import { Homework, Lesson, QuizQuestion } from '../core/models';
import { SessionService } from '../core/session.service';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { Video } from '../shared/video';

interface QuizOutcome {
  score: number;
  total: number;
  /** question id -> index of the correct option */
  correct: Record<string, number>;
}

@Component({
  selector: 'app-lesson-page',
  imports: [RouterLink, Video],
  templateUrl: './lesson-page.html',
})
export class LessonPage {
  private sb = inject(SupabaseService).client;
  private session = inject(SessionService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private busy = inject(BusyService);

  protected arDateTime = arDateTime;
  protected loading = signal(true);
  protected lesson = signal<Lesson | null>(null);
  protected questions = signal<QuizQuestion[]>([]);
  protected completed = signal(false);
  protected homework = signal<Homework[]>([]);
  protected homeworkText = signal('');

  protected answers = signal<Record<number, number>>({});
  protected outcome = signal<QuizOutcome | null>(null);
  protected quizError = signal('');
  protected quizLocked = signal(false);

  private id = '';
  protected get lessonId() {
    return this.id;
  }

  constructor() {
    this.route.paramMap.subscribe((m) => {
      this.id = m.get('id')!;
      this.load();
    });
  }

  private async load() {
    const p = this.session.profile();
    if (!p) return void this.router.navigateByUrl('/');
    if (p.role !== 'teacher' && !p.approved) return void this.router.navigateByUrl('/me');
    this.loading.set(true);
    const { data: l } = await this.sb.from('lessons').select('*').eq('id', this.id).maybeSingle();
    this.lesson.set(l as Lesson | null);
    if (l) {
      const [qs, pr, hw] = await Promise.all([
        this.sb.from('quizzes').select('id,lesson_id,question,options').eq('lesson_id', this.id).order('created_at').order('id'),
        this.sb.from('progress').select('lesson_id').eq('lesson_id', this.id),
        this.sb.from('homework').select('*').eq('lesson_id', this.id).eq('student_id', this.session.userId()),
      ]);
      this.questions.set((qs.data as QuizQuestion[]) || []);
      this.completed.set((pr.data || []).length > 0);
      this.homework.set((hw.data as Homework[]) || []);
      this.answers.set({});
      this.outcome.set(null);
      this.quizError.set('');
      this.quizLocked.set(false);
      this.homeworkText.set('');
    }
    this.loading.set(false);
  }

  protected markDone() {
    return this.busy.run('markDone', async () => {
      const { error } = await this.sb.from('progress').upsert({ student_id: this.session.userId(), lesson_id: this.id });
      if (error) return this.toast.show(error.message);
      this.toast.show('تم تسجيل التقدم');
      await this.load();
    });
  }

  protected pick(question: number, option: number) {
    if (this.quizLocked()) return;
    this.answers.update((a) => ({ ...a, [question]: option }));
  }

  protected optionClass(qi: number, qid: string, oi: number) {
    const o = this.outcome();
    if (!o) return '';
    if (o.correct[qid] === oi) return 'right';
    return this.answers()[qi] === oi ? 'wrong' : '';
  }

  protected gradeQuiz() {
    return this.busy.run('gradeQuiz', async () => {
      const qs = this.questions();
      if (this.quizLocked()) return;
      if (qs.some((_, i) => this.answers()[i] === undefined)) return this.toast.show('جاوب على كل الأسئلة الأول');
      this.quizLocked.set(true);
      this.quizError.set('');
      const payload: Record<string, number> = {};
      qs.forEach((q, i) => (payload[q.id] = this.answers()[i]));
      let res: { data: any; error: { message: string } | null };
      try {
        res = await this.sb.rpc('submit_quiz', { p_lesson: this.id, p_answers: payload });
      } catch {
        res = { data: null, error: { message: 'مشكلة اتصال' } };
      }
      if (res.error || !res.data) {
        this.quizLocked.set(false);
        this.quizError.set(res.error ? res.error.message : 'حصلت مشكلة');
        return;
      }
      const correct = Object.fromEntries((res.data.answers || []).map((x: { id: string; correct: number }) => [x.id, x.correct]));
      this.outcome.set({ score: res.data.score, total: res.data.total, correct });
    });
  }

  protected sendHomework() {
    return this.busy.run('sendHomework', async () => {
      const content = this.homeworkText().trim();
      if (!content) return this.toast.show('اكتب الواجب الأول');
      const { error } = await this.sb.from('homework').insert({ student_id: this.session.userId(), lesson_id: this.id, content });
      if (error) return this.toast.show(error.message);
      this.toast.show('اتسلّم للمدرس');
      await this.load();
    });
  }
}
