import { json } from "../../_lib/admin-api.js";
import { requirePracticeUser } from "../../_lib/practice-auth-request.js";
import { normalizeGraphCategoriesBody, parseGraphCategoriesJson } from "../../_lib/graph-catalog-categories.js";
import { ensureUserSavedGraphCategoriesColumn } from "../../_lib/user-saved-graph-categories.js";

/**
 * GET — saved category palette for autocomplete (merged case-insensitively when graphs are saved).
 */
export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requirePracticeUser(request, env);
    if (!gate.ok) {
        return gate.response;
    }
    const { db, userId } = gate;
    await ensureUserSavedGraphCategoriesColumn(db);
    let row;
    try {
        row = await db
            .prepare("SELECT saved_graph_categories_json FROM user_profiles WHERE user_id = ?")
            .bind(userId)
            .first();
    } catch (e) {
        console.error("my-categories get", e);
        return json({ error: "server error" }, 500);
    }
    const raw = parseGraphCategoriesJson(row && row.saved_graph_categories_json);
    const n = normalizeGraphCategoriesBody(raw);
    const categories = n.ok ? n.categories : [];
    return json({ ok: true, categories });
}
