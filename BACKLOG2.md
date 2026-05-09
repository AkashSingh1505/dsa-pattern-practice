# Backlog 2 — Priority order & roles

Companion to `BACKLOG.md` (ideas catalog). This file answers: **what to build first**, **how many roles to keep**, and how **staff admin** stays separate from everyday users.

---

## 1. How many roles? (recommended model)

Keep **four audiences**. Do **not** treat “admin” as another daily-user tier.

| # | Audience | Account | Purpose |
|---|----------|---------|---------|
| **A** | **Public** | None | Anyone: read the public graph, try the app, local-only progress in browser if you want. |
| **B** | **Free member** | Yes (`plan: free`) | “Daily user” on free: save progress in the **cloud**, streaks, basic quizzes, reminders (light), same canonical map + personal overlay. |
| **C** | **Paid member** | Yes (`plan: pro` / `team` / `lifetime` or equivalent) | “Daily user” paid: everything you ship as product value — **customize / own graphs**, sharing (private / public / invite), full quizzes, push reminders, mobile parity, exports, priority support (if you offer it). |
| **D** | **Staff admin** | **Separate** login (today: RSA session on `admin.html`) | **Only** people who edit the **canonical** site content, run **analytics**, manage users/billing support, audits, feature flags. **Not** a variant of B or C. |

### Dropping the practice `admin` role (your idea)

- **Today** the DB allows `practice_users.role IN ('user','admin','subscriber')` and the app treats `admin` like paid for Customize.
- **Target**: practice accounts are only **`user`** (or rename mentally to “member”); **paid vs free** is **`plan`** (+ `billing_subscriptions` / webhooks). **Staff** never uses a “fake” practice admin row for CMS — they use **Staff admin** (RSA) only.
- **Why**: one mental model for users (public → free → paid) and a **hard line** between product users and operators.
- **Migration note**: remove or stop issuing `role = admin` for practice users; give internal testers **paid comp** or a **`user_entitlements`** flag if they need early access without paying.

**Summary:** Keep **3 user states** (public, free member, paid member) + **1 staff surface** (admin). That is **4 roles in the product story**; in the database you might still store `role = user` for everyone except mapping paid via `plan` / subscriptions.

---

## 2. Priority legend

| Priority | Meaning |
|----------|---------|
| **P0** | Blocking trust, retention, or monetization; do before scaling marketing. |
| **P1** | Core paid value + parity; soon after P0. |
| **P2** | Strong differentiation (your graph sharing, quizzes, reminders, mobile). |
| **P3** | Scale, polish, enterprise, experiments. |

Within each band, order is **suggested** top-to-bottom.

---

## 3. P0 — Do first

1. **Cloud sync for member progress** — Today progress for practice users is mostly `localStorage`. Free/paid “daily users” need **server-backed** progress so devices don’t feel broken. (Schema + API + conflict rules.)
2. **Email verification** — Use `email_verified_at`; reduce spam/fake accounts before you add reminders and billing.
3. **Forgot password + reset** — `account.html` already hints at it; required for serious daily use.
4. **Real Terms & Privacy pages** — Required before ads, emails, payments, or mobile store review.
5. **Billing webhooks + source of truth** — Wire Stripe (or chosen provider) to `billing_subscriptions` / `user_entitlements`; **JWT refresh** after purchase/cancel so paid gates update without confusion.
6. **Role/plan simplification (engineering)** — Stop relying on practice `admin` for feature gates; gate on **`plan` + entitlements** only; staff uses RSA admin only.
7. **Basic observability** — Structured errors on Functions, simple dashboards/alerts; you can’t run analytics blind once users pay.
8. **Rate limits + abuse baseline** — On `register`, `login`, `forgot`, and heavy reads; protects admin APIs indirectly.

---

## 4. P1 — Right after P0

1. **Paid feature matrix locked in product** — Document exactly what paid unlocks (Customize, graph count, sharing, quiz depth, reminders); enforce server-side where it matters.
2. **Google / Apple sign-in** — Reduces friction; Apple often expected on iOS.
3. **Account page upgrades** — Plan status, manage subscription link, invoice history (even if minimal).
4. **Admin analytics pass** — Funnel: signup → verified → first synced progress → paid; cohort retention; revenue (Staff admin only).
5. **Data export + account delete** — Trust + compliance; lightweight export JSON is enough at first.
6. **Support tooling** — Staff ability to look up user by email, see plan, force-refresh entitlements, read security audit (you already have pieces in `/api/admin/*`).

---

## 5. P2 — Your big product bets (sequenced)

1. **Per-user graphs** — Private / public / unlisted / **shared with specific users**; ACL and share links.
2. **Mobile app (MVP)** — Login, read own + public + shared graphs, sync progress; push for reminders later.
3. **Reminders** — “Remind me on this problem”; email first, then push on mobile; snooze.
4. **Quizzes v1** — Pattern ID + complexity + topic ID; daily cap for free, full for paid.
5. **In-app purchase / Play Billing** — Same entitlements as web after P0 webhook design.
6. **Quiz analytics** — Weak topics, spaced repetition hooks (still mostly paid).

---

## 6. P3 — Later / optional

- Teams / org plans, SSO  
- Public graph discovery, moderation queue  
- Browser extension / IDE hooks  
- AI hints (cost-controlled, paid-gated)  
- Localization, accessibility hardening, advanced offline  
- Certificates / badges, partner API keys  

---

## 7. Extra items worth integrating (priority)

These were not all spelled out in `BACKLOG.md` but matter for a serious daily-use + paid product:

| Item | Priority | Note |
|------|----------|------|
| **Idempotent webhooks + signing secrets** | P0 | Prevents double-grant or missed cancel. |
| **Refresh tokens or short access + silent refresh** | P1 | Better security than one long-lived JWT only. |
| **Feature flags** (`app_kv` / CMS) | P1 | Ship paid features dark, turn on safely. |
| **Staging environment + seed data** | P1 | Avoid editing prod CMS by mistake. |
| **Backup / revision story for user graphs** | P2 | Before sharing goes wide. |
| **Notification preferences** (email on/off) | P2 | Legal + UX once reminders exist. |
| **Clear public vs member API** | P0–P1 | Separate rate limits and auth middleware clarity. |

---

## 8. Mapping to your mental model

- **Public** → no account; optional anonymous local progress only until you add device-bound sync (usually skip; push signup for sync).  
- **Daily user, free** → member + `plan: free`; cloud sync, light engagement features.  
- **Daily user, paid** → member + active paid entitlement; full app/website value.  
- **Admin** → **only** Staff admin: edit everything that defines the product for everyone, **all analytics**, user/support operations — **not** mixed into free/paid.

For the full idea pool, see **`BACKLOG.md`**. Use **this file** for sprint planning and role decisions.
