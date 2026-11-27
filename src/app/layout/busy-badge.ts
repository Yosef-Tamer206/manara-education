import { Component, inject } from '@angular/core';
import { BusyService } from '../core/busy.service';

@Component({
  selector: 'app-busy-badge',
  template: `<div id="busybadge" [style.display]="busy.visible() ? 'flex' : 'none'"><span class="spin"></span><span>جاري التنفيذ…</span></div>`,
})
export class BusyBadge {
  protected busy = inject(BusyService);
}
