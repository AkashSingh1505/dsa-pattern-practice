/**
 * Searchable multi-select company picker (logos, custom companies).
 * @param {HTMLElement} mountEl
 * @param {{ presets?: {label:string}[], initialSelected?: string[], onChange?: (names:string[])=>void, layout?: 'default'|'compact' }} opts
 */
function dsaMountCompanySelector(mountEl, opts) {
    if (opts && opts.layout === "compact") {
        return dsaMountCompanySelectorCompact(mountEl, opts);
    }
    const presets = (opts && opts.presets) || [];
    const onChange = opts && typeof opts.onChange === "function" ? opts.onChange : () => {};
    let disabled = false;
    let isAdding = false;

    const BUILTIN_LOGOS = {
        Google: '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35 44 30 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>',
        Meta: '<svg viewBox="0 0 48 48"><path fill="#0082FB" d="M9 24c0-7 4-13 10-13 4 0 7 2 11 8l3 5c3 5 5 7 8 7s5-2 5-6c0-3-1-7-3-11l4-2c2 4 4 9 4 13 0 7-3 11-9 11-4 0-7-2-11-8l-3-5c-3-5-5-7-8-7s-6 4-6 9c0 4 1 8 3 11l-4 3c-3-4-4-9-4-15z"/></svg>',
        Amazon: '<svg viewBox="0 0 48 48"><path fill="#FF9900" d="M37.2 33.5c-7.3 5.4-17.9 8.3-27 8.3-12.8 0-24.3-4.7-33-12.6-.7-.6-.1-1.5.8-1 9.3 5.4 20.8 8.7 32.7 8.7 8.1 0 17-1.7 25.2-5.2 1.2-.5 2.3.8 1.3 1.8z"/><path fill="#000" d="M31.7 8.5V5.6c.4 0 .7.3.7.7v2.5c0 .4-.4.9-1 1.8L38.5 19c2.5-.1 5.2.3 7.5 1.6.5.3.7.7.7 1.1v3.1c0 .4-.5.9-1 .7-4-2.1-9.4-2.3-13.9 0-.5.3-.9-.2-.9-.6v-3c0-.5 0-1.3.5-2l7.8-11.2h-6.8c-.4 0-.7-.3-.7-.7z"/></svg>',
        Microsoft: '<svg viewBox="0 0 48 48"><path fill="#F25022" d="M6 6h18v18H6z"/><path fill="#7FBA00" d="M24 6h18v18H24z"/><path fill="#00A4EF" d="M6 24h18v18H6z"/><path fill="#FFB900" d="M24 24h18v18H24z"/></svg>',
        Apple: '<svg viewBox="0 0 48 48"><path fill="currentColor" d="M33.5 25.4c0-5.4 4.4-8 4.6-8.1-2.5-3.7-6.4-4.2-7.8-4.2-3.3-.3-6.5 2-8.1 2-1.7 0-4.3-1.9-7-1.9-3.6.1-6.9 2.1-8.7 5.3-3.8 6.5-1 16.1 2.6 21.4 1.8 2.6 3.9 5.5 6.7 5.4 2.7-.1 3.7-1.7 7-1.7 3.2 0 4.2 1.7 7.1 1.7 2.9-.1 4.8-2.6 6.6-5.2 2.1-3 2.9-5.9 3-6-.1-.1-5.8-2.2-5.8-8.7zM28.1 9.8c1.5-1.8 2.4-4.2 2.2-6.7-2.1.1-4.7 1.4-6.2 3.2-1.4 1.6-2.5 4.1-2.2 6.5 2.3.2 4.7-1.2 6.2-3z"/></svg>',
        Netflix: '<svg viewBox="0 0 48 48"><path fill="#E50914" d="M13 4h7l8 24V4h7v40l-7-1-8-24v25l-7-1z"/></svg>',
        Tesla: '<svg viewBox="0 0 48 48"><path fill="#CC0000" d="M24 10c-7 0-12-2-13-3 1 5 5 8 9 8l4 11 4-11c4 0 8-3 9-8-1 1-6 3-13 3zM7 6c5 2 11 3 17 3s12-1 17-3l-3 4c-5 1-9 2-14 2s-9-1-14-2L7 6z"/></svg>',
        NVIDIA: '<svg viewBox="0 0 48 48"><path fill="#76B900" d="M18 17v-3c8-.4 14 6 14 6s-7 8-14 6v-2c4 1 8-3 8-3s-4-5-8-4zm0 13v3c12 1 19-10 19-10S30 13 18 14v3c10-1 16 7 16 7s-6 7-16 6z"/></svg>',
        Adobe: '<svg viewBox="0 0 48 48"><path fill="#FA0F00" d="M8 6h13l17 36H32l-4-9h-9l-2 9H8zm17 21l-3-9-4 9z"/></svg>',
    };

    const palettes = [
        ["#FF6A00", "#EE0979"],
        ["#36D1DC", "#5B86E5"],
        ["#7F00FF", "#E100FF"],
        ["#11998E", "#38EF7D"],
        ["#F2994A", "#F2C94C"],
        ["#EB3349", "#F45C43"],
        ["#43CEA2", "#185A9D"],
        ["#FF512F", "#DD2476"],
    ];

    function getGradient(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
        return palettes[h % palettes.length];
    }

    function getInitials(name) {
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    function customLogo(name) {
        const [c1, c2] = getGradient(name);
        const id = "g" + Math.random().toString(36).slice(2, 8);
        return (
            '<svg viewBox="0 0 48 48"><defs><linearGradient id="' +
            id +
            '" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="' +
            c1 +
            '"/><stop offset="100%" stop-color="' +
            c2 +
            '"/></linearGradient></defs><rect width="48" height="48" rx="12" fill="url(#' +
            id +
            ')"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="22" fill="white">' +
            getInitials(name) +
            "</text></svg>"
        );
    }

    const builtIn = presets.map((p) => {
        const name = p.label || p.name || String(p);
        return { name, logo: BUILTIN_LOGOS[name] || customLogo(name), custom: false };
    });

    let customCompanies = [];
    const selected = new Set((opts && opts.initialSelected) || []);

    const root = document.createElement("div");
    root.className = "dsa-co-sel";

    const header = document.createElement("div");
    header.className = "dsa-co-sel-header";
    const hint = document.createElement("p");
    hint.className = "dsa-co-sel-hint";
    hint.textContent = "Search and select companies that ask this type of problem.";
    const searchWrap = document.createElement("div");
    searchWrap.className = "dsa-co-sel-search";
    searchWrap.innerHTML =
        '<svg class="icon-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/></svg>';
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search companies…";
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "dsa-co-sel-clear";
    clearBtn.setAttribute("aria-label", "Clear");
    clearBtn.textContent = "✕";
    searchWrap.appendChild(searchInput);
    searchWrap.appendChild(clearBtn);

    const list = document.createElement("div");
    list.className = "dsa-co-sel-list";

    const footer = document.createElement("div");
    footer.className = "dsa-co-sel-footer";
    const countEl = document.createElement("span");
    const clearAllBtn = document.createElement("button");
    clearAllBtn.type = "button";
    clearAllBtn.textContent = "Clear all";
    footer.appendChild(countEl);
    footer.appendChild(clearAllBtn);

    header.appendChild(hint);
    header.appendChild(searchWrap);
    root.appendChild(header);
    root.appendChild(list);
    root.appendChild(footer);
    mountEl.appendChild(root);

    function getAll() {
        return [...builtIn, ...customCompanies];
    }

    function emit() {
        onChange(Array.from(selected));
    }

    function updateCount() {
        countEl.textContent = selected.size + " selected";
    }

    function render(filter) {
        filter = filter || "";
        list.innerHTML = "";
        const all = getAll();
        const filtered = all.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));

        if (filtered.length) {
            filtered.forEach((c) => {
                const isSel = selected.has(c.name);
                const el = document.createElement("div");
                el.className = "dsa-co-sel-item" + (isSel ? " selected" : "");
                el.innerHTML =
                    '<div class="dsa-co-sel-checkbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg></div>' +
                    '<div class="dsa-co-sel-logo">' +
                    c.logo +
                    '</div><div class="dsa-co-sel-name">' +
                    c.name +
                    (c.custom ? '<span class="dsa-co-sel-badge">Custom</span>' : "") +
                    "</div>" +
                    (c.custom
                        ? '<button type="button" class="dsa-co-sel-remove" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
                        : "");
                el.addEventListener("click", (e) => {
                    if (e.target.closest(".dsa-co-sel-remove")) return;
                    if (selected.has(c.name)) selected.delete(c.name);
                    else selected.add(c.name);
                    render(searchInput.value);
                    emit();
                });
                const rb = el.querySelector(".dsa-co-sel-remove");
                if (rb) {
                    rb.addEventListener("click", (e) => {
                        e.stopPropagation();
                        customCompanies = customCompanies.filter((x) => x.name !== c.name);
                        selected.delete(c.name);
                        render(searchInput.value);
                        emit();
                    });
                }
                list.appendChild(el);
            });
        } else if (!isAdding) {
            const empty = document.createElement("div");
            empty.className = "dsa-co-sel-empty";
            empty.textContent = "No companies found";
            list.appendChild(empty);
        }

        if (isAdding) {
            const form = document.createElement("div");
            form.className = "dsa-co-sel-add-form";
            form.innerHTML =
                '<div class="dsa-co-sel-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>' +
                '<input type="text" placeholder="Enter company name…" maxlength="40" autocomplete="off" />' +
                '<button type="button" class="cancel" title="Cancel">✕</button>' +
                '<button type="button" class="ok" title="Add" disabled>✓</button>';
            list.appendChild(form);
            const input = form.querySelector("input");
            const okBtn = form.querySelector(".ok");
            const cancelBtn = form.querySelector(".cancel");
            setTimeout(() => input.focus(), 0);
            const validate = () => {
                const v = input.value.trim();
                const exists = getAll().some((c) => c.name.toLowerCase() === v.toLowerCase());
                okBtn.disabled = !v || exists;
            };
            input.addEventListener("input", validate);
            const submit = () => {
                const v = input.value.trim();
                if (!v || getAll().some((c) => c.name.toLowerCase() === v.toLowerCase())) return;
                customCompanies.push({ name: v, logo: customLogo(v), custom: true });
                selected.add(v);
                isAdding = false;
                searchInput.value = "";
                clearBtn.classList.remove("visible");
                render();
                emit();
            };
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") {
                    isAdding = false;
                    render(searchInput.value);
                }
            });
            okBtn.addEventListener("click", submit);
            cancelBtn.addEventListener("click", () => {
                isAdding = false;
                render(searchInput.value);
            });
        } else {
            const addItem = document.createElement("div");
            addItem.className = "dsa-co-sel-item add-other";
            addItem.innerHTML =
                '<div class="dsa-co-sel-checkbox" style="visibility:hidden"></div><div class="dsa-co-sel-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div><div class="dsa-co-sel-name">Add other company…</div>';
            addItem.addEventListener("click", () => {
                isAdding = true;
                render(searchInput.value);
            });
            list.appendChild(addItem);
        }
        updateCount();
    }

    searchInput.addEventListener("input", (e) => {
        clearBtn.classList.toggle("visible", e.target.value.length > 0);
        render(e.target.value);
    });
    clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        clearBtn.classList.remove("visible");
        render();
        searchInput.focus();
    });
    clearAllBtn.addEventListener("click", () => {
        selected.clear();
        render(searchInput.value);
        emit();
    });

    render();

    return {
        getSelected() {
            return Array.from(selected);
        },
        setSelected(names) {
            selected.clear();
            const known = new Set(getAll().map((c) => c.name.toLowerCase()));
            (names || []).forEach((n) => {
                const s = String(n || "").trim();
                if (!s) return;
                if (!known.has(s.toLowerCase())) {
                    customCompanies.push({ name: s, logo: customLogo(s), custom: true });
                    known.add(s.toLowerCase());
                }
                selected.add(s);
            });
            render(searchInput.value);
            updateCount();
        },
        setDisabled(ro) {
            disabled = !!ro;
            root.classList.toggle("is-disabled", disabled);
            searchInput.disabled = disabled;
        },
    };
}

