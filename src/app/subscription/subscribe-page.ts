import { Component, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { arDate } from '../core/format';
import { SessionService } from '../core/session.service';
import { SubscriptionBot } from './subscription-bot';
import { SubscriptionStatus } from './subscription-status';
import { REJECT_LABELS, SubscriptionService } from './subscription.service';
import { Subscription } from '../core/models';

@Component({
  selector: 'app-subscribe-page',
  imports: [RouterLink, SubscriptionBot, SubscriptionStatus],
  templateUrl: './subscribe-page.html',
})
export class SubscribePage {
  protected session = inject(SessionService);
  protected subs = inject(SubscriptionService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  protected lessonId = signal<string | null>(this.route.snapshot.queryParamMap.get('lesson'));
  protected arDate = arDate;

  constructor() {
    effect(() => {
      const p = this.session.profile();
      if (!p) return untracked(() => this.auth.openAuth());
      if (p.role === 'student' && p.approved) untracked(() => this.subs.refresh());
    });
  }

  protected state(s: Subscription) {
    if (s.status === 'rejected') return `مرفوض: ${REJECT_LABELS[s.reject_reason ?? ''] ?? s.reject_reason ?? ''}`;
    if (s.status === 'revoked') return 'ملغي من المدرس';
    if (!s.live) return 'منتهي';
    return s.confirmed_at ? 'شغال' : 'شغال، مستني تأكيد المدرس';
  }

  protected planName = (s: Subscription) => (s.plan === 'month' ? 'شهر' : `حصة: ${s.lesson_title ?? ''}`);
}
