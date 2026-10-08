# Guests

Reception keeps guest profiles with a name, phone and email, searches them and opens a guest to edit.

## Sub-features

- `guests-create` adds a guest from the Add Guest modal, and the new row appears.
- `guests-edit-prefill` opens Edit on a row and finds the form filled with that guest.
- `guests-edit-save` changes a guest through Edit Guest, and the row updates without adding a guest.
- `guests-phone-required` clears the phone in Edit Guest and gets a field message with no request sent.
- `guests-edit-fail` fails the save and keeps Edit Guest open with the typed name.

## How to get to it (user POV)

- Sidebar, then Guests, then Add Guest (admin, manager, reception).
- The Edit button on a guest row.
- The "New guest" tab in the dashboard's booking stepper. It isn't mapped yet.

## Driving it with control.sh

Preconditions:

- The baseline from the README holds.

- **Create.** Run `$S drive guests-create`. It requires `API POST /guests 201`, the row `Walk-in ${RUN}`, and an `apiCheck` that the guest exists.
- **Edit prefill.** Run `$S drive guests-edit-prefill`. It requires the Full name field to hold the row's name after Edit.
- **Edit save.** Run `$S drive guests-edit-save`. It requires `API PATCH /guests/${GID} 200`, no `POST /guests`, the new email in the row, an `apiCheck` on `/guests/${GID}`, and an `apiCheck` that the guest count is unchanged.
- **Phone required.** Run `$S drive guests-phone-required`. It requires "Phone is required", the modal still open, no `PATCH /guests/${GID}` request, and an `apiCheck` that the phone is unchanged.
- **Edit fail.** Run `$S drive guests-edit-fail`. It fails `PATCH /guests/` and requires `API PATCH /guests/${GID} 500`, the "Couldn't save guest" toast, the modal still open with the typed Full name, and an `apiCheck` that the name is unchanged.

## Gotchas

- The page and the modal both have an `Add Guest` button. `{"role": "button", "name": "Add Guest"}` clicks the page button when no modal is open and the modal's submit button when one is.
- Phone is required with 3 to 30 characters, as in the backend DTO. An empty or short phone shows a message under the field and sends no request.
- A failed save shows an error toast and keeps the modal open with the typed values. A 4xx toast shows the backend's message, and any other failure shows "Couldn't save guest".
- `failApi` matches by URL prefix, so fail edits with `"PATCH /guests/"`, not a glob.
- Edit Guest's submit button is `Save changes`. Add Guest's is `Add Guest`.
