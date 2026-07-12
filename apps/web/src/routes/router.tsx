import { createBrowserRouter, Navigate } from 'react-router-dom';

import { RootLayout } from './root-layout';
import { RequireAuth } from './require-auth';
import { LoginRoute } from './login';
import { RegisterRoute } from './register';
import { ForgotPasswordRoute } from './forgot-password';
import { ResetPasswordRoute } from './reset-password';
import { VerifyEmailRoute } from './verify-email';
import { DashboardRoute } from './dashboard';
import { LibraryRoute } from './library';
import { SetDetailRoute } from './set-detail';
import { SetStudyRoute } from './set-study';
import { ClassroomRoute } from './classroom';
import { ProgressRoute } from './progress';
import { DiscoverRoute } from './discover';
import { ProfileRoute } from './profile';
import { DemoRoute } from './demo';
import { NotFoundRoute } from './not-found';

/**
 * Route tree — mirrors TDD §11.1 and SRS §5 screen list.
 *
 *  Public:      /login, /register
 *  Authenticated:  /            → Dashboard
 *                  /library     → user's sets & folders
 *                  /sets/:id    → set detail / editor
 *                  /sets/:id/study/:mode  → active study session
 *                  /classroom   → teacher / student classroom
 *                  /progress    → learner analytics
 *                  /discover    → public set search
 *                  /profile/:username     → public profile
 */
export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  { path: '/login', element: <LoginRoute /> },
  { path: '/register', element: <RegisterRoute /> },
  { path: '/forgot-password', element: <ForgotPasswordRoute /> },
  { path: '/reset-password', element: <ResetPasswordRoute /> },
  { path: '/auth/verify-email', element: <VerifyEmailRoute /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <RootLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardRoute /> },
      { path: 'library', element: <LibraryRoute /> },
      { path: 'sets/:setId', element: <SetDetailRoute /> },
      { path: 'sets/:setId/study/:mode', element: <SetStudyRoute /> },
      { path: 'classroom', element: <ClassroomRoute /> },
      { path: 'progress', element: <ProgressRoute /> },
      { path: 'discover', element: <DiscoverRoute /> },
      { path: 'profile/:username', element: <ProfileRoute /> },
      { path: 'demo', element: <DemoRoute /> },
      { path: '*', element: <NotFoundRoute /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
