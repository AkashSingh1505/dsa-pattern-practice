/**
 * New graph mind-map body: **one** top-level object with `nodeCategorySlug: "ROOT"` and `name` = graph title.
 * **`tree` starts empty** so the UI shows a single hub until topics are added under `tree`.
 *
 * Same shape for member graphs (`POST /api/graph-library/mine`) and catalog drafts (`graph-catalog`).
 *
 * Topics live under `tree` (each may use `children` for nesting). `patterns` / `problems` on
 * the root are usually empty for a fresh graph.
 *
 * @example
 * [
 *   {
 *     id: "mind-root-abc123xyz",
 *     name: "My DSA map",
 *     nodeCategorySlug: "ROOT",
 *     tree: [
 *       {
 *         name: "Array",
 *         nodeCategorySlug: "TOPIC",
 *         children: [
 *           {
 *             name: "Sliding Window",
 *             nodeCategorySlug: "TOPIC",
 *             children: [
 *               {
 *                 name: "Fixed Size",
 *                 nodeCategorySlug: "TOPIC",
 *                 problems: [
 *                   { name: "Maximum Average Subarray I", url: "https://…", nodeCategorySlug: "PROBLEM" },
 *                 ],
 *               },
 *             ],
 *           },
 *         ],
 *       },
 *     ],
 *     patterns: [],
 *     problems: [],
 *   },
 * ]
 *
 * @param {string} title Graph title / label (root `name`).
 * @param {{ idPrefix?: string }} [opts] Optional id prefix (default `mind-root-`).
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
