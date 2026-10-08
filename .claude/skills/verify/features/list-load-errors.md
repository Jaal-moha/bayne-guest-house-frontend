# List load errors

Every list page loads its rows through `lib/useList.ts` and renders them through `components/ListState.tsx`. While the request runs the page shows `Loading…`. A failed request shows `Couldn't load <list>` and a Retry button. A 403 shows `You don't have access to this list` instead. The page's empty text, such as `No bookings.`, shows only after a successful load that returned zero rows.

## Sub-features

- `<page>-load-error` fails the page's list call with `failApi` and requires the error text, the Retry button, no empty text, no raw server message and no page errors. One spec exists for each of dashboard, bookings, guests, rooms, laundry, attendance, inventory, payments and staff.
- `laundry-housekeeping` signs in as housekeeping with one seeded laundry record. The record shows with its guest name although `GET /guests` returns 403, and the page has no errors. Before UX-2 the combined load rejected and the page said `No laundry records.`.
- `laundry-guests-forbidden` signs in as housekeeping, who can see laundry but gets 403 on `GET /guests`. The laundry list loads, and the Add Laundry modal's guest list shows the access message.

## How to get to it (user POV)

- Open any page in the sidebar while the backend is down or the list call fails.
- As housekeeping, open Laundry, then `+ Add Laundry`.

## Driving it with control.sh

Preconditions:

- The baseline from the README holds.

- **All pages.** Run `$S suite '*-load-error'`. Each spec prints `RESULT PASS` and `PAGEERRORS 0`.
- **Housekeeping laundry.** Run `$S drive laundry-housekeeping`. It requires `API GET /laundry 200`, `API GET /guests 403`, the seeded record and `PAGEERRORS 0`.
- **403.** Run `$S drive laundry-guests-forbidden`. It requires `API GET /guests 403` and the access message in the modal.

| Spec | Role | Failed call | Error text |
| --- | --- | --- | --- |
| `dashboard-load-error` | admin | `GET /stats/overview` | Couldn't load dashboard stats |
| `bookings-load-error` | reception | `GET /bookings` | Couldn't load bookings |
| `guests-load-error` | reception | `GET /guests` | Couldn't load guests |
| `rooms-load-error` | manager | `GET /rooms` | Couldn't load rooms |
| `laundry-load-error` | manager | `GET /laundry` | Couldn't load laundry records |
| `attendance-load-error` | reception | `GET /attendance` | Couldn't load attendance records |
| `inventory-load-error` | store | `GET /inventory` | Couldn't load inventory |
| `payments-load-error` | finance | `GET /payments` | Couldn't load payments |
| `staff-load-error` | manager | `GET /staff` | Couldn't load staff |

## Gotchas

- `failApi` stays on for the whole drive, so no spec can prove that Retry recovers once the API is back. A spec can click Retry, and `result.json` then lists a second failed request. Recovery is unverified until the driver can lift a failure mid-spec.
- `failApi` matches by path prefix. `GET /laundry` also fails `GET /laundry/statuses`, which the backend doesn't serve anyway.
- No page that finance can reach returns 403, so the 403 recipe uses housekeeping.
- A reload keeps the current rows on screen. Only a page that is loading for the first time or showing an error switches to `Loading…`.
