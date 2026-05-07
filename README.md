# dsa-pattern-practice

Pattern-led DSA practice: mind-map graph, one-topic mode, full map, **practice accounts** (email/password), **site admin CMS**, and gated **Customize graph** (site admin RSA JWT, or practice **pro** / **admin** role).

## Run locally

```bash
cd dsa-pattern-practice
npx --yes serve . -p 4173
# http://localhost:4173
```

`GET /api/data?k=dsa` and `/api/auth/*` need your deployed **Pages Functions** + D1; locally you’ll see the placeholder graph until those exist.

## Account page (`account.html`)

- **Practice account** — register / sign-in → `POST /api/auth/register`, `POST /api/auth/login` (D1 **subscribers** DB + `USER_JWT_SECRET`).
- **Site admin & CMS** — same password/TOTP flow as the portfolio → Worker in `meta dsa-admin-oauth-base`; JSON editor → `PUT /api/data?k=…` (D1 **content** DB + RSA admin JWT).

`admin.html` redirects to **`account.html`**. Navbar **Sign in** opens the account page.

### Customize graph access

| Who | Customize tab |
|-----|----------------|
| Anonymous / practice **free** / **user** | Same public graph only |
| Site admin (RSA session) | Yes + import → CMS sync |
| Practice **role = admin** or **plan** in `pro` / `team` / `lifetime` | Yes (local edit + export; CMS PUT still needs site admin) |

## Databases (Cloudflare D1)

| Binding | Database name (suggested) | Purpose |
|---------|---------------------------|--------|
| **`DB`** | `dsa-pattern-practice-content` | CMS JSON, revisions, drafts, feature flags, audit |
| **`DB_SUBSCRIBERS`** | `dsa-pattern-practice-subscribers` | Users, profiles, entitlements, billing hooks, security audit |

Run SQL in **`migrations/`** — see **`migrations/README.md`**. Example config: **`wrangler.toml.example`**.

Set **`USER_JWT_SECRET`** (≥16 chars, prefer 32+) in Pages environment variables.

## What’s in this repo

| Path | Purpose |
|------|--------|
| `index.html` | Practice app shell |
| `account.html` | Practice + site admin portal |
| `script.js` | Graph UI, customize gating |
| `auth/dsa-user-auth.js` | Practice JWT in storage + `dsaHasCustomizeGraphAccess()` |
| `auth/dsa-admin-auth.js` | Site-admin RSA JWT |
| `functions/api/data.js` | CMS GET/PUT (`DB`) |
| `functions/api/auth/*.js` | Register, login, me (`DB_SUBSCRIBERS`) |
| `functions/_lib/practice-jwt.js` | PBKDF2 + HS256 for practice tokens |
| `migrations/` | Expandable schemas for both DBs |

## Deploy notes

- **GitHub Pages project URL**: keep **Project site** so `api/*` and `auth/*` paths resolve.
- **`meta dsa-admin-oauth-base`**: your Worker that issues RSA JWTs for CMS.
- Do not commit **`USER_JWT_SECRET`** or private PEM keys.

## Original portfolio

Portfolio source is separate; this repo is the standalone practice app.

## License

Add when you publish (e.g. MIT).
