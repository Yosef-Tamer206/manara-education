import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { GRADES } from '../core/constants';
import { ScrollService } from '../core/scroll.service';
import { SessionService } from '../core/session.service';
import { CatalogService } from './catalog.service';
import { CourseCarousel } from './course-carousel';
import { LatestLessons } from './latest-lessons';

@Component({
  selector: 'app-home',
  imports: [RouterLink, CourseCarousel, LatestLessons],
  templateUrl: './home.html',
})
export class Home implements OnInit {
  protected session = inject(SessionService);
  protected auth = inject(AuthService);
  protected catalog = inject(CatalogService);
  private scroller = inject(ScrollService);
  protected grades = GRADES;

  ngOnInit() {
    this.catalog.load();
  }

  protected goSection(id: string) {
    this.scroller.goSection(id);
  }

  protected pickGrade(i: number) {
    this.scroller.goSection('courses');
    setTimeout(() => this.catalog.filter.set(GRADES[i]), 400);
  }
}
