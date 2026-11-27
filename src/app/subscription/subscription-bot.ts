import { Component, ElementRef, OnInit, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { BusyService } from '../core/busy.service';
import { CatalogLesson } from '../core/models';
import { ToastService } from '../core/toast.service';
import { SubscriptionService } from './subscription.service';

interface Bubble {
  from: 'bot' | 'me';
  text: string;
  tone?: 'ok' | 'bad';
}

type Step = 'plan' | 'lesson' | 'reference' | 'receipt' | 'review' | 'done';

/** Chat-style flow: pick a plan, pay by transfer, send the reference and receipt. The database decides. */
@Component({
  selector: 'app-subscription-bot',
  templateUrl: './subscription-bot.html',
})
export class SubscriptionBot implements OnInit {
  protected subs = inject(SubscriptionService);
  private busy = inject(BusyService);
  private toast = inject(ToastService);

  /** Lesson to preselect (from a locked lesson link). */
  readonly lessonId = input<string | null>(null);
  readonly decided = output<void>();

  private log = viewChild<ElementRef<HTMLElement>>('log');
  protected bubbles = signal<Bubble[]>([]);
  protected step = signal<Step>('plan');
  protected catalog = signal<CatalogLesson[]>([]);
  protected plan = signal<'month' | 'lesson'>('month');
  protected pickedLesson = signal('');
  protected reference = signal('');
  protected file = signal<File | null>(null);

  protected readyPlans = () => ({
    month: this.subs.paymentsOpen() && /^\d+$/.test(this.subs.priceMonth()),
    lesson: this.subs.paymentsOpen() && /^\d+$/.test(this.subs.priceLesson()),
  });
  protected locked = () => this.catalog().filter((l) => !l.unlocked);
  protected courses = () => [...new Set(this.locked().map((l) => l.course_title))];
  protected inCourse = (t: string) => this.locked().filter((l) => l.course_title === t);
  protected price = () => Number(this.plan() === 'month' ? this.subs.priceMonth() : this.subs.priceLesson());
  protected lessonTitle = () => this.catalog().find((l) => l.lesson_id === this.pickedLesson())?.title ?? '';

  constructor() {
    // Keep the newest message in view.
    effect(() => {
      this.bubbles();
      setTimeout(() => {
        const el = this.log()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  async ngOnInit() {
    await Promise.all([this.subs.loadSettings(), this.subs.refresh()]);
    this.catalog.set(await this.subs.catalog());
    this.start();
    const pre = this.lessonId();
    if (pre && this.locked().some((l) => l.lesson_id === pre) && this.readyPlans().lesson) {
      this.pickedLesson.set(pre);
      this.choosePlan('lesson');
    }
  }

  protected start() {
    this.reference.set('');
    this.file.set(null);
    this.pickedLesson.set('');
    this.step.set('plan');
    const r = this.readyPlans();
    const open = this.subs.paymentsOpen();
    this.bubbles.set([
      {
        from: 'bot',
        text: !open ? 'الاشتراك هيتفتح قريبًا. لحد وقتها الدروس مفتوحة للطلبة المقبولين.' : r.month || r.lesson ? 'أهلاً! أنا مسؤول عن الاشتراكات. تحب تشترك إزاي؟' : 'الاشتراك لسه مش متاح. جرّب بعد شوية.',
      },
    ]);
  }

  private say(from: Bubble['from'], text: string, tone?: Bubble['tone']) {
    this.bubbles.update((b) => [...b, { from, text, tone }]);
  }

  protected choosePlan(p: 'month' | 'lesson') {
    this.plan.set(p);
    this.say('me', p === 'month' ? `اشتراك شهر (${this.subs.priceMonth()} جنيه)` : `حصة واحدة (${this.subs.priceLesson()} جنيه)`);
    if (p === 'lesson') {
      if (!this.locked().length) {
        this.say('bot', 'مفيش دروس مقفولة عندك دلوقتي.');
        return;
      }
      this.say('bot', 'اختار الدرس اللي عايز تفتحه.');
      this.step.set('lesson');
    } else {
      this.askPay();
    }
  }

  protected chooseLesson() {
    if (!this.pickedLesson()) return;
    this.say('me', this.lessonTitle());
    this.askPay();
  }

  private askPay() {
    const s = this.subs.settings();
    const where = s.payment_number ? `الرقم ${s.payment_number}` : 'الرقم اللي المدرس هيحدده';
    this.say(
      'bot',
      `حوّل ${this.price()} جنيه على ${where} (${s.payment_methods || 'فودافون كاش / إنستاباي'}). بعد التحويل اكتب رقم العملية اللي ظاهر في رسالة التحويل.`,
    );
    this.step.set('reference');
  }

  protected sendReference() {
    const r = this.reference().trim();
    if (!r) return;
    this.say('me', r);
    this.say('bot', 'تمام. ابعت صورة إيصال التحويل (Screenshot).');
    this.step.set('receipt');
  }

  protected pickFile(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return this.toast.show('لازم تختار صورة.');
    this.file.set(f);
    this.say('me', `صورة الإيصال: ${f.name}`);
    this.say('bot', this.summary());
    this.step.set('review');
  }

  private summary() {
    const what = this.plan() === 'month' ? 'اشتراك شهر' : `حصة: ${this.lessonTitle()}`;
    return `راجع الطلب: ${what}، المبلغ ${this.price()} جنيه، رقم العملية ${this.reference().trim()}.`;
  }

  protected submit() {
    const f = this.file();
    if (!f) return;
    return this.busy.run('subscribe', async () => {
      this.say('bot', 'ثواني، بفحص الطلب…');
      const res = await this.subs.request(
        this.plan(),
        this.plan() === 'lesson' ? this.pickedLesson() : null,
        this.price(),
        this.reference().trim(),
        f,
      );
      if (res.ok) {
        const h = res.unconfirmed_hours ?? 48;
        const when = res.ends_at ? ` وهيقفل لوحده يوم ${new Date(res.ends_at).toLocaleDateString('ar-EG')}` : '';
        this.say('bot', `تم قبول الاشتراك وفتحتلك المحتوى دلوقتي${when}. المدرس هيأكد استلام الفلوس خلال ${h} ساعة، ولو ماتأكدش الوصول بيقفل.`, 'ok');
        this.step.set('done');
        this.catalog.set(await this.subs.catalog());
      } else {
        this.say('bot', `اترفض الطلب: ${res.message ?? 'حصلت مشكلة.'}`, 'bad');
        this.step.set('done');
      }
      this.decided.emit();
    });
  }
}
