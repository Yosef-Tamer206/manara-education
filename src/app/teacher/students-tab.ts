import { Component, OnInit, inject, output, signal } from '@angular/core';
import { BusyService } from '../core/busy.service';
import { GRADES } from '../core/constants';
import { Profile } from '../core/models';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-students-tab',
  templateUrl: './students-tab.html',
})
export class StudentsTab implements OnInit {
  private sb = inject(SupabaseService).client;
  private toast = inject(ToastService);
  private busy = inject(BusyService);

  readonly changed = output<void>();
  protected grades = GRADES;
  protected students = signal<Profile[]>([]);

  ngOnInit() {
    return this.load();
  }

  private async load() {
    const { data } = await this.sb.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false });
    this.students.set((data as Profile[]) || []);
  }

  protected async setGrade(id: string, grade: string) {
    const { error } = await this.sb.from('profiles').update({ grade }).eq('id', id);
    this.toast.show(error ? error.message : 'تم تحديد الصف');
  }

  protected setApproved(id: string, approved: boolean) {
    return this.busy.run('approve' + id, async () => {
      const { error } = await this.sb.from('profiles').update({ approved }).eq('id', id);
      if (error) this.toast.show(error.message);
      await this.load();
      this.changed.emit();
    });
  }
}
