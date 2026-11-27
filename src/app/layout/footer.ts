import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  template: `
    <footer>
      <div class="wrap">
        <span>منصة الأستاذ محمد نصر · فيزياء</span>
        <span>الدروس والاختبارات والواجبات</span>
        <span><a href="test-payment.html" style="color:inherit;text-decoration:underline">تجربة الدفع (تجريبي فقط، مفيش فلوس حقيقية)</a></span>
      </div>
    </footer>
  `,
})
export class Footer {}
