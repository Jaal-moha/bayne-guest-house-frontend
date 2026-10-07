---
name: verify
description: Launch the Almis Hotel admin frontend (Next.js Pages Router) against the real NestJS backend and a throwaway Postgres, then drive it in headless Chromium from JSON specs that print one fixed-format line per step. Use to prove a UI change works (login, roles and nav, bookings, guests, rooms, page layout) before calling it done, to reproduce a UI bug, or to rerun the UI health suite.
---

# Verify the Almis Hotel frontend

The surface is a browser admin app. One script does everything. Each subcommand prints fixed-format lines and exits `0` on success and `1` on failure. Branch on the exit code and the first word of each line, never on prose or screenshots.

```bash
S=.claude/skills/verify/scripts/control.sh   # run from the repo root
```

## Launch

```bash
$S up
```

`up` installs `node_modules` if `next` is missing and puts `playwright-core` in `.verify/tools/`. It then starts the backend through the backend repo's own verify skill, under the same `VERIFY_ID` (default `frontend`), with CORS opened for the web origin. Last, it starts `next dev --turbopack` on `127.0.0.1` with `NEXT_PUBLIC_API_BASE` and `NEXT_PUBLIC_API_BASE_URL` pointed at that backend. The first run takes about 20 seconds, and later runs reuse the backend build.

| First line | Meaning | Do this |
| --- | --- | --- |
| `READY web=<url> api=<url> rev=<sha> evidence=<dir>` | Up and checked. | Drive. Use no other URL. |
| `FAIL backend-missing want=<path>` | The backend repo isn't next to this one. | Set `BACKEND_DIR=<path to bayne-guest-house-backend>` and rerun `up`. |
| `FAIL web-busy pids=<pids>` | Another `next dev` runs in this checkout and shares `.next`. | Stop it if you started it. Otherwise ask the user. Never kill it by name. |
| `FAIL backend-up <line>` | The backend skill failed. | Read the step and log named in `<line>`. |
| `FAIL cors …` | The reused backend allows a different origin. | `$S down && $S up` |
| `FAIL npm-ci`, `install-playwright`, `web-exited`, `web-timeout`, `no-chromium` | A local setup step failed. | Read the `log=` file it names, or set `CHROMIUM=<binary>`. |

`up` is idempotent. A healthy instance prints `READY` again. The web port is kept in `.verify/web-port-$VERIFY_ID` so the backend's CORS origin stays valid across restarts. Give each worktree its own `VERIFY_ID`, such as `VERIFY_ID=owner-ux-1`, so instances in separate worktrees get separate backends, databases and ports. Every subcommand reads it, so export it once per shell. `next dev` hot-reloads, so code edits need no restart. Only one web instance can run per checkout, because `.next` can't be shared.

## Doctor

```bash
$S doctor
```

It's read-only. It prints `OK|FAIL` for `web-pid`, `web-port-owner` (the listener belongs to our process group), `web-login`, `backend` (the backend's own doctor), `cors` and `browser`. Then it prints an `OK rev` line and `DOCTOR PASS web=… api=…` or `DOCTOR FAIL`. Run it first whenever anything looks off. On `DOCTOR FAIL`, run `$S down && $S up`.

## Drive

```bash
$S suite                      # every spec in specs/, one SPEC line each, then SUITE pass= fail= xfail= xpass=
$S suite 'bookings-*'         # a glob over spec names
$S drive bookings-create      # one spec by name, by path, or as inline JSON
$S api call --expect 200 reception GET /bookings   # passthrough to the backend skill: call, last, sql, token
```

A spec is a JSON file in [`specs/`](specs/). Copy the closest one and change it. Don't write ad-hoc Playwright.

```json
{
  "name": "rooms-edit-price",
  "role": "manager",
  "viewport": "desktop",
  "knownBug": "optional; present only while the defect is unfixed",
  "failApi": ["GET /bookings"],
  "setup": [{ "as": "manager", "method": "POST", "path": "/rooms", "body": {"number": "E${RUN}", "type": "single", "price": 900}, "expect": 201, "save": "ROOM" }],
  "steps": [{ "goto": "/rooms" }, { "click": "tr:has-text('E${RUN}') >> role=button[name='Edit']" }]
}
```

