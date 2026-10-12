# Staff

Admins and managers list staff, add and edit them, upload a passport photo for the ID card, and open the ID card PDF. The ID card is one A4 sheet with crop marks that the user prints at actual size, cuts, folds and laminates. Each row shows the staff photo as a small thumbnail, or initials without one.

## Sub-features

- Add staff with or without an account: `staff-create-retry`, `staff-created-keeps-password`.
- Modals close on Escape without saving: `staff-modal-escape`.
- Photo upload, preview and table thumbnail in Edit Staff, with no photo request for rows without one: `staff-photo`.
- Removing the photo: `staff-photo-remove`.
- A rejected photo upload shows the API message and keeps the old state: `staff-photo-reject`.
- ID card preview with print guidance, Download and Print: `staff-id-card`.
- Load error: `staff-load-error`.

## How to get to it (user POV)

Sign in as admin or manager and open Staff in the nav. Edit opens the details and the photo controls. ID card opens the PDF preview.

## Driving it with control.sh

`$S suite 'staff-*'`. The photo specs upload `fixtures/headshot.jpg` with the `upload` step.

## Gotchas

- The file input is hidden behind the Choose photo button, so target it as `input[type=file]`.
- The thumbnail and the edit preview load through axios as blobs, so assert on `img[alt='Photo of <name>']`, not on an API URL in `src`.
- The Print button opens the browser print dialog, which headless Chromium cannot show. No spec clicks it.
- Download takes its filename from `Content-Disposition`. The browser only exposes that header cross-origin when the backend lists it in CORS `exposedHeaders`, otherwise the name falls back to `staff-<id>.pdf`.
