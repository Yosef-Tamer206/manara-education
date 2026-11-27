export const arDate = (v: string) => new Date(v).toLocaleDateString('ar-EG');
export const arDateTime = (v: string) => new Date(v).toLocaleString('ar-EG');
export const arTime = (v: string) =>
  new Date(v).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' });

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** First word of the name, or first two when the first ends with a dot (e.g. "م. أحمد"). */
export const shortName = (full: string) => {
  const w = (full || '').trim().split(/\s+/);
  return /\.$/.test(w[0]) ? w.slice(0, 2).join(' ') : w[0];
};

export const percent = (done: number, total: number) => (total ? Math.round((done * 100) / total) : 0);
