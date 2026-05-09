# Backlog — DSA Pattern Practice

This document mixes **what the product does today** (from the repo), **what each audience should get** as the product matures, and a **wide future backlog** (including your ideas and additional directions).

---

## 1. Two different “admins” (important)

| Concept | How it works today | Typical person |
|--------|---------------------|----------------|
| **Site admin** | RSA JWT (`admin.html`, `/api/admin/*`, `PUT /api/data`). Can publish the **live public graph** to D1 CMS. | You / ops / content editors |
| **Practice `admin` role** | Row in `practice_users` with `role = admin`. Same **Customize graph** access as paid subscribers in the web UI. Does **not** replace site admin for CMS publish. | Staff practice accounts, support, internal testers |

Subscribers are **`role = subscriber`** or **`plan` in (`pro`, `team`, `lifetime`)** per migrations and `dsaHasCustomizeGraphAccess()` in `auth/dsa-user-auth.js`.

---

## 2. Current behavior by audience (as implemented)

### Anonymous (not signed in)

- View **public** DSA graph from `GET /api/data?k=dsa` (or placeholder locally).
- Full map / one-topic modes, expand/collapse, zoom as built in `index.html` + `script.js`.
- Any “overlay” (done/starred/custom problems) is **browser-local** only (`localStorage`), not tied to an account.

### Free practice user (`plan: free`, `role: user`)

- Register / login via `POST /api/auth/register`, `POST /api/auth/login`; JWT claims: email, role, plan (`/api/auth/me`).
- Same **public graph** as everyone; README: *“The public graph is the same for everyone.”*
- Can mark practice problems done/important and add personal data **client-side**; persistence is **`localStorage`** (`dsaUserPayload`).
- **No** “Customize graph” tab unless they also have site-admin RSA session.
- **No** server sync of personal overlay to D1 for practice JWT only — `dsaSyncMergedHierarchyToCmsInternal()` runs only when `dsaIsAdminSession()` (RSA) is true.

### Subscriber (`role: subscriber` or `plan`: pro / team / lifetime)

- Everything the free practice user has.
- **Customize graph** enabled: local graph editing, structure tweaks, export; **publishing** the canonical site map still requires **site admin** + `PUT /api/data`.

### Practice `admin` role

- Same Customize entitlement as subscriber for the practice app UI.
- Still not the same as site admin CMS unless they also complete RSA admin login.

### Site admin (RSA session on `admin.html`)

- Dashboard stats, user list/detail patches, CMS drafts/publish, audits, KV, contacts (`/api/admin/*`).
- Can **publish** merged graph (including synced user-overlay workflow when saving from an admin browser session).

---

## 3. Target feature matrix (what each tier *should* have long-term)

Use this as a north star; many rows are **not built yet**.

| Area | Free | Subscriber | Site admin |
|------|------|------------|------------|
| **Core map** | Public catalog graph, one-topic, progress chips | Same + **personal / custom graph layers** (see backlog) | Edit **canonical** published graph + drafts |
| **Progress** | Done / starred / notes; ideally **cloud sync** | Sync + history, streaks, exports | N/A (or internal analytics) |
| **Customize graph** | Read-only structure | Full customize + **named graphs**, themes, share rules | Publish to world + moderation |
| **Collaboration** | — | Share graph with users, public link, view-only vs edit | Audit, takedown, abuse |
| **Assessments** | Limited daily quizzes | Full quiz bank, spaced repetition, weak-topic drills | Authoring / CMS tie-in |
| **Reminders** | Basic or none | “Remind me” on problems, email/push | Campaign / compliance |
| **Billing** | — | Web + **mobile** purchase, plan management | Reports, refunds, entitlements |
| **Account** | Email/password, profile, verify email | OAuth, family/team, invoices | User admin, security audit |

---

## 4. Your ideas (explicit backlog items)

