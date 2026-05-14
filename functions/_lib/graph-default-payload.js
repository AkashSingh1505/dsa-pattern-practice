/**
 * New graph mind-map body: a single ROOT node whose display name matches the graph title.
 * @param {string} title Graph title / label (required for member graphs; catalog may pass slug title).
 * @param {{ idPrefix?: string }} [opts]
 * @returns {object[]}
 */
export function defaultMindMapGraphPayloadFromTitle(title, opts = {}) {
    const prefix = opts.idPrefix != null ? String(opts.idPrefix) : "mind-root-";
    const name = String(title == null ? "" : title)
        .trim()
        .slice(0, 80) || "Untitled graph";
    return [
        {
            id: prefix + Math.random().toString(36).slice(2, 11),
            name,
            nodeCategorySlug: "ROOT",
            tree: [],
            patterns: [],
            problems: [],
        },
    ];
}