function dsaMountCompanySelectorCompact(mountEl, opts) {
    const presets = (opts && opts.presets) || [];
    const onChange = opts && typeof opts.onChange === "function" ? opts.onChange : () => {};
    let disabled = false;

    const BUILTIN_LOGOS = {
        Google: '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35 44 30 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>',
        Meta: '<svg viewBox="0 0 48 48"><path fill="#0082FB" d="M9 24c0-7 4-13 10-13 4 0 7 2 11 8l3 5c3 5 5 7 8 7s5-2 5-6c0-3-1-7-3-11l4-2c2 4 4 9 4 13 0 7-3 11-9 11-4 0-7-2-11-8l-3-5c-3-5-5-7-8-7s-6 4-6 9c0 4 1 8 3 11l-4 3c-3-4-4-9-4-15z"/></svg>',
        Amazon: '<svg viewBox="0 0 48 48"><path fill="#FF9900" d="M37.2 33.5c-7.3 5.4-17.9 8.3-27 8.3-12.8 0-24.3-4.7-33-12.6-.7-.6-.1-1.5.8-1 9.3 5.4 20.8 8.7 32.7 8.7 8.1 0 17-1.7 25.2-5.2 1.2-.5 2.3.8 1.3 1.8z"/><path fill="#000" d="M31.7 8.5V5.6c.4 0 .7.3.7.7v2.5c0 .4-.4.9-1 1.8L38.5 19c2.5-.1 5.2.3 7.5 1.6.5.3.7.7.7 1.1v3.1c0 .4-.5.9-1 .7-4-2.1-9.4-2.3-13.9 0-.5.3-.9-.2-.9-.6v-3c0-.5 0-1.3.5-2l7.8-11.2h-6.8c-.4 0-.7-.3-.7-.7z"/></svg>',
        Microsoft: '<svg viewBox="0 0 48 48"><path fill="#F25022" d="M6 6h18v18H6z"/><path fill="#7FBA00" d="M24 6h18v18H24z"/><path fill="#00A4EF" d="M6 24h18v18H6z"/><path fill="#FFB900" d="M24 24h18v18H24z"/></svg>',
        Apple: '<svg viewBox="0 0 48 48"><path fill="currentColor" d="M33.5 25.4c0-5.4 4.4-8 4.6-8.1-2.5-3.7-6.4-4.2-7.8-4.2-3.3-.3-6.5 2-8.1 2-1.7 0-4.3-1.9-7-1.9-3.6.1-6.9 2.1-8.7 5.3-3.8 6.5-1 16.1 2.6 21.4 1.8 2.6 3.9 5.5 6.7 5.4 2.7-.1 3.7-1.7 7-1.7 3.2 0 4.2 1.7 7.1 1.7 2.9-.1 4.8-2.6 6.6-5.2 2.1-3 2.9-5.9 3-6-.1-.1-5.8-2.2-5.8-8.7zM28.1 9.8c1.5-1.8 2.4-4.2 2.2-6.7-2.1.1-4.7 1.4-6.2 3.2-1.4 1.6-2.5 4.1-2.2 6.5 2.3.2 4.7-1.2 6.2-3z"/></svg>',
        Netflix: '<svg viewBox="0 0 48 48"><path fill="#E50914" d="M13 4h7l8 24V4h7v40l-7-1-8-24v25l-7-1z"/></svg>',
        Tesla: '<svg viewBox="0 0 48 48"><path fill="#CC0000" d="M24 10c-7 0-12-2-13-3 1 5 5 8 9 8l4 11 4-11c4 0 8-3 9-8-1 1-6 3-13 3zM7 6c5 2 11 3 17 3s12-1 17-3l-3 4c-5 1-9 2-14 2s-9-1-14-2L7 6z"/></svg>',
        NVIDIA: '<svg viewBox="0 0 48 48"><path fill="#76B900" d="M18 17v-3c8-.4 14 6 14 6s-7 8-14 6v-2c4 1 8-3 8-3s-4-5-8-4zm0 13v3c12 1 19-10 19-10S30 13 18 14v3c10-1 16 7 16 7s-6 7-16 6z"/></svg>',
        Adobe: '<svg viewBox="0 0 48 48"><path fill="#FA0F00" d="M8 6h13l17 36H32l-4-9h-9l-2 9H8zm17 21l-3-9-4 9z"/></svg>',
        Bloomberg: "",
        Uber: "",
        Oracle: "",
        Stripe: "",
    };

    const palettes = [
        ["#FF6A00", "#EE0979"],
        ["#36D1DC", "#5B86E5"],
        ["#7F00FF", "#E100FF"],
        ["#11998E", "#38EF7D"],
        ["#F2994A", "#F2C94C"],
        ["#EB3349", "#F45C43"],
        ["#43CEA2", "#185A9D"],
        ["#FF512F", "#DD2476"],
    ];

    function getGradient(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
        return palettes[h % palettes.length];
    }

    function getInitials(name) {
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    function customLogo(name) {
        const [c1, c2] = getGradient(name);
        const id = "g" + Math.random().toString(36).slice(2, 8);
        return (
            '<svg viewBox="0 0 48 48"><defs><linearGradient id="' +
            id +
            '" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="' +
            c1 +
            '"/><stop offset="100%" stop-color="' +
            c2 +
            '"/></linearGradient></defs><rect width="48" height="48" rx="12" fill="url(#' +
            id +
            ')"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="22" fill="white">' +
            getInitials(name) +
            "</text></svg>"
        );
    }

    function logoForName(name) {
        return BUILTIN_LOGOS[name] || customLogo(name);
    }

    const builtIn = presets.map((p) => {
        const name = p.label || p.name || String(p);
        return { name, logo: logoForName(name), custom: false };
    });

    let customCompanies = [];
    let isAddingOther = false;
    const selected = new Set((opts && opts.initialSelected) || []);

    const root = document.createElement("div");
    root.className = "dsa-co-sel dsa-co-sel--compact";

    const tagsEl = document.createElement("div");
    tagsEl.className = "co-tags";

    const searchWrap = document.createElement("div");
    searchWrap.className = "co-search";
    searchWrap.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search or add a company…";
    searchInput.autocomplete = "off";
    searchWrap.appendChild(searchInput);

    const dropdown = document.createElement("div");
    dropdown.className = "co-dropdown";

    root.appendChild(tagsEl);
    root.appendChild(searchWrap);
    root.appendChild(dropdown);
    mountEl.appendChild(root);

    function getAll() {
        return [...builtIn, ...customCompanies];
    }

    function companyRecord(name) {
        const n = String(name || "").trim();
        return getAll().find((c) => c.name === n) || { name: n, logo: logoForName(n), custom: true };
    }

    function emit() {
        onChange(Array.from(selected));
    }

    function renderTags() {
        tagsEl.innerHTML = "";
        if (!selected.size) {
            const empty = document.createElement("span");
            empty.className = "co-tags-empty";
            empty.textContent = "No companies added";
            tagsEl.appendChild(empty);
            return;
        }
        Array.from(selected)
            .sort((a, b) => a.localeCompare(b))
            .forEach((name) => {
                const c = companyRecord(name);
                const tag = document.createElement("span");
                tag.className = "co-tag";
                const logoWrap = document.createElement("span");
                logoWrap.className = "co-tag-logo";
                logoWrap.innerHTML = c.logo;
                const label = document.createElement("span");
                label.textContent = c.name;
                const rm = document.createElement("button");
                rm.type = "button";
                rm.setAttribute("aria-label", "Remove " + c.name);
                rm.innerHTML =
                    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
                rm.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (disabled) return;
                    selected.delete(c.name);
                    renderTags();
                    renderDropdown(searchInput.value);
                    emit();
                });
                tag.appendChild(logoWrap);
                tag.appendChild(label);
                tag.appendChild(rm);
                tagsEl.appendChild(tag);
            });
    }

    function addCompany(name) {
        const v = String(name || "").trim();
        if (!v || selected.has(v)) return;
        if (!getAll().some((c) => c.name.toLowerCase() === v.toLowerCase())) {
            customCompanies.push({ name: v, logo: customLogo(v), custom: true });
        }
        selected.add(v);
        searchInput.value = "";
        renderTags();
        renderDropdown("");
        emit();
    }

    const plusIconSvg =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

    function renderDropdown(q) {
        dropdown.innerHTML = "";
        const query = String(q || "").trim();
        const ql = query.toLowerCase();

        if (isAddingOther) {
            const form = document.createElement("div");
            form.className = "co-add-other-form";
            const logo = document.createElement("span");
            logo.className = "co-opt-logo";
            logo.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = "Enter company name…";
            input.maxLength = 40;
            input.autocomplete = "off";
            const cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.className = "co-add-other-cancel";
            cancelBtn.title = "Cancel";
            cancelBtn.textContent = "✕";
            const okBtn = document.createElement("button");
            okBtn.type = "button";
            okBtn.className = "co-add-other-ok";
            okBtn.title = "Add";
            okBtn.textContent = "✓";
            okBtn.disabled = true;
            form.appendChild(logo);
            form.appendChild(input);
            form.appendChild(cancelBtn);
            form.appendChild(okBtn);
            dropdown.appendChild(form);
            setTimeout(() => input.focus(), 0);
            const validate = () => {
                const v = input.value.trim();
                const exists = getAll().some((c) => c.name.toLowerCase() === v.toLowerCase());
                okBtn.disabled = !v || exists;
            };
            input.addEventListener("input", validate);
            const submit = () => {
                const v = input.value.trim();
                if (!v || getAll().some((c) => c.name.toLowerCase() === v.toLowerCase())) return;
                addCompany(v);
                isAddingOther = false;
            };
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") {
                    isAddingOther = false;
                    renderDropdown(searchInput.value);
                }
            });
            okBtn.addEventListener("mousedown", (e) => {
                e.preventDefault();
                submit();
            });
            cancelBtn.addEventListener("mousedown", (e) => {
                e.preventDefault();
                isAddingOther = false;
                renderDropdown(searchInput.value);
            });
            return;
        }

        const opts = getAll().filter((c) => !selected.has(c.name) && (!ql || c.name.toLowerCase().includes(ql)));

        opts.slice(0, 8).forEach((c) => {
            const row = document.createElement("div");
            row.className = "co-option";
            row.dataset.co = c.name;
            const logo = document.createElement("span");
            logo.className = "co-opt-logo";
            logo.innerHTML = c.logo;
            const nameEl = document.createElement("span");
            nameEl.className = "co-opt-name";
            nameEl.textContent = c.name;
            const addBtn = document.createElement("span");
            addBtn.className = "co-opt-add";
            addBtn.innerHTML = plusIconSvg;
            addBtn.setAttribute("aria-hidden", "true");
            row.appendChild(logo);
            row.appendChild(nameEl);
            row.appendChild(addBtn);
            row.addEventListener("mousedown", (e) => {
                e.preventDefault();
                if (disabled) return;
                addCompany(c.name);
            });
            dropdown.appendChild(row);
        });

        if (query && !getAll().some((c) => c.name.toLowerCase() === ql) && !selected.has(query)) {
            const custom = document.createElement("div");
            custom.className = "co-option add-custom";
            custom.dataset.add = query;
            const nameEl = document.createElement("span");
            nameEl.className = "co-opt-name";
            nameEl.textContent = '+ Add "' + query + '" as custom';
            const addBtn = document.createElement("span");
            addBtn.className = "co-opt-add";
            addBtn.innerHTML = plusIconSvg;
            custom.appendChild(nameEl);
            custom.appendChild(addBtn);
            custom.addEventListener("mousedown", (e) => {
                e.preventDefault();
                if (disabled) return;
                addCompany(query);
            });
            dropdown.appendChild(custom);
        }

        const addOther = document.createElement("div");
        addOther.className = "co-option co-option--add-other";
        const addOtherLogo = document.createElement("span");
        addOtherLogo.className = "co-opt-logo";
        addOtherLogo.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        const addOtherName = document.createElement("span");
        addOtherName.className = "co-opt-name";
        addOtherName.textContent = "Add other company…";
        const addOtherBtn = document.createElement("span");
        addOtherBtn.className = "co-opt-add";
        addOtherBtn.innerHTML = plusIconSvg;
        addOther.appendChild(addOtherLogo);
        addOther.appendChild(addOtherName);
        addOther.appendChild(addOtherBtn);
        addOther.addEventListener("mousedown", (e) => {
            e.preventDefault();
            if (disabled) return;
            isAddingOther = true;
            renderDropdown(searchInput.value);
        });
        dropdown.appendChild(addOther);
    }

    function refresh() {
        renderTags();
        renderDropdown(searchInput.value);
    }

    searchInput.addEventListener("focus", () => {
        root.classList.add("focused");
        renderDropdown(searchInput.value);
    });
    searchInput.addEventListener("blur", () => {
        setTimeout(() => root.classList.remove("focused"), 150);
    });
    searchInput.addEventListener("input", (e) => {
        renderDropdown(e.target.value);
    });
    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const v = searchInput.value.trim();
            if (!v) return;
            e.preventDefault();
            const exact = getAll().find((c) => c.name.toLowerCase() === v.toLowerCase());
            addCompany(exact ? exact.name : v);
        }
    });

    refresh();

    return {
        getSelected() {
            return Array.from(selected);
        },
        setSelected(names) {
            selected.clear();
            const known = new Set(getAll().map((c) => c.name.toLowerCase()));
            (names || []).forEach((n) => {
                const s = String(n || "").trim();
                if (!s) return;
                if (!known.has(s.toLowerCase())) {
                    customCompanies.push({ name: s, logo: customLogo(s), custom: true });
                    known.add(s.toLowerCase());
                }
                selected.add(s);
            });
            refresh();
        },
        setDisabled(ro) {
            disabled = !!ro;
            root.classList.toggle("is-disabled", disabled);
            searchInput.disabled = disabled;
        },
        getCompanyLogoHtml(name) {
            return companyRecord(name).logo;
        },
    };
}

function dsaResolveCompanyLogoHtml(name, presets) {
    const presetsArr = presets || (typeof DSA_COMPANY_PRESETS !== "undefined" ? DSA_COMPANY_PRESETS : []);
    const tmp = document.createElement("div");
    const api = dsaMountCompanySelectorCompact(tmp, { presets: presetsArr });
    return api.getCompanyLogoHtml(name);
}
