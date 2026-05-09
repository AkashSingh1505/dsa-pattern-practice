# dsa-pattern-practice

Pattern-led DSA practice: mind-map graph, one-topic mode, full map, **practice accounts** (email/password), **site admin panel** (RSA JWT), and gated **Customize graph** (RSA session, or practice **subscriber** / **admin** role, or paid **plan**).

## Run locally

```bash
cd dsa-pattern-practice
npx --yes serve . -p 4173
# http://localhost:4173
```

`GET /api/data?k=dsa` and `/api/auth/*` need your deployed **Pages Functions** + D1; locally you’ll see the placeholder graph until those exist.

## Account page (`account.html`)

- **Practice account** — register / sign-in → `POST /api/auth/register`, `POST /api/auth/login` (D1 **subscribers** DB + `USER_JWT_SECRET`).
- **Site admin** — same password/TOTP flow as the portfolio → Worker in `meta dsa-admin-oauth-base`. Full panel in **Admin & CMS** calls **`/api/admin/*`** (overview, users, graph draft/publish, audits, `app_kv`, contacts). Direct **`PUT /api/data?k=dsa`** still publishes live JSON (RSA JWT).

`admin.html` redirects to **`account.html`**. Navbar **Sign in** opens the account page.

### Customize graph access

| Who | Customize tab |
|-----|----------------|
| Anonymous / practice **free** / **user** | Same public graph only |
| Site admin (RSA session) | Yes + import → CMS sync |
| Practice **role** `subscriber` or `admin`, or **plan** `pro` / `team` / `lifetime` | Yes (local edit + export; publishing the live site map still needs RSA site admin) |

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
| `auth/account-admin-panel.js` | Account page admin UI (calls `/api/admin/*`) |
| `functions/api/data.js` | Public CMS GET + RSA PUT (`DB`) |
| `functions/api/admin/*.js` | Site admin API: dashboard, users, user patch, CMS draft/publish, audits, `app_kv`, contacts |
| `functions/api/auth/*.js` | Register, login, me (`DB_SUBSCRIBERS`) |
| `functions/_lib/practice-jwt.js` | PBKDF2 + HS256 for practice tokens |
| `functions/_lib/admin-rsa-jwt.js` | Shared RSA verification for `/api/data` PUT and `/api/admin/*` |
| `migrations/` | Expandable schemas for both DBs |

## Deploy notes

- **GitHub Pages project URL**: keep **Project site** so `api/*` and `auth/*` paths resolve.
- **`meta dsa-admin-oauth-base`**: your Worker that issues RSA JWTs for CMS.
- Do not commit **`USER_JWT_SECRET`** or private PEM keys.

## Original portfolio

Portfolio source is separate; this repo is the standalone practice app.

## License

Add when you publish (e.g. MIT).
