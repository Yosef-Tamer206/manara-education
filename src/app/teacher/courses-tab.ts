import { Component, OnInit, inject, signal } from '@angular/core';
import { BusyService } from '../core/busy.service';
import { GRADES, SITE_VERSION } from '../core/constants';
import { Course } from '../core/models';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { QuizManager } from './quiz-manager';
import { uploadCover } from './cover-upload';

interface LessonRow {
  id: string;
  title: string;
  course_id: string;
  position: number;
}

@Component({
  selector: 'app-courses-tab',
  imports: [QuizManager],
  templateUrl: './courses-tab.html',
})
export class CoursesTab implements OnInit {
  private sb = inject(SupabaseService).client;
  private toast = inject(ToastService);
  private busy = inject(BusyService);

  protected grades = GRADES;
  protected version = SITE_VERSION;
  protected courses = signal<Course[]>([]);
  protected lessons = signal<LessonRow[]>([]);
  protected questionCount = signal<Record<string, number>>({});
  protected quizFor = signal<{ id: string; title: string } | null>(null);

  // New-course form
  protected cTitle = signal('');
  protected cDesc = signal('');
  protected cGrade = signal(GRADES[0]);
  protected cFile: File | undefined;
  protected cMsg = signal<{ text: string; ok: boolean } | null>(null);
  // New-lesson form
  protected lCourse = signal('');
  protected lTitle = signal('');
  protected lVideo = signal('');
  protected lBody = signal('');

  ngOnInit() {
    return this.load();
  }

  protected lessonsOf(courseId: string) {
    return this.lessons().filter((l) => l.course_id === courseId);
  }

  async load() {
    const [cs, ls, qn] = await Promise.all([
      this.sb.from('courses').select('*').order('grade'),
      this.sb.from('lessons').select('id,title,course_id,position').order('position'),
      this.sb.from('quizzes').select('lesson_id'),
    ]);
    const counts: Record<string, number> = {};
    (qn.data || []).forEach((x: { lesson_id: string }) => (counts[x.lesson_id] = (counts[x.lesson_id] || 0) + 1));
    this.courses.set((cs.data as Course[]) || []);
    this.lessons.set((ls.data as LessonRow[]) || []);
    this.questionCount.set(counts);
    if (!this.lCourse() && cs.data?.length) this.lCourse.set(cs.data[0].id);
  }

  private message(text: string, ok: boolean) {
    this.cMsg.set({ text, ok });
    this.toast.show(text);
  }

  protected setFile(e: Event) {
    this.cFile = (e.target as HTMLInputElement).files?.[0];
  }

  protected addCourse() {
    return this.busy.run('addCourse', async () => {
      const title = this.cTitle().trim();
      if (!title) return this.message('اكتب اسم الكورس', false);
      this.message('جاري إضافة الكورس…', true);
      let note = '';
      try {
        const { data: ses } = await this.sb.auth.getSession();
        if (!ses?.session) return this.message('الجلسة انتهت. اضغط خروج وادخل تاني وبعدين أضف الكورس', false);
        const { data: row, error } = await this.sb
          .from('courses')
          .insert({ title, description: this.cDesc(), grade: this.cGrade() })
          .select()
          .single();
        if (error) return this.message('فشل إضافة الكورس: ' + error.message, false);
        if (this.cFile) {
          this.message('الكورس اتضاف. جاري رفع الغلاف…', true);
          const r = await uploadCover(this.sb, this.cFile);
          if (r.err) note = 'الكورس اتضاف لكن الغلاف ما اترفعش (' + r.err + '). غيّر الغلاف من الجدول تحت.';
          else {
            const u = await this.sb.from('courses').update({ cover_url: r.url }).eq('id', row.id);
            if (u.error) note = 'الكورس اتضاف لكن الغلاف ما اتحفظش (' + u.error.message + ')';
          }
        }
      } catch (e) {
        return this.message('حصلت مشكلة: ' + ((e as Error).message || e), false);
      }
      this.cTitle.set('');
      this.cDesc.set('');
      this.cFile = undefined;
      await this.load();
      this.message(note || 'اتضاف الكورس بنجاح ✓', !note);
    });
  }

  protected addLesson() {
    return this.busy.run('addLesson', async () => {
      const title = this.lTitle().trim();
      const course_id = this.lCourse();
      if (!title || !course_id) return this.toast.show('اختار كورس واكتب عنوان');
      const { count } = await this.sb.from('lessons').select('id', { count: 'exact', head: true }).eq('course_id', course_id);
      const { error } = await this.sb.from('lessons').insert({
        course_id,
        title,
        video_url: this.lVideo().trim() || null,
        body: this.lBody(),
        position: (count || 0) + 1,
      });
      if (error) this.toast.show(error.message);
      else {
        this.toast.show('اتضاف الدرس');
        this.lTitle.set('');
        this.lVideo.set('');
        this.lBody.set('');
      }
      await this.load();
    });
  }

  protected async setCover(id: string, e: Event) {
    const input = e.target as HTMLInputElement;
    const r = await uploadCover(this.sb, input.files?.[0]);
    if (r.err) return this.toast.show(r.err);
    if (!r.url) return;
    const { error } = await this.sb.from('courses').update({ cover_url: r.url }).eq('id', id);
    this.toast.show(error ? 'فشل تحديث الغلاف: ' + error.message : 'اتحدّث الغلاف');
    await this.load();
  }

  protected togglePublished(c: Course) {
    return this.busy.run('pub' + c.id, async () => {
      await this.sb.from('courses').update({ published: !c.published }).eq('id', c.id);
      await this.load();
    });
  }

  protected closeQuiz() {
    this.quizFor.set(null);
    this.load();
  }
}
