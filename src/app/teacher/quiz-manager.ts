import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { AdminQuizQuestion } from '../core/models';
import { SupabaseService } from '../core/supabase.service';

/** Modal where the teacher adds, edits and deletes the questions of one lesson. */
@Component({
  selector: 'app-quiz-manager',
  templateUrl: './quiz-manager.html',
})
export class QuizManager implements OnInit {
  private sb = inject(SupabaseService).client;

  readonly lessonId = input.required<string>();
  readonly lessonTitle = input.required<string>();
  readonly closed = output<void>();

  protected list = signal<AdminQuizQuestion[]>([]);
  protected editingId = signal<string | null>(null);
  protected question = signal('');
  protected options = signal<string[]>(['', '']);
  protected correct = signal(0);
  protected saving = signal(false);
  protected msg = signal<{ text: string; ok: boolean } | null>(null);

  ngOnInit() {
    return this.load();
  }

  private say(text: string, ok: boolean) {
    this.msg.set({ text, ok });
  }

  private async load() {
    const { data, error } = await this.sb.rpc('admin_quizzes', { p_lesson: this.lessonId() });
    this.list.set(error ? [] : (data as AdminQuizQuestion[]) || []);
    if (error) this.say('تعذّر تحميل الأسئلة: ' + error.message, false);
  }

  private resetForm() {
    this.editingId.set(null);
    this.question.set('');
    this.options.set(['', '']);
    this.correct.set(0);
  }

  protected setOption(j: number, value: string) {
    this.options.update((o) => o.map((x, i) => (i === j ? value : x)));
  }

  protected addOption() {
    if (this.options().length < 6) this.options.update((o) => [...o, '']);
  }

  protected removeOption(j: number) {
    if (this.options().length <= 2) return;
    this.options.update((o) => o.filter((_, i) => i !== j));
    if (this.correct() === j) this.correct.set(0);
    else if (this.correct() > j) this.correct.update((c) => c - 1);
  }

  protected edit(id: string) {
    const x = this.list().find((y) => y.id === id);
    if (!x) return;
    this.editingId.set(id);
    this.question.set(x.question);
    this.options.set([...(x.options || [])]);
    this.correct.set(x.correct);
  }

  protected cancelEdit() {
    this.resetForm();
  }

  protected async save() {
    if (this.saving()) return;
    const q = this.question().trim();
    if (!q) return this.say('اكتب نص السؤال', false);
    const kept: string[] = [];
    let newCorrect = -1;
    this.options().forEach((o, j) => {
      const t = (o || '').trim();
      if (t) {
        if (j === this.correct()) newCorrect = kept.length;
        kept.push(t);
      }
    });
    if (kept.length < 2) return this.say('لازم اختيارين على الأقل', false);
    if (new Set(kept).size !== kept.length) return this.say('فيه اختيارين متكررين', false);
    if (newCorrect < 0) return this.say('علّم الإجابة الصح على اختيار مكتوب', false);

    this.saving.set(true);
    const editing = this.editingId();
    try {
      const r = editing
        ? await this.sb.from('quizzes').update({ question: q, options: kept, correct: newCorrect }).eq('id', editing)
        : await this.sb.from('quizzes').insert({ lesson_id: this.lessonId(), question: q, options: kept, correct: newCorrect });
      if (r.error) {
        this.saving.set(false);
        return this.say('فشل الحفظ: ' + r.error.message, false);
      }
    } catch {
      this.saving.set(false);
      return this.say('مشكلة اتصال، جرّب تاني', false);
    }
    this.saving.set(false);
    this.resetForm();
    await this.load();
    this.say(editing ? 'اتحفظ التعديل' : 'اتضاف السؤال', true);
  }

  protected async remove(id: string) {
    if (!confirm('تحذف السؤال ده؟')) return;
    const { error } = await this.sb.from('quizzes').delete().eq('id', id);
    if (error) return this.say('فشل الحذف: ' + error.message, false);
    if (this.editingId() === id) this.resetForm();
    await this.load();
    this.say('اتحذف السؤال', true);
  }
}
