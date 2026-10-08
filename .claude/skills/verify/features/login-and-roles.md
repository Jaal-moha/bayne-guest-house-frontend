# Login and roles

Staff sign in with email and password and land on the first page their role may use. One table, `PAGES` in `lib/permissions.ts`, decides the sidebar, every page guard, the login redirect and the `/` redirect. Opening a page outside the role sends the user to their landing page.

## Sub-features

- `login-success` signs in through the form and lands on the role's landing page, `/dashboard` for admin, with the user's name in the header.
- `login-error` keeps the user on `/login` and shows the API's message after a wrong password.
- `nav-by-role` shows the sidebar links `pagesFor(role)` returns, in `PAGES` order.
- `page-guard` is `RequireAuth`. It reads `canSee(role, pathname)` and redirects a disallowed role to `landingFor(role) ?? '/'`. Every page renders `RequireAuth` around an inner component that owns the `useList` calls, so the redirect lands before any list request starts.
- `role-landing` sends each role to `landingFor(role)`. Store and barista land on `/inventory`, housekeeping on `/laundry`, and admin, manager, reception and finance on `/dashboard`. Security has no page and gets a "No pages for your role" screen at `/` with Logout.

## How to get to it (user POV)

- Open `/login`, fill Email and Password, and press Sign in.
- Click sidebar links after sign-in.
- Type a page URL directly.

## Driving it with control.sh

Preconditions:

- The baseline from the README holds.

- **Sign in.** Run `$S drive login-admin`. `RESULT PASS` with `API POST /auth/login 201`, then `API GET /auth/me 200`, and the step `expectText "Welcome, Admin"`.
- **Wrong password.** Run `$S drive login-wrong-password`. `RESULT PASS` with `API POST /auth/login 401` and the URL still `/login`.
- **Login page.** Run `$S drive login-page`. It checks the tab title, that "Forgot password?" and "Remember me" are gone, and with `expectNoRequest` that nothing loads from Google. `login.png` shows the local image.
- **Nav and guard.** Run `$S drive nav-roles-finance`. Finance sees Payments and not Staff, and `/staff` redirects to `/dashboard`.
- **Reception inventory.** Run `$S drive nav-roles-reception`. The sidebar's Inventory link opens `/inventory` and `GET /inventory` returns 200.
- **Guard before fetch.** Run `$S drive attendance-guard`, `$S drive laundry-store-guard` and `$S drive guests-store-guard`. Finance at `/attendance` lands on `/dashboard` with no `GET /attendance`. Store at `/laundry` or `/guests` lands on `/inventory` with no `GET /laundry` or `GET /guests`.
- **Role landing.** Run `$S suite 'role-landing-*'`. Store lands on `/inventory` and housekeeping on `/laundry`, each with no Dashboard link in the sidebar. Housekeeping and security never visit `/dashboard`, so a login redirect to `/dashboard` that `RequireAuth` bounces still fails the spec. The dashboard fetches inside `RequireAuth`, so `expectNoApi "GET /stats/overview"` can't catch that bounce. Security signs in to "No pages for your role" and Logout returns to `/login`.

## Gotchas

- Most specs skip the form. The driver puts the role's JWT in `localStorage.token` on the first load of the browser context, which is where `AuthContext` reads it. Later `goto` steps keep whatever token the page holds, so an `anon` spec can sign in through the form and then navigate.
- Non-admin roles are created by the backend skill as `verify-<role>@example.com` with password `verify-pass-<role>`, the first time any step needs that role's token. A form-login spec for such a role needs a `setup` step as that role, such as `GET /auth/me`, so the account exists. The header greets them as `Verify <role>`.
- `RequireAuth` redirects with `router.replace`, so assert with `expectUrl` and not with text from the page you left.
- Inventory and Laundry have an in-page "Dashboard" button that every role sees. Scope sidebar checks to `aside`, as in `"aside a:text-is(\"Dashboard\")"`.
- `expectHidden` passes at once when nothing matches, including before the sidebar renders. Keep it after an `expectVisible` that waits for a sidebar link.
