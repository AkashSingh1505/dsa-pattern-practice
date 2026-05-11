# D1 migrations

Apply **once per database** after creating the D1 in the Cloudflare dashboard.

## Content DB (`dsa-pattern-practice-content`)

Binding in Pages / Worker: **`DB`** (see `functions/api/data.js`).

```bash
npx wrangler d1 execute dsa-pattern-practice-content --remote --file=migrations/content/0001_cms_expandable.sql
```

If you already have a minimal `cms_content (key, payload, updated_at)` table, add columns manually or recreate the DB — see comments at the bottom of `0001_cms_expandable.sql`.

## Subscribers DB (`dsa-pattern-practice-subscribers`)

Binding: **`DB_SUBSCRIBERS`**. Also set **`USER_JWT_SECRET`** (32+ random chars) in Pages → Environment variables.

```bash
npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0001_subscribers_expandable.sql
```

After `0001`, add the **`subscriber`** practice role and normalize paid rows (see file header):

```bash
npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0002_practice_users_subscriber_role.sql
```

**Member profile fields** (gender, location, birthday, experience JSON — optional):

```bash
npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0004_user_profile_fields.sql
```

**Graph library** (community catalog + personal copies, member hub):

```bash
npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0003_graph_library.sql
```

Publish catalog entries from **Site admin → Library** (signed in with RSA), or with **`POST /api/admin/graph-catalog`** (RSA JWT or practice **`role = admin`**). Members use **`GET /api/graph-library/public`**, **`POST /api/graph-library/download`**, and **`/api/graph-library/mine*`** with the practice Bearer token.

**D1 console only (no Wrangler):** run the schema in `0003_graph_library.sql` if needed, then paste the **`INSERT`** statements from [`migrations/subscribers/seed_graph_catalog_manual.sql`](subscribers/seed_graph_catalog_manual.sql) into the Cloudflare dashboard SQL editor for the subscribers database.

## Schema overview

| Database    | Tables (high level) |
|------------|----------------------|
| **Content** | Legacy **`cms_content`** / drafts (optional), **`app_kv`**, **`content_audit`** — public practice graph lives in subscribers **`graph_catalog`** |
| **Subscribers** | `practice_users` (`role`: `user` \| `admin` \| `subscriber`), `user_profiles` (display, avatar, bio, social_json, gender, location, birthday, experience_json, …), `user_entitlements`, `billing_*`, `subscriber_contacts`, `security_audit`, **`graph_catalog`** (incl. reserved **`dsa-site-map`** for **`GET /api/data?k=dsa`**), **`graph_catalog_downloads`**, **`user_graphs`** |

Practice roles: **`user`** (default), **`subscriber`** (paid tier label in JWT), **`admin`** (elevated staff). Promote or upgrade (examples):

```sql
UPDATE practice_users SET role = 'admin' WHERE email = 'you@example.com';
UPDATE practice_users SET plan = 'pro', role = 'subscriber' WHERE email = 'you@example.com';
```

Re-login to refresh JWT claims.

Site **staff admin** uses the RSA session on **Account → Site admin** (`/api/admin/*`, Graph library + Workspace), not the practice `admin` role alone.
