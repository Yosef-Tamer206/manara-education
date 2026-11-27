# Manara (منارة)

Physics teaching platform for Mohamed Nasr. Angular app backed by Supabase.
Live: https://yosef-tamer206.github.io/manara-education/

## Structure

```
src/
  styles/            global styles, one file per concern (base, pages, home, motion)
  assets/            images used by the styles
  app/
    core/            services (Supabase, session, toast, busy, theme, scroll), models, constants
    layout/          header, footer, toast, busy badge
    auth/            login / signup / password reset modal
    home/            public home page: catalog service, course carousel, latest lessons
    student/         student dashboard, course page, lesson page (video, quiz, homework)
    teacher/         teacher panel: students, courses and lessons, quiz manager, homework, announcements
    shared/          video embed, link pipe, scroll-reveal directive
public/              static files (images, test-payment.html)
```

## Run

```
npm install
npm start                                   # dev server
npx ng build --base-href /manara-education/ # production build in dist/manara/browser
```

Routes use the URL hash (`#/me`, `#/teacher`, `#/course/:id`, `#/lesson/:id`) so GitHub Pages needs no rewrites.
Pushing to `main` builds and deploys through `.github/workflows/deploy.yml`
(Settings > Pages > Source must be "GitHub Actions").
