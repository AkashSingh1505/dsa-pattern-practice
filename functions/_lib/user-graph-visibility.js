function tableInfoRows(result) {
    if (!result) {
        return [];
    }
    if (Array.isArray(result.results)) {
        return result.results;
    }
    if (Array.isArray(result)) {
        return result;
    }
    return [];
}

function hasVisibilityColumn(rows) {
    return rows.some(function (row) {
        return String((row && row.name) || "").toLowerCase() === "visibility";
    });
}

export async function ensureUserGraphVisibilityColumn(db) {
    if (!db) {
        return false;
    }
    let info;
    try {
        info = await db.prepare("PRAGMA table_info(user_graphs)").all();
    } catch (e) {
        return false;
    }
    if (hasVisibilityColumn(tableInfoRows(info))) {
        return true;
    }
    try {
        await db
            .prepare(
                "ALTER TABLE user_graphs ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public'))",
            )
            .run();
        return true;
    } catch (e) {
        const msg = String((e && e.message) || e || "").toLowerCase();
        if (msg.indexOf("duplicate column") >= 0 || msg.indexOf("already exists") >= 0) {
            return true;
        }
        try {
            info = await db.prepare("PRAGMA table_info(user_graphs)").all();
            return hasVisibilityColumn(tableInfoRows(info));
        } catch (err) {
            return false;
        }
    }
}
