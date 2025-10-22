# Rooms Management

- View all rooms at `/rooms`.
- Click "Add Room" to create a new room.
- Click "Edit" on a row to update a room's number, type, and price.

API assumptions:

- Create: `POST /rooms` with `{ number, type, price }`.
- Update: `PATCH /rooms/:id` with `{ number, type, price }`.
- List: `GET /rooms` (returns an array or `{ rooms: [...] }`).

If your API differs (e.g., expects `PUT` or a different payload/shape), update `pages/rooms/index.tsx` accordingly.

