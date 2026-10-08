# Login and roles

Staff sign in with email and password and land on the dashboard. The sidebar shows only the pages their role may use, and opening a page outside the role sends them back to the dashboard.

## Sub-features

- `login-success` signs in through the form and lands on `/dashboard` with the user's name in the header.
- `login-error` keeps the user on `/login` and shows the API's message after a wrong password.
- `nav-by-role` shows or hides sidebar links per role, using the menu in `components/Layout.tsx`.
- `page-guard` redirects a role that a page's `RequireAuth roles` list excludes.
- `role-landing` lands each role somewhere usable after login. This is broken for store, barista, housekeeping and security.

## How to get to it (user POV)

- Open `/login`, fill Email and Password, and press Sign in.
- Click sidebar links after sign-in.
- Type a page URL directly.

## Driving it with control.sh

Preconditions:

- The baseline from the README holds.

- **Sign in.** Run `$S drive login-admin`. `RESULT PASS` with `API POST /auth/login 201`, then `API GET /auth/me 200`, and the step `expectText "Welcome, Admin"`.
- **Wrong password.** Run `$S drive login-wrong-password`. `RESULT PASS` with `API POST /auth/login 401` and the URL still `/login`.
- **Nav and guard.** Run `$S drive nav-roles-finance`. Finance sees Payments and not Staff, and `/staff` redirects to `/dashboard`.
- **Role landing.** Run `$S drive role-landing-store`. It reports `RESULT XFAIL` until the store role lands on a page that renders. The failing step is `expectVisible {"role":"link","name":"Inventory"}`.

## Gotchas

- Specs other than `login-*` skip the form. The driver puts the role's JWT in `localStorage.token`, which is where `AuthContext` reads it.
- Non-admin roles are created by the backend skill as `verify-<role>@example.com`. The header greets them as `Verify <role>`.
- `RequireAuth` redirects with `router.replace`, so assert with `expectUrl` and not with text from the page you left.
- `middleware.ts` only redirects `/`, and only when a cookie carries the role. The app stores the token in `localStorage`, so the middleware never fires in practice.
