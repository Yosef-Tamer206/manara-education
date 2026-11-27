import { Component, effect, inject, signal, untracked } from '@angular/core';
import { SessionService } from '../core/session.service';
import { SupabaseService } from '../core/supabase.service';
import { AnnouncementsTab } from './announcements-tab';
import { CoursesTab } from './courses-tab';
import { HomeworkTab } from './homework-tab';
import { StudentsTab } from './students-tab';

type Tab = 'students' | 'courses' | 'hw' | 'ann';

interface Stats {
  students: number;
  pending: number;
  courses: number;
  lessons: number;
  homework: number;
}

@Component({
  selector: 'app-teacher',
  imports: [StudentsTab, CoursesTab, HomeworkTab, AnnouncementsTab],
  templateUrl: './teacher.html',
})
export class Teacher {
  protected session = inject(SessionService);
  private sb = inject(SupabaseService).client;

  protected tab = signal<Tab>('students');
  protected stats = signal<Stats | null>(null);
  protected tabs: { key: Tab; label: string }[] = [
    { key: 'students', label: 'الطلاب' },
    { key: 'courses', label: 'الكورسات والدروس' },
    { key: 'hw', label: 'الواجبات' },
    { key: 'ann', label: 'الإعلانات' },
  ];

  constructor() {
    effect(() => {
      this.tab();
      if (this.session.isTeacher()) untracked(() => this.loadStats());
    });
  }

  protected select(t: Tab) {
    this.tab.set(t);
  }

  async loadStats() {
    const count = (t: string) => this.sb.from(t).select('id', { count: 'exact', head: true });
    const students = () => this.sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student');
    const [courses, lessons, all, pending, homework] = await Promise.all([
      count('courses'),
      count('lessons'),
      students(),
      students().eq('approved', false),
      count('homework'),
    ]);
    this.stats.set({
      students: all.count ?? 0,
      pending: pending.count ?? 0,
      courses: courses.count ?? 0,
      lessons: lessons.count ?? 0,
      homework: homework.count ?? 0,
    });
  }
}
