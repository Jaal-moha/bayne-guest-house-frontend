# Guests

Reception keeps guest profiles with a name, phone and email, searches them and opens a guest to edit.

## Sub-features

- `guests-create` adds a guest from the Add Guest modal, and the new row appears.
- `guests-edit` should open the selected guest's details. Today it opens an empty Add Guest form.

## How to get to it (user POV)

- Sidebar, then Guests, then Add Guest (admin, manager, reception).
- The Edit button on a guest row.
- The "New guest" tab in the dashboard's booking stepper. It isn't mapped yet.

## Driving it with control.sh

Preconditions:

- The baseline from the README holds.

- **Create.** Run `$S drive guests-create`. It requires `API POST /guests 201`, the row `Walk-in ${RUN}`, and an `apiCheck` that the guest exists.
- **Edit prefill.** Run `$S drive guests-edit-prefill`. It reports `RESULT XFAIL` while the Full name field is empty after Edit.

## Gotchas

- The page and the modal both have an `Add Guest` button. `{"role": "button", "name": "Add Guest"}` clicks the page button when no modal is open and the modal's submit button when one is.
- The form doesn't require a phone, but the backend does (3 to 30 characters). An empty phone sends `{"name": …}`, gets `API POST /guests 400`, and shows the backend's validation message in the modal's red box.
- The guests page also holds a booking modal and a payment modal that report through `alert()`. Nothing opens them, and Playwright auto-dismisses dialogs, so ignore them unless a change wires them up.
