# Payments

Reception, finance and managers record a payment against an unpaid booking from the Payments page. The form computes nights times rate, takes an optional amount, a method and a status. A booking leaves the Unpaid tab only when its payment's status is `paid`. Every amount in the app prints in birr through `money()` in `lib/format.ts`, and every date through `date()` or `dateTime()`.

## Sub-features

- `payments-record` records a paid cash payment with the computed amount.
- `payments-invalid-amount` blocks `-5` and `0` with a field error and sends no request.
- `payments-failed-stays-unpaid` records a `failed` payment from the Unpaid tab and requires the booking to stay listed.
- `payments-unpaid-status` records status `unpaid`, the value of the backend `PaymentStatus` enum.
- `payments-laundry-guest` shows the guest of a laundry payment, which has no booking.
- `format-dashboard-birr`, `format-rooms-birr`, `format-bookings-dates` and `format-inventory-datetime` check birr and date text on the dashboard, rooms, bookings and inventory pages.

## How to get to it (user POV)

- Sidebar, then Payments (admin, manager, reception, finance). Record Payment on the Payments tab, or Record on a row of the Unpaid Bookings tab.

## Driving it with control.sh

Preconditions:

- The baseline from the README holds.

- **Payments.** Run `$S suite 'payments-*'`. Each record spec requires `API POST /payments 201` and an `apiCheck` on `/payments` or `/bookings?unpaid=true`.
- **Formatting.** Run `$S suite 'format-*'`.

## Gotchas

- `money()` puts a no-break space (U+00A0) after `ETB`. Write `ETB 1,500.00` in a spec.
- `date()` formats in UTC so a check-in stored at UTC midnight keeps its calendar day. `dateTime()` uses the browser's time zone.
- Creating a laundry record also creates its payment, so a laundry payment needs only `POST /laundry` with a `price` in setup.
- A booking with a failed payment stays unpaid, but the backend refuses a second payment for it (`Payment already exists for this booking`).
- The backend's `POST /payments` takes `body: any`, so it does not validate `method` or `status` today. Assert stored values with `apiCheck`, not just the 201.
