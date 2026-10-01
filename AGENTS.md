# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project overview

WonBet is a Spanish-language sports betting platform, deliberately built as a **simple, educational** microservices example — mirrored on a classroom reference project (an API gateway + two verifying services + SQLite, no ORM, no Docker). The priority for this codebase is that it stays easy to explain end-to-end, not that it scales or covers edge cases. When changing anything here, favor the same plain, one-file-per-concern style already in place over adding abstractions, config layers, or extra dependencies — the whole point of this version is that it's simple to defend/present.

There is a `_legacy-avanzado/` directory containing a previous, more advanced iteration of this project (Prisma + PostgreSQL + Docker Compose, separate `usuarios-service` with role-based JWT middleware). It is archived, not used to run the app — don't resurrect it unless the user explicitly asks to merge something back from it.

## Commands

Install once per service (no shared root `node_modules`):

```bash
npm install --prefix ms-usuarios
npm install --prefix ms-eventos
npm install --prefix ms-apuestas
npm install --prefix gateway
npm install   # root devDependency: concurrently
```

Run everything at once:

```bash
npm run start:all
```

Or individually (each is just `node index.js`, no nodemon/watch mode):

```bash
npm run start:usuarios    # ms-usuarios  :3001
npm run start:eventos     # ms-eventos   :3002
npm run start:apuestas    # ms-apuestas  :3003
npm run start:gateway     # gateway      :3000
npm run start:frontend    # frontend     :5500 (zero-dependency static server)
```

Open `http://localhost:5500` for the UI. There is no test runner, linter, or build step in this repo — don't assume `npm test` exists.

## Architecture

```
Cliente / frontend (:5500)
        │  fetch → siempre al gateway, nunca directo a un microservicio
        ▼
   API Gateway (:3000)  — SOLO enruta con http-proxy-middleware, no toca tokens
        │
   ┌────┼────────────────┐
   ▼    ▼                ▼
ms-usuarios (:3001)  ms-eventos (:3002)  ms-apuestas (:3003)
genera el JWT        verifica el JWT     verifica el JWT
en /login            por su cuenta       por su cuenta
```

- **`gateway/`** — pure reverse proxy (`http-proxy-middleware`). It never reads or verifies the `Authorization` header; it only forwards `/api/usuarios/*`, `/api/eventos/*`, `/api/apuestas/*` to the right port. Auth is entirely the downstream services' problem.
- **`ms-usuarios/`** — registers users (bcrypt-hashed password), logs in and **signs** the JWT (`jwt.sign({ correo, rol }, JWT_SECRET)`), and also verifies it on `/api/usuarios/perfil` using the same `middleware/auth.js` pattern the other services use.
- **`ms-eventos/`** — CRUD over sporting events (`nombre`, `cuota`, `estado: 'abierto'|'cerrado'`), all behind its own `verificarToken` middleware. Also exposes `GET /internal/eventos/:id` with **no auth** — that's the service-to-service channel.
- **`ms-apuestas/`** — creates bets. `POST /api/apuestas` verifies the caller's JWT, then calls `ms-eventos`'s internal endpoint directly (`fetch('http://localhost:3002/internal/eventos/:id')`, no token) to read the event's `cuota`/`estado`, rejects if it's `cerrado`, computes `ganancia_potencial = monto * cuota`, and stores the bet.
- **`frontend/`** — a single `index.html` + `app.js` + `style.css`, no framework, no build step. `app.js` stores the JWT in `localStorage` and calls the gateway (`http://localhost:3000`) for everything. `server.js` is a ~20-line dependency-free static file server (`node:http`).

### The one JWT rule that matters here

All three backend services hardcode the **same literal `JWT_SECRET` string** directly in their own `middleware/auth.js` (not an env var — that's intentional, matching the reference project's simplicity). That's what lets each service verify a token it never issued, without calling `ms-usuarios` to check it. If you ever change the secret in one service's `middleware/auth.js`, you must change it identically in the other two or verification breaks silently (existing tokens become "invalid" everywhere except the service that changed).

