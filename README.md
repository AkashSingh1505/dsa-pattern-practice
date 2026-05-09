# dsa-pattern-practice

Pattern-led DSA practice: mind-map graph, one-topic mode, full map, **practice accounts** (email/password), **site admin panel** (RSA JWT), and gated **Customize graph** (RSA session, or practice **subscriber** / **admin** role, or paid **plan**).

## Run locally

```bash
cd dsa-pattern-practice
npx --yes serve . -p 4173
# http://localhost:4173
```

`GET /api/data?k=dsa` and `/api/auth/*` need your deployed **Pages Functions** + D1; locally you’ll see the placeholder graph until those exist.

## Single entry: `index.html`

- **Practice map (default)** — `#app` or no hash: full DSA graph UI.
- **Practice sign-in / sign-up** — `#sign-in`: embedded portal (same as the old account page) → `POST /api/auth/register`, `POST /api/auth/login` (D1 **subscribers** + `USER_JWT_SECRET`). After success, the shell returns to **`#app`**.
- **Site admin** — `#admin`: RSA password/TOTP via Worker in `meta dsa-admin-oauth-base`. OAuth **`return`** URL should end with **`index.html#admin`** (add that prefix in `ALLOWED_RETURN_PREFIXES`). Admin UI calls **`/api/admin/*`**. **`PUT /api/data?k=dsa`** still publishes live JSON (RSA JWT).

**Redirects (optional bookmarks / old Cloudflare routes):** `account.html`, **`login-signup.html`**, and **`admin.html`** → `index.html#sign-in` or `#admin`. Navbar **Sign in** → `#sign-in`; when site admin is signed in, the same control becomes **Admin** → `#admin`.

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
| `index.html` | Practice map + embedded portal (`#sign-in`, `#admin`) |
| `login-signup.html` | Redirect → `index.html#sign-in` |
| `account.html` | Redirect → `index.html#sign-in` |
| `admin.html` | Redirect → `index.html#admin` |
| `auth/portal-shell.css` | Styles for the embedded portal / admin dashboard |
| `auth/portal-practice.js` | Practice + CMS auth wiring on `index.html` |
| `auth/dsa-shell-route.js` | Hash routing between map and portal |
| `script.js` | Graph UI, customize gating, nav auth |
| `auth/dsa-user-auth.js` | Practice JWT in storage + `dsaHasCustomizeGraphAccess()` |
| `auth/dsa-admin-auth.js` | Site-admin RSA JWT |
| `auth/account-admin-panel.js` | Admin dashboard UI (calls `/api/admin/*`) |
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
