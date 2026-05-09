DSA admin (Customize graph) — setup
====================================

1) Key pair
   - The repo contains auth/dsa-admin-public.pem (public only).
   - auth/.gitignored-demo-private.pem is gitignored — use its contents as RSA_PRIVATE_KEY_PEM in the Worker, OR generate a new pair:
     openssl genrsa -out private.pem 2048
     openssl rsa -in private.pem -pubout -out dsa-admin-public.pem
   - Replace auth/dsa-admin-public.pem in the repo with your new public key if you rotate keys.

2) GitHub OAuth App (Settings → Developer settings)
   - Application name: e.g. Portfolio DSA admin
   - Homepage URL: your GitHub Pages site
   - Authorization callback URL: https://<YOUR-WORKER-HOST>/callback

3) Cloudflare Worker
   - Deploy auth/dsa-admin-oauth-worker.js (Wrangler or dashboard paste).
   - Set secrets/vars:
     GITHUB_CLIENT_ID
     GITHUB_CLIENT_SECRET
     RSA_PRIVATE_KEY_PEM   (full PKCS#8 PEM, same key as public file in repo)
     ADMIN_GITHUB_LOGIN    (your GitHub username)
     ALLOWED_RETURN_PREFIXES = https://<user>.github.io/<repo>,http://127.0.0.1:5500
     (comma-separated; every ?return= URL must start with one of these)

4) Site HTML
   - In admin.html set:
     <meta name="dsa-admin-oauth-base" content="https://<YOUR-WORKER-HOST>">
   - ALLOWED_RETURN_PREFIXES must include the URL prefix of admin.html (same origin/path as your Pages deploy).

5) Use
   - Open DSA Patterns → "Sign in with GitHub" → authorize → you return with a signed session; "Customize graph" appears.
   - "Admin · sign out" clears the session (sessionStorage).