- **Personal graphs**: each user maintains one or more graphs; visibility **private / public / unlisted link / shared with specific users** (ACL per user email or handle).
- **Mobile app**: sign-in, view **own**, **public**, and **graphs shared with me**; offline-friendly read cache where possible; same auth as web (practice JWT or OAuth).
- **Reminders**: from a problem or node — “remind me in …” → notification (email, push, in-app); optional recurrence; snooze.
- **Quizzes**: generated drills — **pattern identification**, **time/space complexity**, **DSA topic identification**, **code output**, **bug spot**, difficulty-adaptive.
- **Subscriptions on web and app**: single entitlements source (`user_entitlements` / `billing_subscriptions` already sketched in D1); restore purchases; Stripe / Play / App Store alignment.
- **Post-subscribe customization**: subscriber can **customize own graph** (aligns with current “Customize” gate — extend to **per-user graph storage**, not only local overlay).

---

## 5. Near-term product / engineering backlog (from code gaps)

- Integrate real **Google OAuth** for practice accounts (currently UI-only on `account.html`).
- Integrate real **Apple** sign-in for practice accounts (UI-only).
- **Forgot password** (`/api/auth/forgot` + reset tokens + email).
- Replace placeholder **Terms / Privacy** links.
- Explicit **site admin sign-out** in Admin & CMS panel.
- **Cloud sync** for practice-user progress (API + D1 tables), not only `localStorage`.
- Wire **Stripe (or Paddle / Lemon Squeezy)** to `billing_customers` / `billing_subscriptions` and JWT refresh on webhook.
- **Email verification** flow using `email_verified_at`.
- Practice-user **session refresh** and shorter-lived access + refresh tokens (optional hardening).

---

## 6. Graph & content (future)

- Per-user graph CRUD API: create, fork from public template, version history, diff, rollback.
- **Fork** public / official graph into private copy; merge updates from upstream.
- Graph **templates** by goal (FAANG prep, interviews, university syllabus).
- Rich node types: links, PDFs, video, **spaced-repetition cards** attached to nodes.
- **Comments / annotations** on nodes (subscriber); moderation queue (admin).
- **Import/export**: JSON, Markdown outline, Anki deck export.
- **Graph search** across all public graphs (with rate limits for free tier).

---

## 7. Social, sharing, and teams

- Friend or **study group** model: invite by link, role (viewer / commenter / editor).
- **Public profile** page: optional showcase of public graphs and badges.
- **Team / org** plan: shared team graph, admin roles, SSO (later enterprise).
- Leaderboards (opt-in) for weekly quiz points — privacy-preserving.

---

## 8. Mobile app (cross-cutting)

- Shared API surface with web: auth, graphs, progress, quizzes, notifications.
- **Deep links** to a specific problem or topic.
- Widget: “today’s review” or streak.
- Background sync for offline progress; conflict resolution rules.
- App Store / Play **subscription** linking to same `plan` as web.

---

## 9. Learning & quizzes (future)

- **Pattern ID**: show problem statement → pick pattern(s); explain wrong answers.
- **Complexity quiz**: given pseudocode or description → Big-O.
- **Topic ID**: classify problem into DS / algorithm family.
- **Timed mode** vs **study mode**; exam presets (45/60/90 min).
- **Mistake log** and “practice again in 1d / 3d / 7d”.
- AI-assisted hints (optional, gated, with cost controls for free tier).

---

## 10. Notifications & reminders

- In-app notification center; email digests; push (mobile).
- Calendar integration (ICS export) for “study schedule”.
- Optional integration with **Google Calendar** / Apple Reminders (deep links).

---

## 11. Admin & operations

- Feature flags in `app_kv` / CMS for gradual rollouts.
- Abuse reporting on public graphs; DMCA / content policy workflow.
- Analytics: funnel signup → first done problem → subscribe; cohort retention.
- **Data export** (GDPR-style) and account deletion end-to-end.

---

## 12. Quality, trust, and platform

- Rate limiting and bot protection on auth and public APIs.
- Accessibility pass on graph UI (keyboard, screen reader labels).
- Localization (`user_profiles.locale` already in schema).
- Performance: lazy load large graphs; virtualize lists on mobile.

---

## 13. Wildcards / later

- **Browser extension**: quick “save this LeetCode problem” into your graph.
- **IDE plugin**: snippet → pattern tag.
- **Certificates** or shareable completion badges for paid courses tied to graph paths.
- **API for partners** (university bootcamps) with scoped keys.

---

*Last expanded: product + codebase review backlog. Trim or prioritize sections into an issue tracker as you ship.*
