# App shell

The shell is the sidebar, the header with the user's name and Logout, and the content area that every signed-in page renders inside. It also covers what the root URL shows and each tab's title. Below the `md` breakpoint (768px) the sidebar hides behind a Menu button in the header and opens as an overlay with Logout at its foot.

## Sub-features

- `root-url` redirects `/` to `/login` when signed out and to the role's first page when signed in. `pages/index.tsx` does the redirect.
- `titles` sets each tab to "<Page> · Almis Hotel". `Layout` reads the label from `PAGES` in `lib/permissions.ts`, so a new page gets its title from its table row.
- `phone-menu` opens the sidebar from the Menu button. Escape, a backdrop click and choosing a page close it.
- `phone-layout` and `tablet-layout` fit 390px and 768px screens. Page headers wrap, and wide tables scroll inside their card.

## How to get to it (user POV)

- Open the site's root URL.
- Open any signed-in page on a phone or a narrow window, then tap Menu.

## Driving it with control.sh

Preconditions:

- The baseline from the README holds.

- **Root URL.** Run `$S drive root-is-app`. It reports `RESULT PASS` when admin lands on `/dashboard` and the create-next-app starter text is absent.
- **Titles.** Run `$S drive titles`. It visits all nine pages and checks each `expectTitle`.
- **Phone menu.** Run `$S drive shell-phone-menu`. It opens the menu, closes it with Escape and with a backdrop click, navigates to Rooms through it, and logs out through it. `menu.png` shows the open menu.
- **Phone and tablet width.** Run `$S drive shell-phone-fits` for reception on bookings, `$S drive shell-phone-pages` for admin on all nine pages and the Unpaid Bookings tab, and `$S drive shell-tablet-fits` for the same at 768px.

## Gotchas

- `expectFits` fails when the page scrolls sideways or when any visible button, link or form control outside a `<table>` lies outside the viewport. The content area is `overflow-auto`, so a header button pushed off-screen doesn't widen the page. The control check is what catches it.
- Two Logout buttons exist. The header one shows at `md` and up, the menu one below. Only one is in the accessibility tree at a time, so `{"role": "button", "name": "Logout"}` resolves at any width.
