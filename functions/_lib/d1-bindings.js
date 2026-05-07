/**
 * D1 bindings: Pages may use short names (`DB`, `DB_SUBSCRIBERS`) or names that match the database.
 * Hyphenated binding names are read with bracket notation on `env`.
 */

const CONTENT_BINDING = "dsa-pattern-practice-content";
const SUBSCRIBERS_BINDING = "dsa-pattern-practice-subscribers";

export function contentDb(env) {
    return env.DB ?? env[CONTENT_BINDING];
}

export function subscribersDb(env) {
    return env.DB_SUBSCRIBERS ?? env[SUBSCRIBERS_BINDING];
}
