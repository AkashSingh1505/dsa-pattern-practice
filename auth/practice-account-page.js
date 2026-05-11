/**
 * Practice sign-in / sign-up only (account.html).
 */
(function () {
    function apiAuth(path) {
        return new URL("api/auth/" + path, document.baseURI).href;
    }

    async function boot() {
        const titleEl = document.getElementById("title");
        const helperEl = document.getElementById("helper");
        const switcherEl = document.getElementById("switcher");
        const ctaEl = document.getElementById("cta");
        const passField = document.getElementById("passField");
        const s2 = document.getElementById("s2");
        const form = document.getElementById("practice-step-form");
        const emailEl = document.getElementById("practice-email");
        const passEl = document.getElementById("practice-password");
        const msgEl = document.getElementById("portal-practice-msg");
        const rowExtras = document.getElementById("rowExtras");
        const formsWrap = document.getElementById("portal-practice-forms");
        const signedWrap = document.getElementById("portal-practice-signedin");

        function applyAccountFeatureChrome() {
            if (typeof dsaSiteFeatureVisible === "function") {
                var alt = document.querySelector("#portal-practice-forms .alt");
                var orEl = document.querySelector("#portal-practice-forms .or");
                var gBtn = document.getElementById("oauth-google-btn");
                var aBtn = document.getElementById("oauth-apple-btn");
                var gVis = dsaSiteFeatureVisible("social_oauth_google");
                var aVis = dsaSiteFeatureVisible("social_oauth_apple");
                var gEn = typeof dsaSiteFeatureEnabled !== "function" || dsaSiteFeatureEnabled("social_oauth_google");
                var aEn = typeof dsaSiteFeatureEnabled !== "function" || dsaSiteFeatureEnabled("social_oauth_apple");
                var showOAuthBlock = gVis || aVis;
                if (alt) {
                    alt.hidden = !showOAuthBlock;
                }
                if (orEl) {
                    orEl.hidden = !showOAuthBlock;
                }
                if (gBtn) {
                    gBtn.hidden = !gVis;
                    gBtn.classList.toggle("dsa-site-feature-faded", gVis && !gEn);
                    if (gVis && !gEn) {
                        gBtn.setAttribute("aria-disabled", "true");
                    } else {
                        gBtn.removeAttribute("aria-disabled");
                    }
                }
                if (aBtn) {
                    aBtn.hidden = !aVis;
                    aBtn.classList.toggle("dsa-site-feature-faded", aVis && !aEn);
                    if (aVis && !aEn) {
                        aBtn.setAttribute("aria-disabled", "true");
                    } else {
                        aBtn.removeAttribute("aria-disabled");
                    }
                }
            }
            var adm = document.querySelector(".account-site-admin-foot");
            if (adm && typeof dsaSiteFeatureUse === "function") {
                adm.hidden = !dsaSiteFeatureUse("site_admin_link");
            }
            var dash = document.querySelector('a[href*="user-dashboard.html"]');
            if (dash && typeof dsaSiteFeatureUse === "function") {
                var dashOn = dsaSiteFeatureUse("member_dashboard");
                dash.hidden = !dashOn;
                dash.style.display = dashOn ? "" : "none";
            }
        }

        document.addEventListener("dsa-site-features-ready", applyAccountFeatureChrome);
        window.addEventListener("load", applyAccountFeatureChrome);

        if (typeof dsaEnsureSiteFeaturesLoaded === "function") {
            await dsaEnsureSiteFeaturesLoaded();
        }
        applyAccountFeatureChrome();

        const signedIn = typeof dsaIsPracticeUser === "function" && dsaIsPracticeUser();
        const authAllowed = typeof dsaSiteFeatureUse !== "function" || dsaSiteFeatureUse("practice_auth");
        if (!authAllowed && !signedIn) {
            var panel = document.getElementById("portal-panel-practice");
            if (panel) {
                panel.innerHTML =
                    '<p class="meta-line" style="margin:0 0 12px">Practice sign-in is turned off in site settings.</p>' +
                    '<p class="helper" style="margin:0 0 16px">Contact the site operator if you need access.</p>' +
                    '<a href="./index.html" class="cta" style="text-decoration:none;display:flex;max-width:280px">← Back to map</a>';
            }
            return;
        }

        if (!form || !emailEl || !passEl || !titleEl || !helperEl || !switcherEl || !ctaEl || !passField || !s2 || !msgEl || !rowExtras || !formsWrap || !signedWrap) {
            return;
        }

        function safeNextRedirect() {
            try {
                var u = new URL(window.location.href);
                var next = u.searchParams.get("next") || u.searchParams.get("return");
                if (!next) {
                    return "./index.html";
                }
                next = String(next).trim();
                if (next.indexOf("..") >= 0 || next.indexOf("/") >= 0 || next.indexOf("\\") >= 0) {
                    return "./index.html";
                }
                if (!/\.html$/i.test(next)) {
                    return "./index.html";
                }
                return "./" + next;
            } catch (e) {
                return "./index.html";
            }
        }

        let mode = "signin";
        let step = 1;

        function practiceMsg(text, cls) {
            msgEl.textContent = text || "";
            msgEl.className = "status" + (cls ? " " + cls : "");
        }

        function resetStepUi() {
            step = 1;
            passField.style.display = "none";
            rowExtras.style.display = "none";
            s2.classList.remove("on");
            passEl.value = "";
            passEl.type = "password";
            ctaEl.textContent = "Continue";
        }

        function setMode(nextMode) {
            mode = nextMode;
            if (mode === "signup") {
                titleEl.textContent = "Create account";
                helperEl.innerHTML = "Start free as <b>user</b>. Upgrade to <b>pro</b> anytime.";
                switcherEl.innerHTML = "Have an account? <b>Sign in</b>";
            } else {
                titleEl.textContent = "Welcome back";
                helperEl.textContent = "Enter your email to continue. We'll guide you step by step.";
                switcherEl.innerHTML = "New here? <b>Create</b>";
            }
            resetStepUi();
        }

        switcherEl.addEventListener("click", function () {
            setMode(mode === "signin" ? "signup" : "signin");
        });

        document.getElementById("passToggle").addEventListener("click", function () {
            passEl.type = passEl.type === "password" ? "text" : "password";
        });

        function updatePracticeSignedInUi() {
            const c = typeof dsaParsePracticeUserClaims === "function" ? dsaParsePracticeUserClaims() : null;
            if (c && c.email) {
                signedWrap.hidden = false;
                formsWrap.hidden = true;
                document.getElementById("portal-practice-email").textContent = c.email;
                document.getElementById("portal-practice-plan").textContent = c.plan || "free";
                document.getElementById("portal-practice-role").textContent = c.role || "user";
            } else {
                signedWrap.hidden = true;
                formsWrap.hidden = false;
            }
            applyAccountFeatureChrome();
        }

        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            if (step === 1) {
                if (!emailEl.checkValidity()) {
                    emailEl.reportValidity();
                    return;
                }
                step = 2;
                passField.style.display = "block";
                rowExtras.style.display = mode === "signin" ? "flex" : "none";
                s2.classList.add("on");
                helperEl.innerHTML =
                    mode === "signin"
                        ? "Hi <b>" + emailEl.value + "</b> — enter your password."
                        : "Create a strong password (min 8 characters).";
                ctaEl.textContent = mode === "signin" ? "Sign in" : "Create account";
                passEl.setAttribute("autocomplete", mode === "signin" ? "current-password" : "new-password");
                setTimeout(function () {
                    passEl.focus();
                }, 20);
                return;
            }
            if (mode === "signup" && passEl.value.length < 8) {
                passEl.setCustomValidity("Password must be at least 8 characters.");
                passEl.reportValidity();
                passEl.setCustomValidity("");
                return;
            }

            practiceMsg(mode === "signin" ? "Signing in..." : "Creating account...");
            ctaEl.textContent = "Working...";
            try {
                const endpoint = mode === "signin" ? "login" : "register";
                const r = await fetch(apiAuth(endpoint), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: String(emailEl.value || "").trim(),
                        password: String(passEl.value || ""),
                    }),
                });
                const j = await r.json().catch(function () {
                    return {};
                });
                if (!r.ok) {
                    practiceMsg(j.error || "Request failed.", "err");
                    ctaEl.textContent = mode === "signin" ? "Sign in" : "Create account";
                    return;
                }
                if (j.token && typeof dsaPracticeUserSetToken === "function") {
                    dsaPracticeUserSetToken(j.token);
                }
                practiceMsg(mode === "signin" ? "Signed in." : "Account created. You are signed in.", "ok");
                updatePracticeSignedInUi();
                window.location.href = safeNextRedirect();
            } catch (err) {
                practiceMsg(String(err), "err");
            } finally {
                ctaEl.textContent = mode === "signin" ? "Sign in" : "Create account";
            }
        });

        document.getElementById("portal-practice-signout").addEventListener("click", function () {
            if (typeof dsaPracticeUserSignOut === "function") {
                dsaPracticeUserSignOut();
            }
            practiceMsg("Signed out practice account.", "ok");
            setMode("signin");
            updatePracticeSignedInUi();
        });

        document.getElementById("oauth-google-btn").addEventListener("click", function () {
            if (typeof dsaSiteFeatureUse === "function" && !dsaSiteFeatureUse("social_oauth_google")) {
                practiceMsg("Google sign-in is turned off for this site.", "err");
                return;
            }
            practiceMsg("Google OAuth is not configured yet.", "err");
        });
        document.getElementById("oauth-apple-btn").addEventListener("click", function () {
            if (typeof dsaSiteFeatureUse === "function" && !dsaSiteFeatureUse("social_oauth_apple")) {
                practiceMsg("Apple sign-in is turned off for this site.", "err");
                return;
            }
            practiceMsg("Apple OAuth is not configured yet.", "err");
        });

        setMode("signin");
        updatePracticeSignedInUi();
    }

    boot().catch(function () {
        /* still allow page if flags fetch fails */
        if (typeof dsaEnsureSiteFeaturesLoaded === "function") {
            dsaEnsureSiteFeaturesLoaded().catch(function () {});
        }
    });
})();
