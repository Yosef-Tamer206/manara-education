# Manara (منارة)

Physics teaching platform for teacher Mohamed Nasr: courses, lessons, quizzes, homework and announcements, with teacher approval for new students.
Angular 22 front end (standalone components, signals) on a free Supabase backend, hosted on GitHub Pages.

Live: https://yosef-tamer206.github.io/manara-education/

## Features

- Public home page: published courses by grade, teacher intro, FAQ, latest lessons.
- Student: sign up (email or Google), wait for approval, then dashboard, courses, lessons, auto-graded quizzes and homework submission.
- Teacher: approve students, manage courses, lessons and quiz questions, read homework, post announcements.

## Structure

```
src/
  index.html, main.ts    entry point
  styles.css             imports the files in styles/
  styles/                one CSS file per concern: base, home, pages, motion
  assets/                images used by the CSS
  app/
    core/                Supabase client, session, toast, busy, theme, scroll services; models; constants
    layout/              header, footer, toast, busy badge
    auth/                login, signup and password reset modal
    home/                catalog service, course carousel, latest lessons
    student/             dashboard, course page, lesson page (video, quiz, homework)
    teacher/             students, courses and lessons, quiz manager, homework, announcements
    shared/              video embed, link pipe, scroll-reveal directive
public/                  copied as is: favicon, home image, test-payment.html
.github/workflows/       deploy.yml
```

## Backend

Supabase tables: profiles, courses, lessons, quizzes, homework, announcements, progress, quiz_results, protected by row level security.
Quizzes are graded on the server (`submit_quiz`); the public catalog comes from `public_catalog`.
The Supabase URL and the publishable key (safe to expose, RLS protects the data) are in `src/app/core/constants.ts`.

## Run

```
npm install
npm start                                    # dev server on http://localhost:4200
npx ng build --base-href /manara-education/  # production build in dist/manara/browser
```

Routes use the URL hash (`#/me`, `#/teacher`, `#/course/:id`, `#/lesson/:id`), so GitHub Pages needs no rewrites.

## Deploy

Every push to `main` builds and deploys through `.github/workflows/deploy.yml`.
In the repo settings, Pages > Source must be "GitHub Actions".