- **`role`** is any backend role, or `anon`. The driver gets the role's JWT from the backend skill and puts it in `localStorage.token` before the first page loads, so the app starts signed in. Only `login-*` specs go through the real login form.
- **`viewport`** is `desktop` (1280x800) or `phone` (390x844).
- **`setup`** creates data through the real API before the browser opens. Each entry runs `api call --expect`. `save` stores `api last .id`, or the `pick` jq path, in a variable.
- **Variables.** `${RUN}` is unique per drive, so names never collide across reruns. `${DATE+N}` is today plus N days as `yyyy-mm-dd`. `${NAME}` is a saved setup value or an environment variable.
- **`failApi`** answers matching browser requests with HTTP 500. Use it only to verify error states. Every other request reaches the real backend.
- **Targets.** A string is a Playwright selector. An object is `{"label": "Full name"}`, `{"role": "button", "name": "Add Room"}`, `{"placeholder": "Number"}` or `{"text": "…"}`, all exact matches. Object targets search inside the open modal first, so a page button and a modal button with the same name resolve correctly. `label` works with or without `htmlFor`.
- **Steps.** `goto`, `click`, `fill` + `value`, `select` + `value` (option value or label), `press`, `wait`, `screenshot`. Assertions are `expectText`, `expectNoText`, `expectVisible`, `expectHidden`, `expectValue` + `value`, `expectUrl` (exact pathname), `expectTitle`, `expectApi` (`"POST /bookings 201"`, query ignored), `expectNoApi`, `expectNoPageErrors`, `expectFits` (no horizontal scroll), and `apiCheck` (`{"as", "path", "jq", "expect"}`, an independent backend read).

Output of `drive`, one line each:

| Line | Meaning |
| --- | --- |
| `SETUP NN OK …` / `SETUP FAIL …` | A setup call and its result. A failed setup stops before the browser opens. |
| `STEP NN OK …` / `STEP NN FAIL … :: <reason>` | Each step. The first failure stops the run. |
| `API <METHOD> <path> <status>` | Every request the page sent to the backend. |
| `PAGEERRORS <n>` | Uncaught exceptions on the page. |
| `EVIDENCE <dir>` | Screenshots and `result.json` for this drive. |
| `RESULT PASS` (exit 0) | Every step held. |
| `RESULT FAIL` (exit 1) | A step or setup failed. Read the `FAIL` line. |
| `RESULT XFAIL` (exit 0) | A `knownBug` spec still fails. The defect is unfixed, as expected. A `KNOWN_BUG` line names it. |
| `RESULT XPASS` (exit 1) | A `knownBug` spec passed. Do what the `NEXT` line says: delete `knownBug` so the spec guards the fix. |

When you fix a defect that has a `knownBug` spec, the fix is proven only when that spec reports `XPASS` and then `PASS` once `knownBug` is removed. When you change a flow, run its feature's specs. Before you call UI work done, run `$S suite` and require `fail=0 xpass=0`.

The [feature map](features/README.md) lists every spec by feature and the paths no spec covers yet. Start there.

## Evidence

Each drive writes `.verify/evidence/<up-timestamp>/<NNN>-<spec>/`. It holds `final.png` or `failure.png`, any named screenshots, and `result.json`. That file records the spec, role, every step, every API request with status and request body, console errors, page errors and the result. `setup` and `apiCheck` calls also land in the backend's evidence directory. `down` copies `web.log` next to them. `.verify/` is gitignored.

A proof needs all of these.

- The user path in the browser, as the role that would use it. Never create the thing under test in `setup`. Setup is only for preconditions.
- The action's request (`expectApi`) plus an independent read of the result (`apiCheck`, or text that only the saved data can produce).
- A `failApi` spec when the change touches loading or error states, and a disallowed `role` when it touches role gates.
- The `EVIDENCE` paths cited in your report.

## Cleanup

```bash
$S down
```

It kills only the process group recorded at `up`, after checking that its cwd is this repo and its cmdline is `next dev`. It runs the backend skill's `down`, which stops Postgres and deletes the database, then removes `.verify/run-$VERIFY_ID/` and prints `DOWN ok evidence=<dir>`. Evidence survives. It's safe to run when nothing is up and prints `DOWN nothing-running`. Run it at the end of every session, including after a failed `up`.

## Helpers

- `scripts/control.sh` is the entry point. It needs `node`, `npm`, `curl`, `ss`, `pgrep`, a Chromium binary and the backend repo.
- `scripts/drive.mjs` runs one spec. `control.sh drive` and `suite` call it with the instance's environment. Don't call it directly.
