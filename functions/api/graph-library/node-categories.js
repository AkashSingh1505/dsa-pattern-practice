import { json } from "../../_lib/admin-api.js";
import { subscribersDb } from "../../_lib/d1-bindings.js";
import { listGraphNodeCategories } from "../../_lib/graph-node-category.js";

/** Public read: global node type rules for workspace UI (no auth). */
export async function onRequestGet(context) {
    const db = subscribersDb(context.env);
    if (!db) {
        return json({ error: "Subscribers D1 not bound" }, 503);
    }
    const categories = await listGraphNodeCategories(db);
    return json({ ok: true, categories });
}
