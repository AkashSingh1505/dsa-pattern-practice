/**
 * Practice sign-in / sign-up only (account.html).
 */
(function () {
    function apiAuth(path) {
        return new URL("api/auth/" + path, window.location.href).href;
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

    if (!form || !emailEl || !passEl) {
        return;
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
            window.location.href = "./index.html";
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
        practiceMsg("Google OAuth is not configured yet.", "err");
    });
    document.getElementById("oauth-apple-btn").addEventListener("click", function () {
        practiceMsg("Apple OAuth is not configured yet.", "err");
    });

    setMode("signin");
    updatePracticeSignedInUi();
})();
