# Bookings

Reception picks a guest, a date range and an available room, then creates a booking. The bookings table lists every booking with its payment state.

## Sub-features

- `bookings-create` creates a booking from the Create Booking modal and shows a success toast and the new row.
- `bookings-available-rooms` loads rooms for the chosen dates from `GET /rooms/available` before a room can be picked.
- `bookings-load-error` shows `Couldn't load bookings` and Retry when the list fails to load. See [List load errors](./list-load-errors.md).
- `bookings-modal-escape` should close the modal on Escape. Today it doesn't.

## How to get to it (user POV)

- Sidebar, then Bookings, then the Create Booking button (admin, reception, manager).
- Dashboard, then New Booking, which opens a separate three-step stepper. It isn't mapped yet.

## Driving it with control.sh

Preconditions:

- The baseline from the README holds.

- **Create.** Run `$S drive bookings-create`. Setup creates room `V${RUN}` and guest `Guest ${RUN}`. The spec fills the modal as reception and requires `API POST /bookings 201`, the toast `Booking created successfully`, the new row, and an `apiCheck` that a booking with that guest and room exists.
- **Load error.** Run `$S drive bookings-load-error`. `failApi` makes `GET /bookings` return 500. It requires `Couldn't load bookings`, a Retry button and no `No bookings.`.
- **Escape.** Run `$S drive bookings-modal-escape`. It reports `RESULT XFAIL` while the `Create Booking` heading stays visible after Escape.

## Gotchas

- The room select stays disabled until both dates are set, and its options arrive asynchronously. The `select` step waits up to 10 seconds for the option to appear.
- The page button and the modal's submit button are named `Create Booking` and `Create`. Object targets search the open modal first.
- Dates are sent as midnight UTC (`2026-11-16T00:00:00.000Z`). Use `${DATE+N}` with N of 30 or more so ranges don't collide with today-based stats.
- The same booking logic exists in three places: this page, `components/BookingStepper.tsx` and the unreachable modal in `pages/guests/index.tsx`. A spec for one doesn't verify the others.
