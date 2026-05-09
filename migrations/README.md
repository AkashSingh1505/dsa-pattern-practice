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

## Schema overview

| Database    | Tables (high level) |
|------------|----------------------|
| **Content** | `cms_content` (published JSON + revision), `cms_content_drafts`, `app_kv`, `content_audit` |
| **Subscribers** | `practice_users` (`role`: `user` \| `admin` \| `subscriber`), `user_profiles`, `user_entitlements`, `billing_*`, `subscriber_contacts`, `security_audit` |

Practice roles: **`user`** (default), **`subscriber`** (paid tier label in JWT), **`admin`** (elevated staff). Promote or upgrade (examples):

```sql
UPDATE practice_users SET role = 'admin' WHERE email = 'you@example.com';
UPDATE practice_users SET plan = 'pro', role = 'subscriber' WHERE email = 'you@example.com';
```

Re-login to refresh JWT claims.

Site **staff** CMS uses the RSA admin session on **Account → Admin & CMS** (`/api/admin/*` + graph draft/publish), not the practice `admin` role.
