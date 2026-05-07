# dsa-pattern-practice

Pattern-led DSA practice UI copied from the portfolio project: mind-map graph, one-topic mode, full map, customize (admin), and practice cards.

## Run locally

Serve the repo root over HTTP (needed for `fetch` and modules):

```bash
cd dsa-pattern-practice
npx --yes serve . -p 4173
# open http://localhost:4173
```

Or Python:

```bash
python3 -m http.server 4173
```

Open `index.html` — the app loads hierarchy from **`GET /api/data?k=dsa`** when deployed; locally you’ll see the built-in placeholder until you wire the same API.

### CMS (`admin.html`)

- Open **`./admin.html`** (navbar **Login** goes here after sign-in flow).
- Same editor as the portfolio: load/save **projects**, **skills**, **home**, **dsa** via your **`/api/data`** Functions + bound D1.
- Sign-in posts to the Worker URL in **`meta name="dsa-admin-oauth-base"`** — align it with your deployed Worker.

## What’s in this repo

| Path | Purpose |
|------|--------|
| `index.html` | App shell (navbar, `#dsa-hierarchy-root`, scripts) |
| `script.js` | Graph UI, practice panels, admin customize flows |
| `styles.css` | Shared styles including `.dsa-*` graph UI |
| `cms-bootstrap.js` | Loads CMS keys (`projects`, `skills`, `home`) — safe no-op if API missing |
| `dsa-sketch-native.js` | Sketch overlay for solution drafts |
| `auth/dsa-admin-auth.js` | JWT session + OAuth base from `<meta name="dsa-admin-oauth-base">` |
| `auth/dsa-admin-public.pem` | Public key for token verify (never commit private keys) |
| `data/dsa-user-nodes.json` | Default empty user overlay; optional deploy as static file |
| `functions/api/data.js` | **Reference** Cloudflare Pages function — bind D1 `dsa` JSON like the portfolio |

Dev helpers (optional): `scripts/generate-dsa-hierarchy.mjs`, `scripts/dsa-hierarchy.sample.json`.

## Deploy notes

- Point **`meta dsa-admin-oauth-base`** (and your Worker) at your own auth origin if you fork.
- **GitHub Pages**: use **Project site** so assets resolve (`auth/dsa-admin-public.pem`, `data/…`). This repo adjusts PEM and user-json paths for root `index.html`.
- **Login / CMS**: `script.js` sets **Login → `/admin.html`** on the same origin. Add your own `admin.html` or change that flow when you split CMS from this app.

## Original portfolio

The source portfolio repository is unchanged; this tree is a copy for the standalone practice project.

## License

Add a license when you publish (e.g. MIT).
