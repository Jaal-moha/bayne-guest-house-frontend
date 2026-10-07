# App shell

The shell is the sidebar, the header with the user's name and Logout, and the content area that every signed-in page renders inside. It also covers what the root URL shows.

## Sub-features

- `root-url` should show the app or redirect into it. Today `/` serves the create-next-app starter page from `src/app/page.tsx`.
- `phone-layout` should fit a 390px screen. Today the fixed `w-64` sidebar pushes Logout and table actions off-screen.

## How to get to it (user POV)

- Open the site's root URL.
- Open any signed-in page on a phone or a narrow window.

## Driving it with control.sh

Preconditions:

- The baseline from the README holds.

- **Root URL.** Run `$S drive root-is-app`. It reports `RESULT XFAIL` while the page contains `Get started by editing`.
- **Phone width.** Run `$S drive shell-phone-fits`. It reports `RESULT XFAIL` with `page is <n>px wide in a 390px viewport` while the layout overflows.

## Gotchas

- `expectFits` compares `document.documentElement.scrollWidth` with the viewport width. A table inside `overflow-x-auto` scrolls on its own and doesn't count as overflow.
- No signed-in page sets a `<title>`, so `expectTitle` fails everywhere except `/login`.