### Persistence

Each service owns one SQLite file, created via Node's **built-in** `node:sqlite` (`DatabaseSync`) — not `better-sqlite3` and not an ORM. This was a deliberate substitution: `better-sqlite3`'s native build fails to compile against very new Node versions (confirmed failing here on Node 26) due to V8 header incompatibilities, while `node:sqlite` ships with Node itself and needs no native compilation. The API is used the same way (`db.prepare(sql).get/all/run(...)`, `.lastInsertRowid`, `.changes`), so service code reads just like the `better-sqlite3` reference version.

- `ms-usuarios/usuarios.db` — table `usuarios` (no seed data; created via `/api/usuarios`)
- `ms-eventos/eventos.db` — table `eventos`, seeded with 3 example events (one `cerrado`, to make the rejection path demoable)
- `ms-apuestas/apuestas.db` — table `apuestas`, empty until someone bets

`.db` files are gitignored — they regenerate on first run of each service.

### Adding a new protected endpoint

Copy the pattern already used in `ms-eventos/index.js` or `ms-apuestas/index.js`: `require('./middleware/auth')`, add `verificarToken` as route middleware, read `req.usuario.correo` / `req.usuario.rol` if you need the caller's identity. Don't add role-based gating or a shared auth package unless asked — the reference architecture this mirrors doesn't have it, and introducing it goes against the "keep it simple" reason this version exists (see `README.md` for the full walkthrough and `curl` examples).

### Correctness rules verified against official docs (don't regress these)

- **Every `async` route handler must have its own `try/catch`.** This project pins Express `^4.21.0`, and — confirmed against the official Express docs — only **Express 5** forwards a rejected promise from an `async` handler to the error middleware automatically. In Express 4, an uncaught rejection inside an `async` handler just hangs the request forever (and can crash the process via Node's unhandled-rejection behavior). `ms-usuarios`'s registration/login handlers and `ms-apuestas`'s `POST /api/apuestas` are `async` specifically because they `await` bcrypt/fetch, so they all wrap their body in `try/catch`. If you add a new `async` handler anywhere, it needs the same.
- **`jwt.verify()` always passes `{ algorithms: ['HS256'] }` explicitly**, in all three `middleware/auth.js` files (and `jwt.sign()` passes `algorithm: 'HS256'` too). This is the official `jsonwebtoken` recommendation to prevent algorithm-confusion attacks — don't drop it "for simplicity," it's one line.
- **Registration handles the check-then-insert race.** Two near-simultaneous registrations with the same `correo` can both pass the "does it exist?" check before either inserts; SQLite's `UNIQUE` constraint then rejects the second `INSERT`. `ms-usuarios` catches that specific error (`error.code === 'ERR_SQLITE_ERROR'` + `UNIQUE` in the message) and returns a clean `409`, instead of a `500` or a hang.
- **User-facing numeric fields (`monto`, `cuota`) are coerced with `Number(...)` and checked with `Number.isFinite(...)`** before touching SQLite, in both `ms-eventos` and `ms-apuestas`. A non-numeric value binds to a `REAL` column as SQLite-invalid input (confirmed by testing `node:sqlite` directly) — better to reject it with a `400` than let the DB reject it as a `500`.
- **`ms-apuestas`'s `POST /api/apuestas` uses two separate `try/catch` blocks** — one around the `fetch` to `ms-eventos`, one around the local `INSERT` — on purpose, so the error message accurately reflects which side actually failed (talking to Eventos vs. writing to its own DB). Don't merge them back into one catch.
- **`Mis apuestas` (`GET /api/apuestas`) intentionally lists every user's bets, not just the caller's.** This matches the reference project's `ms-compras` (which also doesn't filter by user) — it's a deliberate simplicity choice, not an oversight, so don't "fix" it into a per-user filter unless asked.
