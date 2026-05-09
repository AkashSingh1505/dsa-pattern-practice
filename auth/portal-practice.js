/**
 * Practice sign-in + site admin auth forms (embedded in index.html #sign-in / #admin).
 */
(function () {
    let updateAdminUiRef = null;

    window.dsaPortalSyncAdminUi = async function () {
        if (typeof updateAdminUiRef !== "function") {
            return;
        }
        if (typeof dsaInitAdminAuth === "function") {
            await dsaInitAdminAuth();
        }
        updateAdminUiRef();
        const sec = document.getElementById("cms-editor-section");
        if (sec) {
            delete sec.dataset.admBound;
        }
        if (typeof dsaInitAccountAdminPanel === "function") {
            dsaInitAccountAdminPanel();
        }
    };

    window.dsaInitPortalPractice = function () {
        if (window.dsaPortalPracticeBound) {
            return;
        }
        window.dsaPortalPracticeBound = true;

        const tabPractice = document.getElementById("portal-tab-practice");
        const tabCms = document.getElementById("portal-tab-cms");
        const panelPractice = document.getElementById("portal-panel-practice");
        const panelCms = document.getElementById("portal-panel-cms");
        if (!tabPractice || !tabCms || !panelPractice || !panelCms) {
            return;
        }

        function showTab(which) {
            const cms = which === "cms";
            panelPractice.style.display = cms ? "none" : "block";
            panelCms.style.display = cms ? "block" : "none";
            tabPractice.classList.toggle("active", !cms);
            tabCms.classList.toggle("active", cms);
        }

        tabPractice.addEventListener("click", function () {
            showTab("practice");
        });
        tabCms.addEventListener("click", function () {
            showTab("cms");
        });

        const h0 = (window.location.hash || "").toLowerCase();
        if (h0.includes("admin") || h0.includes("cms")) {
            showTab("cms");
        }

        const back = document.getElementById("dsa-portal-back-app");
        if (back) {
            back.addEventListener("click", function () {
                window.location.hash = "#app";
                if (typeof window.dsaApplyShellRoute === "function") {
                    window.dsaApplyShellRoute();
                }
            });
        }

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

        let mode = "signin";
        let step = 1;

        function practiceMsg(text, cls) {
            msgEl.textContent = text || "";
            msgEl.className = "status" + (cls ? " " + cls : "");
        }

        function apiAuth(path) {
            return new URL("api/auth/" + path, window.location.href).href;
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
                window.location.hash = "#app";
                if (typeof window.dsaApplyShellRoute === "function") {
                    window.dsaApplyShellRoute();
                }
                if (typeof syncNavbarAuthUi === "function") {
                    syncNavbarAuthUi();
                }
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
            if (typeof syncNavbarAuthUi === "function") {
                syncNavbarAuthUi();
            }
        });

        setMode("signin");
        updatePracticeSignedInUi();

        const status = document.getElementById("cms-status");
        const authPanel = document.getElementById("cms-auth-panel");
        const editorSection = document.getElementById("cms-editor-section");

        const AUTH_ERR_LABELS = {
            bad_password: "Wrong password.",
            bad_totp: "Invalid authenticator code.",
        };

        function setCmsStatus(msg, cls) {
            if (!status) {
                return;
            }
            status.textContent = msg || "";
            status.className = "status" + (cls ? " " + cls : "");
        }

        function getWorkerBase() {
            const m = document.querySelector('meta[name="dsa-admin-oauth-base"]');
            return (m && m.getAttribute("content") || "").trim().replace(/\/+$/, "");
        }

        function consumeAdminErr() {
            const hash = window.location.hash || "";
            if (!hash.startsWith("#")) {
                return null;
            }
            const rest = hash.slice(1);
            const qIndex = rest.indexOf("&");
            const query = qIndex >= 0 ? rest.slice(qIndex + 1) : "";
            const params = new URLSearchParams(query);
            const err = params.get("dsa_admin_err");
            if (!err) {
                return null;
            }
            params.delete("dsa_admin_err");
            const tail = params.toString();
            const route = qIndex >= 0 ? rest.slice(0, qIndex) : rest.split("?")[0];
            const newHash = route + (tail ? "&" + tail : "");
            window.history.replaceState(
                null,
                "",
                window.location.pathname + window.location.search + (newHash ? "#" + newHash : ""),
            );
            return err;
        }

        function setCmsAuthMethod(method) {
            const pwTab = document.getElementById("cms-tab-password");
            const totpTab = document.getElementById("cms-tab-totp");
            const pwPane = document.getElementById("cms-auth-pane-password");
            const totpPane = document.getElementById("cms-auth-pane-totp");
            const isPw = method === "password";
            pwTab.classList.toggle("active", isPw);
            totpTab.classList.toggle("active", !isPw);
            pwPane.hidden = !isPw;
            totpPane.hidden = isPw;
            try {
                sessionStorage.setItem("cmsAuthMethod", isPw ? "password" : "totp");
            } catch (e) {}
        }

        function updateAdminUi() {
            const ok = typeof dsaIsAdminSession === "function" && dsaIsAdminSession();
            if (editorSection) {
                editorSection.hidden = !ok;
            }
            if (authPanel) {
                authPanel.hidden = ok;
            }
        }
        updateAdminUiRef = updateAdminUi;

        document.getElementById("cms-tab-password").addEventListener("click", function () {
            setCmsAuthMethod("password");
        });
        document.getElementById("cms-tab-totp").addEventListener("click", function () {
            setCmsAuthMethod("totp");
        });

        document.getElementById("oauth-google-btn").addEventListener("click", function () {
            practiceMsg("Google OAuth is not configured yet.", "err");
        });
        document.getElementById("oauth-apple-btn").addEventListener("click", function () {
            practiceMsg("Apple OAuth is not configured yet.", "err");
        });

        (async function initCms() {
            const baseUrl = window.location.href.split("#")[0];
            const ret = baseUrl + "#admin";
            document.getElementById("cms-return-password").value = ret;
            document.getElementById("cms-return-totp").value = ret;
            const wb = getWorkerBase();
            const cfgWarn = document.getElementById("cms-config-warn");
            if (!wb) {
                cfgWarn.hidden = false;
                cfgWarn.textContent =
                    "Set meta dsa-admin-oauth-base in index.html to your Cloudflare Worker URL.";
            } else {
                cfgWarn.hidden = true;
                document.getElementById("cms-form-password").action = wb + "/auth/password";
                document.getElementById("cms-form-totp").action = wb + "/auth/totp";
            }
            const err = consumeAdminErr();
            let initialAuthMethod = "password";
            try {
                const saved = sessionStorage.getItem("cmsAuthMethod");
                if (saved === "totp" || saved === "password") {
                    initialAuthMethod = saved;
                }
            } catch (e) {}
            if (err === "bad_totp") {
                initialAuthMethod = "totp";
            }
            setCmsAuthMethod(initialAuthMethod);

            if (typeof dsaInitAdminAuth === "function") {
                await dsaInitAdminAuth();
            }
            updateAdminUi();
            if (typeof dsaInitAccountAdminPanel === "function") {
                dsaInitAccountAdminPanel();
            }
            if (err) {
                setCmsStatus(
                    AUTH_ERR_LABELS[err] || "Sign-in failed: " + err.replace(/_/g, " ") + ".",
                    "err",
                );
            }
        })();
    };
})();
