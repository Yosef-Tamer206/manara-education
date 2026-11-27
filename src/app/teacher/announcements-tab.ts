import { Component, OnInit, inject, signal } from '@angular/core';
import { BusyService } from '../core/busy.service';
import { Announcement } from '../core/models';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-announcements-tab',
  templateUrl: './announcements-tab.html',
})
export class AnnouncementsTab implements OnInit {
  private sb = inject(SupabaseService).client;
  private toast = inject(ToastService);
  private busy = inject(BusyService);
  protected items = signal<Announcement[]>([]);
  protected text = signal('');

  ngOnInit() {
    return this.load();
  }

  private async load() {
    const { data } = await this.sb.from('announcements').select('*').order('created_at', { ascending: false });
    this.items.set((data as Announcement[]) || []);
  }

  protected add() {
    return this.busy.run('addAnn', async () => {
      const body = this.text().trim();
      if (!body) return;
      const { error } = await this.sb.from('announcements').insert({ body });
      if (error) this.toast.show(error.message);
      else this.text.set('');
      await this.load();
    });
  }
}
