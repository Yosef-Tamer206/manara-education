import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { esc } from '../core/format';

/** Escapes text, then turns http(s) links into clickable anchors. */
@Pipe({ name: 'linkify' })
export class LinkifyPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(text: string): SafeHtml {
    const html = esc(text).replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener" style="color:var(--ink2);font-weight:700">$1</a>',
    );
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
