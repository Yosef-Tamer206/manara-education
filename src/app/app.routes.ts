import { Routes } from '@angular/router';
import { Home } from './home/home';
import { StudentDashboard } from './student/student-dashboard';
import { CoursePage } from './student/course-page';
import { LessonPage } from './student/lesson-page';
import { Teacher } from './teacher/teacher';
import { SubscribePage } from './subscription/subscribe-page';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'me', component: StudentDashboard },
  { path: 'teacher', component: Teacher },
  { path: 'subscribe', component: SubscribePage },
  { path: 'course/:id', component: CoursePage },
  { path: 'lesson/:id', component: LessonPage },
  { path: '**', component: Home },
];
