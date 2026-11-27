import type { SupabaseClient } from '@supabase/supabase-js';

/** Downscale to at most 1600px and re-encode as JPEG so uploads stay small. */
async function shrink(file: File): Promise<Blob> {
  const bm = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bm.width, bm.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bm.width * scale);
  canvas.height = Math.round(bm.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bm, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  if (!blob) throw new Error('toBlob');
  return blob;
}

/** Uploads a course cover to the "covers" bucket. Returns the public URL, nothing, or an Arabic error. */
export async function uploadCover(sb: SupabaseClient, file?: File): Promise<{ url?: string | null; err?: string }> {
  if (!file) return { url: null };
  let blob: Blob;
  try {
    blob = await shrink(file);
  } catch {
    return { err: 'مش قادر أقرا الصورة دي. جرّب صورة JPG أو PNG تانية' };
  }
  if (blob.size > 3 * 1024 * 1024) return { err: 'الصورة لسه كبيرة، جرّب صورة أصغر' };
  const path = crypto.randomUUID() + '.jpg';
  let res;
  try {
    res = await sb.storage.from('covers').upload(path, blob, { contentType: 'image/jpeg' });
  } catch (e) {
    return { err: 'مشكلة اتصال أثناء الرفع: ' + ((e as Error).message || e) };
  }
  if (res.error) return { err: 'رفع الغلاف: ' + res.error.message };
  return { url: sb.storage.from('covers').getPublicUrl(path).data.publicUrl };
}
