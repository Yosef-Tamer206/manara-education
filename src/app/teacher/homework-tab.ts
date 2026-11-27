import { Component, OnInit, inject, signal } from '@angular/core';
import { arDate, arTime } from '../core/format';
import { Homework } from '../core/models';
import { SupabaseService } from '../core/supabase.service';
import { LinkifyPipe } from '../shared/linkify.pipe';

@Component({
  selector: 'app-homework-tab',
  imports: [LinkifyPipe],
  templateUrl: './homework-tab.html',
})
export class HomeworkTab implements OnInit {
  private sb = inject(SupabaseService).client;
  protected arDate = arDate;
  protected arTime = arTime;
  protected items = signal<Homework[]>([]);
  protected students = signal<Record<string, string>>({});
  protected lessons = signal<Record<string, string>>({});

  async ngOnInit() {
    const [h, p, l] = await Promise.all([
      this.sb.from('homework').select('*').order('submitted_at', { ascending: false }),
      this.sb.from('profiles').select('id,full_name'),
      this.sb.from('lessons').select('id,title'),
    ]);
    this.students.set(Object.fromEntries((p.data || []).map((x: { id: string; full_name: string }) => [x.id, x.full_name])));
    this.lessons.set(Object.fromEntries((l.data || []).map((x: { id: string; title: string }) => [x.id, x.title])));
    this.items.set((h.data as Homework[]) || []);
  }
}
