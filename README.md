# dsa-pattern-practice

Pattern-led DSA practice: mind-map graph, one-topic mode, full map, **practice accounts** (email/password), **site admin panel** (RSA JWT), and gated **Customize graph** (RSA session, or practice **subscriber** / **admin** role, or paid **plan**).

## Run locally

```bash
cd dsa-pattern-practice
npx --yes serve . -p 4173
# http://localhost:4173
```

`GET /api/data?k=dsa` and `/api/auth/*` need your deployed **Pages Functions** + D1; locally you’ll see the placeholder graph until those exist.

## Pages (three HTML files)

- **`index.html`** — practice map / graph (default). Navbar **Sign in** → `account.html`; **Admin** link → `admin.html`. When a site-admin RSA session exists, the primary auth link targets **`admin.html`** instead.
- **`account.html`** — practice sign-in / sign-up only → `POST /api/auth/register`, `POST /api/auth/login` (D1 **subscribers** + `USER_JWT_SECRET`). After success, redirects to **`index.html`**.
- **`admin.html`** — site admin: RSA password/TOTP via Worker in `meta dsa-admin-oauth-base`. Set **`return`** to your real admin URL (recommended: `https://<host>/admin.html`); allow that prefix in **`ALLOWED_RETURN_PREFIXES`**. Admin UI calls **`/api/admin/*`**. Public graph data is **`GET /api/data?k=dsa`** from **`graph_catalog`** (`dsa-site-map`); **`PUT /api/data?k=dsa`** updates that row (RSA JWT, requires **`DB_SUBSCRIBERS`**).

### Cloudflare: admin / sign-in redirect loops (`/admin`, `/account`)

If **`admin.html` or `account.html` never load** (browser errors, or `308` / infinite redirects), something in **Cloudflare** is rewriting `*.html` to extensionless paths (`/admin`, `/account`) without serving a real page there.

1. **Cloudflare dashboard** → your zone or **Pages** project → **Rules** → **Redirect Rules** (and **Bulk Redirects** if you use them). Remove or edit any rule that sends **`/admin.html` → `/admin`** or **`/account.html` → `/account`** (or “strip `.html`” for those paths).
2. **Pages** → **Settings**: if **SPA / fallback** sends unknown paths to `index.html`, that is fine; the problem is usually an extra **308 redirect** that targets `/admin` or `/account` specifically.
3. Use the real files in links and bookmarks: **`/admin.html`** and **`/account.html`** (this repo’s nav already does).

After the bad rules are removed, open **`https://<project>.pages.dev/admin.html`** and **`…/account.html`** — they should return **200** HTML, not a redirect chain.

**Admin Worker (`ALLOWED_RETURN_PREFIXES` or hostnames):** allow the URL you actually use after login, e.g. both `https://<project>.pages.dev/admin` and `https://<project>.pages.dev/admin.html` if you use pretty URLs. Set Worker secrets **`ADMIN_PASSWORD`** and/or **`ADMIN_TOTP_SECRET`** so the password / authenticator forms work.

### Customize graph access

| Who | Customize tab |
|-----|----------------|
| Anonymous / practice **free** / **user** | Same public graph only |
| Site admin (RSA session) | Yes + import → save via library / API |
| Practice **role** `subscriber` or `admin`, or **plan** `pro` / `team` / `lifetime` | Yes (local edit + export; publishing the live site map still needs RSA site admin) |

## Databases (Cloudflare D1)

| Binding | Database name (suggested) | Purpose |
|---------|---------------------------|--------|
| **`DB`** | `dsa-pattern-practice-content` | Feature flags (`app_kv`), content audit — not used for the public practice graph |
| **`DB_SUBSCRIBERS`** | `dsa-pattern-practice-subscribers` | Users, profiles, **`graph_catalog`** (incl. site public slug `dsa-site-map`), personal graphs, security audit |

Run SQL in **`migrations/`** — see **`migrations/README.md`**. Example config: **`wrangler.toml.example`**.

Set **`USER_JWT_SECRET`** (≥16 chars, prefer 32+) in Pages environment variables.

## What’s in this repo

| Path | Purpose |
|------|--------|
| `index.html` | Practice map / graph shell |
| `account.html` | Practice account sign-in / sign-up |
| `admin.html` | Site admin (RSA) dashboard |
| `auth/portal-shell.css` | Styles for account + admin portal cards |
| `auth/practice-account-page.js` | Practice form wiring on `account.html` |
| `auth/admin-site-page.js` | Admin RSA password/TOTP + dashboard init on `admin.html` |
| `script.js` | Graph UI, customize gating, nav auth |
| `auth/dsa-user-auth.js` | Practice JWT in storage + `dsaHasCustomizeGraphAccess()` |
| `auth/dsa-admin-auth.js` | Site-admin RSA JWT |
| `auth/account-admin-panel.js` | Admin dashboard UI (calls `/api/admin/*`) |
| `functions/api/data.js` | Public **`GET /api/data?k=dsa`** + RSA **`PUT`** (`graph_catalog` on **`DB_SUBSCRIBERS`**) |
| `functions/api/admin/*.js` | Site admin API: dashboard, users, graph catalog/inventory, audits, `app_kv`, contacts |
| `functions/api/auth/*.js` | Register, login, **`GET`/`PATCH` `/api/auth/me`** (JWT + `user_profiles`) |
| `functions/_lib/practice-jwt.js` | PBKDF2 + HS256 for practice tokens |
| `functions/_lib/admin-rsa-jwt.js` | Shared RSA verification for `/api/data` PUT and `/api/admin/*` |
| `migrations/` | Expandable schemas for both DBs |

## Deploy notes

- **GitHub Pages project URL**: keep **Project site** so `api/*` and `auth/*` paths resolve.
- **`meta dsa-admin-oauth-base`**: your Worker that issues RSA JWTs for site admin APIs.
- Do not commit **`USER_JWT_SECRET`** or private PEM keys.

## Original portfolio

Portfolio source is separate; this repo is the standalone practice app.

## License

Add when you publish (e.g. MIT).
