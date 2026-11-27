import { Injectable, computed, inject, signal } from '@angular/core';
import { BotDecision, CatalogLesson, PaymentSettings, Subscription } from '../core/models';
import { SessionService } from '../core/session.service';
import { SupabaseService } from '../core/supabase.service';

export const EMPTY_SETTINGS: PaymentSettings = {
  price_month: '',
  price_lesson: '',
  payment_number: '',
  payment_methods: '',
  unconfirmed_hours: '48',
};

/** Why the bot rejected a request, shown in the history lists. */
export const REJECT_LABELS: Record<string, string> = {
  already_active: 'عنده اشتراك شغال',
  pending_confirmation: 'طلبات لسه مستنية التأكيد',
  wrong_amount: 'المبلغ غلط',
  bad_reference: 'رقم عملية غير صحيح',
  duplicate_reference: 'رقم عملية مكرر',
  no_receipt: 'من غير إيصال',
  duplicate_receipt: 'إيصال مكرر',
};

const MAX_SIDE = 1280;

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private sb = inject(SupabaseService).client;
  private session = inject(SessionService);

  readonly settings = signal<PaymentSettings>({ ...EMPTY_SETTINGS });
  readonly items = signal<Subscription[]>([]);
  readonly loaded = signal(false);

  readonly priceMonth = computed(() => this.settings().price_month);
  readonly priceLesson = computed(() => this.settings().price_lesson);

  /** The student's live monthly subscription, if any. */
  readonly month = computed(() => this.items().find((s) => s.live && s.plan === 'month') ?? null);
  readonly lessons = computed(() => this.items().filter((s) => s.live && s.plan === 'lesson'));
  readonly awaitingConfirm = computed(() => this.items().filter((s) => s.live && !s.confirmed_at));
  readonly daysLeft = computed(() => {
    const end = this.month()?.effective_end;
    return end ? Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000) : null;
  });

  constructor() {
    this.loadSettings();
  }

  async loadSettings() {
    const { data } = await this.sb.from('site_settings').select('key,value');
    const next = { ...EMPTY_SETTINGS };
    for (const r of data || []) (next as Record<string, string>)[r.key] = r.value;
    this.settings.set(next);
  }

  async saveSettings(s: PaymentSettings) {
    const rows = Object.entries(s).map(([key, value]) => ({ key, value: String(value).trim(), updated_at: new Date().toISOString() }));
    const { error } = await this.sb.from('site_settings').upsert(rows);
    if (!error) await this.loadSettings();
    return error;
  }

  async refresh() {
    if (!this.session.userId()) return;
    const { data } = await this.sb.rpc('list_subscriptions');
    this.items.set((data as Subscription[]) || []);
    this.loaded.set(true);
  }

  async catalog(): Promise<CatalogLesson[]> {
    const { data } = await this.sb.rpc('lesson_catalog');
    return (data as CatalogLesson[]) || [];
  }

  async receiptUrl(path: string) {
    const { data } = await this.sb.storage.from('receipts').createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  }

  /** Uploads the receipt, then asks the database to accept or reject the request. */
  async request(plan: 'month' | 'lesson', lessonId: string | null, amount: number, reference: string, file: File): Promise<BotDecision> {
    const uid = this.session.userId();
    if (!uid) return { ok: false, message: 'سجّل دخول الأول.' };
    const hash = await this.sha256(file);
    const blob = await this.shrink(file);
    const path = `${uid}/${Date.now()}-${hash.slice(0, 8)}.${blob.type === 'image/jpeg' ? 'jpg' : 'png'}`;
    const up = await this.sb.storage.from('receipts').upload(path, blob, { contentType: blob.type });
    if (up.error) return { ok: false, message: 'مقدرتش أرفع الصورة. جرّب صورة أصغر.' };
    const { data, error } = await this.sb.rpc('request_subscription', {
      p_plan: plan,
      p_lesson: lessonId,
      p_amount: amount,
      p_reference: reference,
      p_receipt_path: path,
      p_receipt_hash: hash,
    });
    if (error || !data) return { ok: false, message: 'حصلت مشكلة. جرّب تاني.' };
    await this.refresh();
    return data as BotDecision;
  }

  private async sha256(file: File) {
    const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /** Scales a big photo down to JPEG so it fits the 3 MB limit. Falls back to the original. */
  private async shrink(file: File): Promise<Blob> {
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k);
      c.height = Math.round(bmp.height * k);
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
      const out = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.82));
      return out ?? file;
    } catch {
      return file;
    }
  }
}
