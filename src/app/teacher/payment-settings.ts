import { Component, OnInit, inject, signal } from '@angular/core';
import { BusyService } from '../core/busy.service';
import { PaymentSettings } from '../core/models';
import { ToastService } from '../core/toast.service';
import { EMPTY_SETTINGS, SubscriptionService } from '../subscription/subscription.service';

const PLACEHOLDER_NUMBER = '01000000000';

/** Prices, transfer number and the unconfirmed window: edited here, never hardcoded. */
@Component({
  selector: 'app-payment-settings',
  templateUrl: './payment-settings.html',
})
export class PaymentSettingsForm implements OnInit {
  private subs = inject(SubscriptionService);
  private toast = inject(ToastService);
  private busy = inject(BusyService);

  protected form = signal<PaymentSettings>({ ...EMPTY_SETTINGS });

  async ngOnInit() {
    await this.subs.loadSettings();
    this.form.set({ ...this.subs.settings() });
  }

  protected set(key: keyof PaymentSettings, value: string) {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected save() {
    return this.busy.run('settings', async () => {
      const f = this.form();
      const num = (v: string) => /^[0-9]+$/.test(v.trim()) && Number(v) > 0;
      if (!num(f.price_month) || !num(f.price_lesson)) return this.toast.show('الأسعار لازم تكون أرقام صحيحة');
      if (!/^[0-9]{1,3}$/.test(f.unconfirmed_hours.trim()) || Number(f.unconfirmed_hours) < 1) return this.toast.show('ساعات التأكيد لازم تكون رقم من 1 إلى 999');
      const n = f.payment_number.trim();
      if (f.payments_enabled === 'on' && (!n || n === PLACEHOLDER_NUMBER)) return this.toast.show('اكتب رقم التحويل الحقيقي قبل ما تفتح الدفع');
      const err = await this.subs.saveSettings(f);
      this.toast.show(err ? err.message : 'اتحفظت الإعدادات');
    });
  }
}
