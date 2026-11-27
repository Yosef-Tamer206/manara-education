import { Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-toast',
  template: `<div class="toast" id="toast" [style.display]="toast.message() ? 'block' : 'none'">{{ toast.message() }}</div>`,
})
export class Toast {
  protected toast = inject(ToastService);
}
