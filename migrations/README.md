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

Optional catalog category columns / table (after `0003`):

```bash
npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0007_graph_catalog_categories.sql
npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0008_graph_catalog_category_table.sql
```

**Personal graph body categories** live in **`user_graphs.categories_json`** (same shape as catalog: `{ id, name, color }[]`). Add the column after `0003` (and after optional catalog migrations if you use them):

```bash
npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0010_user_graphs_categories_json.sql
```

The first library API call after deploy can migrate legacy **`user_graph_category`** rows into JSON and drop that table (see `functions/_lib/user-graph-categories-json.js`).

### Mandatory node categories (runtime validation)

Library APIs require **`categories_json` / `graph_catalog_category`** with **at least one** `{ id, name, color }`, and **every** mind-map root, nested topic (`tree` / `patterns`), and embedded **problem** object must set **`graphCategoryId`** (or legacy `catalogCategoryId`) to one of those ids. Invalid graphs return **422** on open (`GET …/mine-detail`, `GET …/catalog-detail`), **422** on share/download, and **400** on save.

**Migrating legacy rows (SQL cannot rewrite `payload_json` easily):**

1. **Site admin → Library** — open each catalog graph, add categories and assign `graphCategoryId` on nodes (or paste fixed JSON), then save.
2. **Personal graphs** — same via member workspace + save, or `PUT /api/graph-library/mine-detail` with `categories` + `payload`.
3. Optional script: export `payload_json` / `categories_json` locally, run a small Node script to inject a default category id on every node/problem, then `UPDATE` via Wrangler or dashboard.

Re-seed reference data with **`seed_graph_catalog_manual.sql`** (updated for categories + `graphCategoryId`) after **`0007_graph_catalog_categories.sql`**.

Publish catalog entries from **Site admin → Library** (signed in with RSA), or with **`POST /api/admin/graph-catalog`** (RSA JWT or practice **`role = admin`**). Members use **`GET /api/graph-library/public`**, **`POST /api/graph-library/download`**, and **`/api/graph-library/mine*`** with the practice Bearer token.

**D1 console only (no Wrangler):** run the schema in `0003_graph_library.sql` if needed, then paste the **`INSERT`** statements from [`migrations/subscribers/seed_graph_catalog_manual.sql`](subscribers/seed_graph_catalog_manual.sql) into the Cloudflare dashboard SQL editor for the subscribers database.

## Schema overview

| Database    | Tables (high level) |
|------------|----------------------|
| **Content** | Legacy **`cms_content`** / drafts (optional), **`app_kv`**, **`content_audit`** — public practice graph lives in subscribers **`graph_catalog`** |
| **Subscribers** | `practice_users` (`role`: `user` \| `admin` \| `subscriber`), `user_profiles`, `user_entitlements`, `billing_*`, `subscriber_contacts`, `security_audit`, **`graph_catalog`** (incl. `categories_json`, optional **`graph_catalog_category`**, reserved **`dsa-site-map`** for **`GET /api/data?k=dsa`**), **`graph_catalog_downloads`**, **`user_graphs`** (incl. **`categories_json`** for per-graph color groups) |

Practice roles: **`user`** (default), **`subscriber`** (paid tier label in JWT), **`admin`** (elevated staff). Promote or upgrade (examples):

```sql
UPDATE practice_users SET role = 'admin' WHERE email = 'you@example.com';
UPDATE practice_users SET plan = 'pro', role = 'subscriber' WHERE email = 'you@example.com';
```

Re-login to refresh JWT claims.

Site **staff admin** uses the RSA session on **Account → Site admin** (`/api/admin/*`, Graph library + Workspace), not the practice `admin` role alone.
