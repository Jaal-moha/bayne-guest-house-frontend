# Almis Hotel frontend verification map

This directory is the maintained source for verifying what front-desk, finance and management staff do in the browser. Read this index first, then use the matching feature file. Each recipe is a spec in `../specs/`, so verifying a feature means running its specs and reading the result lines.

## Baseline preconditions

- `$S up` printed `READY` and `$S doctor` printed `DOCTOR PASS`, with `S=.claude/skills/verify/scripts/control.sh` run from the repo root.
- The database starts empty except for the seeded `admin@example.com` / `admin123` user. Specs create what they need in `setup` and name it with `${RUN}`. Never hardcode ids or rely on data from another spec.
- Never drive an instance this run didn't `up`.

## Driving conventions

- Run a feature with `$S suite '<prefix>-*'`, or one spec with `$S drive <name>`.
- To cover a new path, copy the closest spec, change it and run it. Add it to `../specs/` and to the feature file below.
- Prefer object targets (`label`, `role` + `name`, `placeholder`) over CSS selectors. Use a CSS or `tr:has-text(...)` selector only to pick a table row.
- Specs mutate the database. For a clean baseline run `$S down && $S up`.

## Proof and skip reporting

- A proof is a `RESULT PASS` drive whose steps include the user action, its `expectApi` line and an `apiCheck` or data-derived text check.
- A defect fix is proven by its `knownBug` spec going `XPASS`, then `PASS` after the flag is removed.
- Report the `EVIDENCE` paths. A path no spec covers is reported as unverified, with the spec you would need, never as verified through a neighbouring spec.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then has exactly four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with control.sh`, and `Gotchas`.

## Features

- [Login and roles](./login-and-roles.md) covers sign-in, the post-login landing page, and which nav links and pages each role gets.
- [Bookings](./bookings.md) covers creating a booking from the bookings page, its load error state and its modal.
- [Guests](./guests.md) covers adding a guest and editing one.
- [Rooms](./rooms.md) covers adding a room and changing its price.
- [App shell](./app-shell.md) covers the root URL, page titles, the phone menu and the layout at phone and tablet widths.
- [List load errors](./list-load-errors.md) covers the loading, error, access-denied and empty states of every list page.

## Driver self-tests

`driver-noapi-prefix` and `driver-noapi-inflight` check the driver, not the app. They keep `knownBug` and stay `XFAIL`. `XPASS` on either means `expectNoApi` went blind again, so fix `scripts/drive.mjs` instead of removing the flag.

## Not yet mapped

These pages exist but have no spec yet. Write one before claiming them verified: payments (record payment, unpaid bookings), inventory (items, stock movements, history), laundry, attendance, staff (create with account, ID card), the dashboard stats and date range, and bookings edit.
