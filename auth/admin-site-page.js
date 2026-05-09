/**
 * Site admin password/TOTP + dashboard init (admin.html).
 */
(function () {
    const statusDash = document.getElementById("cms-status");
    const statusAuth = document.getElementById("cms-auth-status");
    const authPanel = document.getElementById("cms-auth-panel");
    const editorSection = document.getElementById("cms-editor-section");

    const AUTH_ERR_LABELS = {
        bad_password: "Wrong password.",
        bad_totp: "Invalid authenticator code.",
    };

    function setCmsStatus(msg, cls) {
        const ok = typeof dsaIsAdminSession === "function" && dsaIsAdminSession();
        const el = ok ? statusDash : statusAuth || statusDash;
        if (!el) {
            return;
        }
        el.textContent = msg || "";
        el.className = "status" + (cls ? " " + cls : "");
    }

    function getWorkerBase() {
        const m = document.querySelector('meta[name="dsa-admin-oauth-base"]');
        return (m && m.getAttribute("content") || "").trim().replace(/\/+$/, "");
    }

    function adminReturnUrl() {
        return new URL("admin.html", window.location.href).href.split("#")[0];
    }

    function consumeAdminErr() {
        const hash = window.location.hash || "";
        if (!hash.startsWith("#")) {
            return null;
        }
        const rest = hash.slice(1);
        let query = rest;
        const amp = rest.indexOf("&");
        if (amp >= 0) {
            query = rest.slice(amp + 1);
        } else if (!rest.includes("=")) {
            return null;
        }
        const params = new URLSearchParams(query);
        const err = params.get("dsa_admin_err");
        if (!err) {
            return null;
        }
        params.delete("dsa_admin_err");
        const tail = params.toString();
        let route = amp >= 0 ? rest.slice(0, amp) : "";
        if (!route && rest.includes("dsa_admin_err")) {
            route = "";
        }
        const newHash = route + (tail ? (route ? "&" : "") + tail : route ? "" : "");
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

    document.getElementById("cms-tab-password").addEventListener("click", function () {
        setCmsAuthMethod("password");
    });
    document.getElementById("cms-tab-totp").addEventListener("click", function () {
        setCmsAuthMethod("totp");
    });

    (async function initCms() {
        const ret = adminReturnUrl();
        document.getElementById("cms-return-password").value = ret;
        document.getElementById("cms-return-totp").value = ret;
        const wb = getWorkerBase();
        const cfgWarn = document.getElementById("cms-config-warn");
        if (!wb) {
            cfgWarn.hidden = false;
            cfgWarn.textContent = "Set meta dsa-admin-oauth-base in admin.html to your Worker URL.";
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
})();
