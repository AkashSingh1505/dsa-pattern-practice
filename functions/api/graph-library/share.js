import { json } from "../../_lib/admin-api.js";
import { newGraphId, requirePracticeUser } from "../../_lib/practice-auth-request.js";
import { ensureUserGraphVisibilityColumn } from "../../_lib/user-graph-visibility.js";
import { remapGraphCategoryIdsInPayload, validateMindMapGraphInvariant } from "../../_lib/graph-catalog-category-rows.js";
import {
    ensureUserGraphCategoriesJsonColumn,
    listCategoriesFromUserGraphRow,
    stringifyUserGraphCategories,
} from "../../_lib/user-graph-categories-json.js";

export async function onRequestPost(context) {
    const { request, env } = context;
    const gate = await requirePracticeUser(request, env);
    if (!gate.ok) {
        return gate.response;
    }
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid JSON" }, 400);
    }
    const copyId = String(body.copyId || "").trim();
    const recipientEmail = String(body.recipientEmail || "")
        .trim()
        .toLowerCase();
    if (!copyId || !recipientEmail) {
        return json({ error: "copyId and recipientEmail required" }, 400);
    }
    const { db, userId, email: senderEmail } = gate;
    await ensureUserGraphCategoriesJsonColumn(db);
    const hasVisibility = await ensureUserGraphVisibilityColumn(db);
    if (recipientEmail === String(senderEmail || "").toLowerCase()) {
        return json({ error: "cannot share with yourself" }, 400);
    }
    let src;
    try {
        src = await db
            .prepare(
                `SELECT id, title, description, payload_json, accent_hue, categories_json FROM user_graphs
                 WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL`,
            )
            .bind(copyId, userId)
            .first();
    } catch (e) {
        console.error("share src", e);
        return json({ error: "server error" }, 500);
    }
    if (!src) {
        return json({ error: "not found" }, 404);
    }
    let recipient;
    try {
        recipient = await db.prepare("SELECT id, status FROM practice_users WHERE email = ?").bind(recipientEmail).first();
    } catch (e) {
        console.error("share recipient", e);
        return json({ error: "server error" }, 500);
    }
    if (!recipient || String(recipient.status || "active") !== "active") {
        return json({ error: "recipient not found" }, 404);
    }
    const rid = recipient.id;
    if (rid === userId) {
        return json({ error: "cannot share with yourself" }, 400);
    }
    let payloadStr = src.payload_json;
    let parsedPayloadForShare;
    try {
        parsedPayloadForShare = JSON.parse(payloadStr);
        if (!Array.isArray(parsedPayloadForShare)) {
            return json({ error: "invalid graph" }, 500);
        }
    } catch {
        return json({ error: "invalid graph" }, 500);
    }

    const srcCats = listCategoriesFromUserGraphRow(src);
    const invShare = validateMindMapGraphInvariant(parsedPayloadForShare, srcCats);
    if (!invShare.ok) {
        return json({ error: invShare.error, code: invShare.code || "GRAPH_INVALID" }, 422);
    }

    const idMap = new Map();
    const newCats = srcCats.map((c) => {
        const nid = newGraphId();
        idMap.set(c.id, nid);
        return { id: nid, name: c.name, color: c.color };
    });
    const categoriesJson = stringifyUserGraphCategories(newCats);
    if (idMap.size > 0) {
        remapGraphCategoryIdsInPayload(parsedPayloadForShare, idMap);
        payloadStr = JSON.stringify(parsedPayloadForShare);
    }

    const now = Math.floor(Date.now() / 1000);
    const newId = newGraphId();
    const title = String(src.title || "Shared graph") + " (shared)";
    try {
        await db
            .prepare(
                hasVisibility
                    ? `INSERT INTO user_graphs (id, owner_user_id, source_catalog_id, kind, title, description, payload_json, accent_hue, categories_json, visibility, shared_from_user_id, created_at, updated_at, deleted_at)
                       VALUES (?, ?, NULL, 'shared', ?, ?, ?, ?, ?, 'private', ?, ?, ?, NULL)`
                    : `INSERT INTO user_graphs (id, owner_user_id, source_catalog_id, kind, title, description, payload_json, accent_hue, categories_json, shared_from_user_id, created_at, updated_at, deleted_at)
                       VALUES (?, ?, NULL, 'shared', ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
            )
            .bind(
                newId,
                rid,
                title,
                src.description ? String(src.description) : "",
                payloadStr,
                src.accent_hue != null ? src.accent_hue : null,
                categoriesJson,
                userId,
                now,
                now,
            )
            .run();
    } catch (e) {
        console.error("share insert", e);
        return json({ error: "server error" }, 500);
    }
    return json({
        ok: true,
        sharedCopyId: newId,
        recipientEmail,
    });
}
