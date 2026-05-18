/**
 * Pro "Add solution" modal (approach pills, Prism editor). Used by graph customize modal.
 */
function dsaCreateSolutionSheetPro(opts) {
    const isAdmin = !!(opts && opts.isAdmin);
    const normalizeApproach =
        opts && typeof opts.normalizeApproach === "function" ? opts.normalizeApproach : () => "";
    const onSave = opts && typeof opts.onSave === "function" ? opts.onSave : () => {};

    const APPROACH_PILLS = [
        { id: "brute_force", label: "Brute Force", cls: "brute" },
        { id: "better", label: "Better", cls: "better" },
        { id: "optimal", label: "Optimal", cls: "optimal" },
    ];

    const LANGS = [
        { value: "javascript", label: "JavaScript" },
        { value: "typescript", label: "TypeScript" },
        { value: "python", label: "Python" },
        { value: "java", label: "Java" },
        { value: "cpp", label: "C++" },
        { value: "c", label: "C" },
        { value: "csharp", label: "C#" },
        { value: "go", label: "Go" },
        { value: "rust", label: "Rust" },
        { value: "ruby", label: "Ruby" },
        { value: "kotlin", label: "Kotlin" },
        { value: "swift", label: "Swift" },
        { value: "sql", label: "SQL" },
    ];

    let prismLoadPromise = null;
    function ensurePrism() {
        if (typeof Prism !== "undefined") return Promise.resolve();
        if (prismLoadPromise) return prismLoadPromise;
        const base = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0";
        const links = [base + "/themes/prism-tomorrow.min.css"];
        const scripts = [
            base + "/prism.min.js",
            base + "/components/prism-javascript.min.js",
            base + "/components/prism-typescript.min.js",
            base + "/components/prism-python.min.js",
            base + "/components/prism-java.min.js",
            base + "/components/prism-c.min.js",
            base + "/components/prism-cpp.min.js",
            base + "/components/prism-csharp.min.js",
            base + "/components/prism-go.min.js",
            base + "/components/prism-rust.min.js",
            base + "/components/prism-ruby.min.js",
            base + "/components/prism-kotlin.min.js",
            base + "/components/prism-swift.min.js",
            base + "/components/prism-sql.min.js",
        ];
        prismLoadPromise = new Promise((resolve) => {
            links.forEach((href) => {
                if (!document.querySelector('link[href="' + href + '"]')) {
                    const el = document.createElement("link");
                    el.rel = "stylesheet";
                    el.href = href;
                    document.head.appendChild(el);
                }
            });
            let pending = scripts.length;
            const done = () => { pending -= 1; if (pending <= 0) resolve(); };
            scripts.forEach((src) => {
                if (document.querySelector('script[src="' + src + '"]')) { done(); return; }
                const el = document.createElement("script");
                el.src = src;
                el.onload = done;
                el.onerror = done;
                document.head.appendChild(el);
            });
            setTimeout(resolve, 5000);
        });
        return prismLoadPromise;
    }

    const overlay = document.createElement("div");
    overlay.className = "dsa-sol-pro-overlay";
    overlay.hidden = true;

    const modal = document.createElement("div");
    modal.className = "dsa-sol-pro-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const grabber = document.createElement("div");

    grabber.className = "dsa-sol-pro-grabber";
    grabber.setAttribute("aria-hidden", "true");

    const header = document.createElement("div");
    header.className = "dsa-sol-pro-header";
    const titleEl = document.createElement("h2");
    titleEl.id = "dsa-sol-pro-title";
    titleEl.textContent = "Add solution";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "dsa-sol-pro-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    const form = document.createElement("form");
    form.className = "dsa-sol-pro-body";
    form.id = "dsaSolProForm";

    const approachField = document.createElement("div");
    approachField.className = "dsa-sol-pro-field";
    const approachLab = document.createElement("div");
    approachLab.className = "dsa-sol-pro-label";
    approachLab.innerHTML = 'Approach <span class="req">*</span>';
    const approachGroup = document.createElement("div");
    approachGroup.className = "dsa-sol-pro-approach-group";
    const approachHidden = document.createElement("input");
    approachHidden.type = "hidden";
    approachHidden.id = "dsaSolProApproach";

    APPROACH_PILLS.forEach((p, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dsa-sol-pro-approach-pill " + p.cls;
        btn.dataset.id = p.id;
        btn.innerHTML = '<span class="num">' + (i + 1) + '</span> ' + p.label;
        approachGroup.appendChild(btn);
    });
    approachField.appendChild(approachLab);
    approachField.appendChild(approachGroup);
    approachField.appendChild(approachHidden);

    const row = document.createElement("div");
    row.className = "dsa-sol-pro-row";

    const timeField = document.createElement("div");
    timeField.className = "dsa-sol-pro-field";
    const timeLab = document.createElement("label");
    timeLab.className = "dsa-sol-pro-label";
    timeLab.htmlFor = "dsaSolProTime";
    timeLab.innerHTML = 'Time Complexity <span class="req">*</span>';
    const timeIn = document.createElement("input");
    timeIn.className = "dsa-sol-pro-input";
    timeIn.id = "dsaSolProTime";
    timeIn.type = "text";
    timeIn.placeholder = "e.g. O(n)";
    timeIn.required = true;
    timeField.appendChild(timeLab);
    timeField.appendChild(timeIn);

    const spaceField = document.createElement("div");
    spaceField.className = "dsa-sol-pro-field";
    const spaceLab = document.createElement("label");
    spaceLab.className = "dsa-sol-pro-label";
    spaceLab.htmlFor = "dsaSolProSpace";
    spaceLab.innerHTML = 'Space Complexity <span class="req">*</span>';
    const spaceIn = document.createElement("input");
    spaceIn.className = "dsa-sol-pro-input";
    spaceIn.id = "dsaSolProSpace";
    spaceIn.type = "text";
    spaceIn.placeholder = "e.g. O(1)";
    spaceIn.required = true;
    spaceField.appendChild(spaceLab);
    spaceField.appendChild(spaceIn);
    row.appendChild(timeField);
    row.appendChild(spaceField);

    const codeField = document.createElement("div");
    codeField.className = "dsa-sol-pro-field";
    const codeLab = document.createElement("div");
    codeLab.className = "dsa-sol-pro-label";
    codeLab.innerHTML = 'Solution Code <span class="req">*</span>';

    const editor = document.createElement("div");
    editor.className = "dsa-sol-pro-editor";
    editor.id = "dsaSolProEditor";

    const toolbar = document.createElement("div");
    toolbar.className = "dsa-sol-pro-editor-toolbar";
    const dots = document.createElement("div");
    dots.className = "dsa-sol-pro-dots";
    dots.innerHTML = '<span class="dsa-sol-pro-dot r"></span><span class="dsa-sol-pro-dot y"></span><span class="dsa-sol-pro-dot g"></span>';
    const langWrap = document.createElement("div");
    langWrap.className = "dsa-sol-pro-lang-pick";
    const langSel = document.createElement("select");
    langSel.id = "dsaSolProLang";
    langSel.setAttribute("aria-label", "Language");
    LANGS.forEach((l) => {
        const o = document.createElement("option");
        o.value = l.value;
        o.textContent = l.label;
        langSel.appendChild(o);
    });
    langWrap.appendChild(langSel);
    toolbar.appendChild(dots);
    toolbar.appendChild(langWrap);

    const editorBody = document.createElement("div");
    editorBody.className = "dsa-sol-pro-editor-body";
    const gutter = document.createElement("div");
    gutter.className = "dsa-sol-pro-gutter";
    gutter.id = "dsaSolProGutter";
    gutter.textContent = "1";
    const pre = document.createElement("pre");
    pre.setAttribute("aria-hidden", "true");
    const codeHighlight = document.createElement("code");
    codeHighlight.id = "dsaSolProHighlight";
    codeHighlight.className = "language-javascript";
    pre.appendChild(codeHighlight);
    const codeTa = document.createElement("textarea");
    codeTa.id = "dsaSolProCode";
    codeTa.spellcheck = false;
    codeTa.placeholder = "// Write your solution here…";
    codeTa.required = true;
    editorBody.appendChild(gutter);
    editorBody.appendChild(pre);
    editorBody.appendChild(codeTa);

    const status = document.createElement("div");
    status.className = "dsa-sol-pro-editor-status";
    status.innerHTML = '<div class="left"><span><span class="dsa-sol-pro-dot-live"></span> Live highlighting</span><span id="dsaSolProLangLabel">JavaScript</span></div><div class="right"><span id="dsaSolProLineCol">Ln 1, Col 1</span> · <span id="dsaSolProChars">0 chars</span></div>';
    editor.appendChild(toolbar);
    editor.appendChild(editorBody);
    editor.appendChild(status);
    codeField.appendChild(codeLab);
    codeField.appendChild(editor);
    form.appendChild(approachField);
    form.appendChild(row);
    form.appendChild(codeField);

    const footer = document.createElement("div");
    footer.className = "dsa-sol-pro-footer";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "dsa-sol-pro-btn dsa-sol-pro-btn-secondary";
    cancelBtn.textContent = "Cancel";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "dsa-sol-pro-btn dsa-sol-pro-btn-primary";
    saveBtn.id = "dsaSolProSave";
    saveBtn.disabled = true;
    const saveLabel = document.createElement("span");
    saveLabel.id = "dsaSolProSaveLabel";
    saveLabel.textContent = "Save solution";
    saveBtn.appendChild(saveLabel);
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);

    modal.appendChild(grabber);
    modal.appendChild(header);
    modal.appendChild(form);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    const toast = document.createElement("div");
    toast.className = "dsa-sol-pro-toast";
    toast.innerHTML = '<span class="check">✓</span><span>Solution saved</span>';

    const langLabel = status.querySelector("#dsaSolProLangLabel");
    const lineColInfo = status.querySelector("#dsaSolProLineCol");
    const charInfo = status.querySelector("#dsaSolProChars");

    let editIndex = null;
    let saving = false;

    function setApproach(id) {
        approachHidden.value = id || "";
        approachGroup.querySelectorAll(".dsa-sol-pro-approach-pill").forEach((b) => {
            b.classList.toggle("active", b.dataset.id === id);
        });
        validate();
    }

    approachGroup.addEventListener("click", (e) => {
        const btn = e.target.closest(".dsa-sol-pro-approach-pill");
        if (!btn) return;
        setApproach(btn.dataset.id || "");
    });

    function validate() {
        const ok = isAdmin && !saving && !!normalizeApproach(approachHidden.value) && timeIn.value.trim() && spaceIn.value.trim() && codeTa.value.trim();
        saveBtn.disabled = !ok;
    }
    form.addEventListener("input", validate);

    function updateHighlight() {
        codeHighlight.textContent = codeTa.value.endsWith("\n") ? codeTa.value + " " : codeTa.value;
        if (typeof Prism !== "undefined") {
            try { Prism.highlightElement(codeHighlight); } catch (err) { /* ignore */ }
        }
        updateGutter();
        updateStatus();
    }
    function updateGutter() {
        const lines = codeTa.value.split("\n").length;
        let out = "";
        for (let i = 1; i <= lines; i++) out += i + "\n";
        gutter.textContent = out;
    }
    function updateStatus() {
        const val = codeTa.value;
        charInfo.textContent = val.length + " chars";
        const pos = codeTa.selectionStart;
        const before = val.substring(0, pos);
        const line = before.split("\n").length;
        const col = pos - before.lastIndexOf("\n");
        lineColInfo.textContent = "Ln " + line + ", Col " + col;
    }
    function syncScroll() {
        pre.scrollTop = codeTa.scrollTop;
        pre.scrollLeft = codeTa.scrollLeft;
        gutter.style.transform = "translateY(" + (-codeTa.scrollTop) + "px)";
    }
    function setLanguage(lang) {
        codeHighlight.className = "language-" + lang;
        const opt = langSel.options[langSel.selectedIndex];
        if (langLabel) langLabel.textContent = opt ? opt.textContent : lang;
        updateHighlight();
    }

    codeTa.addEventListener("input", () => { updateHighlight(); syncScroll(); validate(); });
    codeTa.addEventListener("scroll", syncScroll);
    codeTa.addEventListener("keyup", updateStatus);
    codeTa.addEventListener("click", updateStatus);
    codeTa.addEventListener("focus", () => editor.classList.add("focused"));
    codeTa.addEventListener("blur", () => editor.classList.remove("focused"));
    langSel.addEventListener("change", () => setLanguage(langSel.value));
    [timeIn, spaceIn].forEach((el) => el.addEventListener("input", validate));

    const pairs = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
    codeTa.addEventListener("keydown", (e) => {
        const start = codeTa.selectionStart, end = codeTa.selectionEnd, val = codeTa.value;
        if (e.key === "Tab") {
            e.preventDefault();
            if (e.shiftKey) {
                const ls = val.lastIndexOf("\n", start - 1) + 1;
                if (val.substring(ls, ls + 2) === "  ") {
                    codeTa.value = val.substring(0, ls) + val.substring(ls + 2);
                    codeTa.selectionStart = codeTa.selectionEnd = Math.max(start - 2, ls);
                }
            } else {
                codeTa.value = val.substring(0, start) + "  " + val.substring(end);
                codeTa.selectionStart = codeTa.selectionEnd = start + 2;
            }
            updateHighlight();
            return;
        }
        if (e.key === "Enter") {
            const ls = val.lastIndexOf("\n", start - 1) + 1;
            const indent = val.substring(ls, start).match(/^\s*/)[0];
            const last = val[start - 1], next = val[start] || "";
            let extra = "({[".includes(last) ? "  " : "";
            e.preventDefault();
            if (extra && [")", "}", "]"].includes(next) && pairs[last] === next) {
                const ins = "\n" + indent + extra + "\n" + indent;
                codeTa.value = val.substring(0, start) + ins + val.substring(end);
                codeTa.selectionStart = codeTa.selectionEnd = start + ("\n" + indent + extra).length;
            } else {
                const ins = "\n" + indent + extra;
                codeTa.value = val.substring(0, start) + ins + val.substring(end);
                codeTa.selectionStart = codeTa.selectionEnd = start + ins.length;
            }
            updateHighlight();
            return;
        }
        if (pairs[e.key]) {
            e.preventDefault();
            const cl = pairs[e.key], sel = val.substring(start, end);
            codeTa.value = val.substring(0, start) + e.key + sel + cl + val.substring(end);
            codeTa.selectionStart = start + 1;
            codeTa.selectionEnd = end + 1;
            updateHighlight();
            return;
        }
        if ([")", "]", "}"].includes(e.key) && val[start] === e.key) {
            e.preventDefault();
            codeTa.selectionStart = codeTa.selectionEnd = start + 1;
        }
    });

    function close() {
        overlay.classList.remove("open");
        overlay.hidden = true;
        document.body.style.overflow = "";
        editIndex = null;
        saving = false;
    }

    function open(index, sol) {
        editIndex = index;
        const isEdit = index != null && index >= 0;
        titleEl.textContent = isEdit ? "Edit solution" : "Add solution";
        setApproach(sol ? normalizeApproach(sol.approach) : "");
        timeIn.value = sol && sol.timeComplexity ? String(sol.timeComplexity) : "";
        spaceIn.value = sol && sol.spaceComplexity ? String(sol.spaceComplexity) : "";
        codeTa.value = sol && sol.code != null ? String(sol.code) : "";
        ensurePrism().then(() => { setLanguage(langSel.value || "javascript"); updateHighlight(); });
        validate();
        overlay.hidden = false;
        requestAnimationFrame(() => {
            overlay.classList.add("open");
            document.body.style.overflow = "hidden";
            const first = approachGroup.querySelector(".dsa-sol-pro-approach-pill");
            if (first) setTimeout(() => first.focus(), 200);
        });
    }

    function commit() {
        const approach = normalizeApproach(approachHidden.value);
        const timeComplexity = timeIn.value.trim();
        const spaceComplexity = spaceIn.value.trim();
        const code = codeTa.value.trim();
        if (!approach || !timeComplexity || !spaceComplexity || !code) return;
        saving = true;
        saveBtn.disabled = true;
        saveLabel.innerHTML = '<span class="dsa-sol-pro-spinner"></span> Saving…';
        setTimeout(() => {
            onSave({ editIndex, approach, timeComplexity, spaceComplexity, code });
            saveLabel.textContent = "Save solution";
            saving = false;
            close();
            toast.classList.add("show");
            setTimeout(() => toast.classList.remove("show"), 2200);
            form.reset();
            approachHidden.value = "";
            approachGroup.querySelectorAll(".dsa-sol-pro-approach-pill").forEach((b) => b.classList.remove("active"));
            codeTa.value = "";
            updateHighlight();
            validate();
        }, 400);
    }

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    modal.addEventListener("click", (e) => e.stopPropagation());
    closeBtn.addEventListener("click", close);
    cancelBtn.addEventListener("click", close);
    saveBtn.addEventListener("click", commit);

    document.addEventListener("keydown", function solProKey(e) {
        if (overlay.hidden || !overlay.classList.contains("open")) return;
        if (e.key === "Escape") close();
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !saveBtn.disabled) { e.preventDefault(); commit(); }
    });

    setLanguage("javascript");

    return {
        backdrop: overlay,
        toast,
        open,
        close,
        isOpen() { return !overlay.hidden && overlay.classList.contains("open"); },
    };
}
