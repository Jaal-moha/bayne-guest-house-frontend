# Rooms

Managers and reception add rooms with a number, type and nightly price, and change them later. The table shows each room's price.

## Sub-features

- `rooms-create` adds a room from the Add Room modal.
- `rooms-edit-price` opens a room prefilled, changes its price and saves it.

## How to get to it (user POV)

- Sidebar, then Rooms, then Add Room, or the Edit button on a row (admin, reception, manager).

## Driving it with control.sh

Preconditions:

- The baseline from the README holds.

- **Create.** Run `$S drive rooms-create`. It requires `API POST /rooms 201`, the row `R${RUN}`, and an `apiCheck` that the stored price is `3200`.
- **Edit price.** Run `$S drive rooms-edit-price`. It requires the Number field prefilled, `API PATCH /rooms/<id> 200`, the text `ETB\u00a01,100.00`, and an `apiCheck` on `GET /rooms/<id>`.

## Gotchas

- The room inputs have no labels, so target them by placeholder: `Number`, `Type (Single/Double/Suite…)` and `Price (e.g. 75)`. The ellipsis is a single `…` character.
- Room numbers are unique in the database. Always include `${RUN}`.
- `lib/format.ts` `money()` prints prices as `ETB 1,100.00` with a no-break space (U+00A0) after `ETB`. Write it as `\u00a0` in a spec, since `expectText` compares raw page text.
- `$S drive format-rooms-birr` checks the rooms table as manager.
