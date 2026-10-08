# Bookings

Reception creates a booking in one three-step flow, `components/BookingFlow.tsx`. Step 1 picks an existing guest or types a new one. Step 2 picks dates and an available room. Step 3 reviews and creates. The bookings table lists every booking with its payment state.

## Sub-features

- `bookings-create` creates a booking for an existing guest and shows a success toast and the new row.
- `bookings-new-guest` creates the guest and the booking at the final step, one `POST /guests` then one `POST /bookings`.
- `bookings-back-no-dup` fails the first `POST /bookings`, goes Back, edits the guest and retries. The retry PATCHes the guest it already created.
- `bookings-dates` shows a field error for a past check-in and a zero-night stay, and sends neither `GET /rooms/available` nor `POST /bookings`.
- `dashboard-new-booking` opens the same flow from the dashboard New Booking button as manager.
- `bookings-available-rooms` loads rooms for the chosen dates from `GET /rooms/available` before a room can be picked.
- `bookings-load-error` shows `Couldn't load bookings` and Retry when the list fails to load. See [List load errors](./list-load-errors.md).
- `bookings-modal-escape` closes the modal on Escape.

## How to get to it (user POV)

- Sidebar, then Bookings, then the Create Booking button (admin, reception, manager).
- Dashboard, then New Booking (reception, manager). It opens the same flow.

## Driving it with control.sh

Preconditions:

- The baseline from the README holds.

- **Create.** Run `$S drive bookings-create`. Setup creates room `V${RUN}` and guest `Guest ${RUN}`. The spec walks the three steps as reception and requires `API POST /bookings 201`, the toast `Booking created successfully`, the new row, and an `apiCheck` that a booking with that guest and room exists.
- **New guest, retry, dates, dashboard.** Run `$S suite 'bookings-*'` and `$S drive dashboard-new-booking`.
- **Create on a phone.** Run `$S drive bookings-create-phone`. It runs the same flow at 390px and checks `expectFits` before opening the modal, at the review step, and after the new row lands, so Create Booking stays on screen and the table scrolls inside its card.
- **Load error.** Run `$S drive bookings-load-error`. `failApi` makes `GET /bookings` return 500. It requires `Couldn't load bookings`, a Retry button and no `No bookings.`.
- **Escape.** Run `$S drive bookings-modal-escape`.

## Gotchas

- The room select stays disabled until both dates are set and valid, and its options arrive asynchronously. The `select` step waits up to 10 seconds for the option to appear.
- The page button is `Create Booking` and the flow's final button is `Create booking`. Object targets match exactly and search the open modal first.
- Dates are sent as midnight UTC (`2026-11-16T00:00:00.000Z`). Use `${DATE+N}` with N of 30 or more so ranges don't collide with today-based stats.
- `${DATE-1}` is yesterday. The driver's offset syntax has no `+-`.
