# Manara (منارة)

Physics teaching platform for teacher Mohamed Nasr: courses, lessons, quizzes, homework and announcements, with teacher approval for new students.
Angular 22 front end (standalone components, signals) on a free Supabase backend, hosted on GitHub Pages.

Live: https://yosef-tamer206.github.io/manara-education/

## Features

- Public home page: published courses by grade, teacher intro, FAQ, latest lessons.
- Student: sign up (email or Google), wait for approval, then dashboard, courses, lessons, auto-graded quizzes and homework submission.
- Teacher: approve students, manage courses, lessons and quiz questions, read homework, post announcements.
- Subscriptions: a chat-style bot takes a monthly (30 days) or single-lesson request, checks it and accepts or rejects it on its own. Access starts at once and ends by itself. The teacher confirms that the money arrived; unconfirmed access closes after a set number of hours. Prices, transfer number and that window are edited in the teacher panel.

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
    subscription/        bot, status card, subscribe page, subscription service
    shared/              video embed, link pipe, scroll-reveal directive
supabase/                SQL to run once in the Supabase SQL editor (subscriptions.sql)
public/                  copied as is: favicon, home image, test-payment.html
.github/workflows/       deploy.yml
```

## Backend

Supabase tables: profiles, courses, lessons, quizzes, homework, announcements, progress, quiz_results, site_settings, subscriptions, protected by row level security.
Subscription rules live in the database (`supabase/subscriptions.sql`): `request_subscription` accepts or rejects (price match, unique transfer reference and receipt, receipt present, no duplicate active plan, daily limit). `has_lesson_access` gates lessons, quizzes, progress and homework. Expiry is computed on read, so no scheduled job is needed. Receipt images go to the private `receipts` bucket.
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
