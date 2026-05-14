import { json } from "../../_lib/admin-api.js";
import { requirePracticeUser } from "../../_lib/practice-auth-request.js";
import { listGraphTypes } from "../../_lib/graph-type.js";

/** Member-authenticated list for create forms and client-side branching. */
export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requirePracticeUser(request, env);
    if (!gate.ok) {
        return gate.response;
    }
    const { subscribersDb } = await import("../../_lib/d1-bindings.js");
    const db = subscribersDb(context.env);
    if (!db) {
        return json({ error: "Subscribers D1 not bound" }, 503);
    }
    let types;
    try {
        types = await listGraphTypes(db);
    } catch (e) {
        console.error("graph-library graph-types", e);
        return json({ error: "server error" }, 500);
    }
    return json({ ok: true, types });
}
