## Imba learn

This app is a Quizlet-inspired study tool. The app lets you create and manage study modules, add terms, and practice with flashcards, quizzes, tests, and a learn flow. It connects to the hosted API at `https://imba-server.up.railway.app` using cookie-based login. The website is deployed at `https://imba-learn.vercel.app`

### What You Can Do

- Sign up and log in.
- Create your own modules with titles, descriptions, and privacy toggles.
- Add, edit, star, and delete terms inside a module.
- Study in multiple modes: flashcards, quiz, and test.
- Browse your dashboard for personal modules and a community tab for shared sets.
- Update account details (profile info, password) or delete your account.

### Project Goal

Provide a focused, modern reimagining of Quizlet: fast navigation, clear UI, and practice modes that make repetition and recall easy.

### Quick Start

- Install deps: `npm install`
- Run dev server: `npm run dev`
- App runs at `http://localhost:3000`

The API base URL lives in `lib/axios.ts`. Change it if you point to a different backend; keep cookies enabled so login works.

### A Peek at the Stack

- Built with Next.js App Router, React, and TypeScript.
- Styling with Tailwind CSS and Radix UI building blocks.
- Forms and validation with React Hook Form + Zod.
- Data fetching with TanStack Query and Axios (requests include credentials for auth).

### Structure (simple view)

- `app/` – routes for auth, dashboard, modules, and study modes.
- `components/` – shared UI, module cards, dialogs, forms, settings pieces.
- `contexts/` – auth context.
- `lib/` – API client, REST helpers, auth utilities, hooks, providers.
- `public/` – static assets.

### Deployment

1. `npm run build`
2. `npm run start` in production mode.

