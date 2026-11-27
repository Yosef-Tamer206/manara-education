import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { BusyService } from '../core/busy.service';
import { arDate, arDateTime } from '../core/format';
import { Subscription } from '../core/models';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { REJECT_LABELS, SubscriptionService } from '../subscription/subscription.service';
import { PaymentSettingsForm } from './payment-settings';

type Filter = 'wait' | 'live' | 'rejected' | 'all';

@Component({
  selector: 'app-subscriptions-tab',
  imports: [PaymentSettingsForm],
  templateUrl: './subscriptions-tab.html',
})
export class SubscriptionsTab implements OnInit {
  private sb = inject(SupabaseService).client;
  private subs = inject(SubscriptionService);
  private toast = inject(ToastService);
  private busy = inject(BusyService);

  readonly changed = output<void>();
  protected arDate = arDate;
  protected arDateTime = arDateTime;
  protected filter = signal<Filter>('wait');
  protected filters: { key: Filter; label: string }[] = [
    { key: 'wait', label: 'تحتاج تأكيد' },
    { key: 'live', label: 'شغالة' },
    { key: 'rejected', label: 'مرفوضة' },
    { key: 'all', label: 'الكل' },
  ];

  protected rows = computed(() => {
    const f = this.filter();
    return this.subs.items().filter((s) => {
      if (f === 'wait') return s.live && !s.confirmed_at;
      if (f === 'live') return s.live;
      if (f === 'rejected') return s.status === 'rejected';
      return true;
    });
  });
  protected count = (f: Filter) => (f === 'wait' ? this.subs.items().filter((s) => s.live && !s.confirmed_at).length : null);

  ngOnInit() {
    return this.subs.refresh();
  }

  protected state(s: Subscription) {
    if (s.status === 'rejected') return `مرفوض: ${REJECT_LABELS[s.reject_reason ?? ''] ?? ''}`;
    if (s.status === 'revoked') return 'ملغي';
    if (!s.live) return s.confirmed_at ? 'منتهي' : 'اتقفل: ما اتأكدش';
    return s.confirmed_at ? 'شغال ومؤكد' : 'شغال، مستني تأكيدك';
  }

  protected planName = (s: Subscription) => (s.plan === 'month' ? 'شهر' : `حصة: ${s.lesson_title ?? ''}`);

  protected canConfirm = (s: Subscription) => s.status === 'active' && !s.confirmed_at;
  protected canRevoke = (s: Subscription) => s.status === 'active';

  protected confirm(s: Subscription) {
    return this.update(s, 'confirm', { confirmed_at: new Date().toISOString() }, 'تم تأكيد الاستلام');
  }

  protected revoke(s: Subscription) {
    if (!confirm(`إلغاء اشتراك ${s.student_name}؟ الوصول هيقفل فورًا.`)) return;
    return this.update(s, 'revoke', { status: 'revoked' }, 'اتلغى الاشتراك');
  }

  private update(s: Subscription, key: string, patch: object, done: string) {
    return this.busy.run(key + s.id, async () => {
      const { error } = await this.sb.from('subscriptions').update(patch).eq('id', s.id);
      this.toast.show(error ? error.message : done);
      await this.subs.refresh();
      this.changed.emit();
    });
  }

  protected receipt(s: Subscription) {
    return this.busy.run('rc' + s.id, async () => {
      const url = s.receipt_path ? await this.subs.receiptUrl(s.receipt_path) : null;
      if (url) window.open(url, '_blank', 'noopener');
      else this.toast.show('الإيصال مش متاح');
    });
  }
}
