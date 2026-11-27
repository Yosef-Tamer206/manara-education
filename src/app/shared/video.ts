import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/** Lesson video: YouTube embed, a plain link for any other URL, or a placeholder. */
@Component({
  selector: 'app-video',
  template: `
    @if (!url()) {
      <div class="player"><div><b>▶</b>لا يوجد فيديو لهذا الدرس بعد</div></div>
    } @else if (embedUrl(); as src) {
      <div style="aspect-ratio:16/9;margin-bottom:20px">
        <iframe style="width:100%;height:100%;border:0;border-radius:14px" [src]="src" allowfullscreen></iframe>
      </div>
    } @else {
      <p><a class="btn ghost sm" target="_blank" rel="noopener" [href]="url()">فتح الفيديو</a></p>
    }
  `,
})
export class Video {
  private sanitizer = inject(DomSanitizer);
  readonly url = input<string | null>(null);
  protected embedUrl = computed(() => {
    const m = (this.url() || '').match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
    return m ? this.sanitizer.bypassSecurityTrustResourceUrl('https://www.youtube-nocookie.com/embed/' + m[1]) : null;
  });
}
