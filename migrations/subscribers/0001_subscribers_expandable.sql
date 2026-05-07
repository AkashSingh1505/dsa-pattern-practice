-- =============================================================================
-- D1: dsa-pattern-practice-subscribers (accounts, profiles, billing hooks)
-- Run once: wrangler d1 execute … --file=…
-- =============================================================================

-- Core auth (email/password). role: user | admin (app-level). plan: free | pro | …
CREATE TABLE IF NOT EXISTS practice_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team', 'lifetime')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    email_verified_at INTEGER,
    last_login_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_practice_users_status ON practice_users (status);
CREATE INDEX IF NOT EXISTS idx_practice_users_plan ON practice_users (plan);

-- Profile & preferences (1:1, lazy-created on first update)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY NOT NULL REFERENCES practice_users (id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    locale TEXT,
    timezone TEXT,
    prefs_json TEXT,
    bio TEXT,
    social_json TEXT,
    updated_at INTEGER NOT NULL
);

-- Feature entitlements beyond coarse plan (A/B, grants, time-boxed perks)
CREATE TABLE IF NOT EXISTS user_entitlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES practice_users (id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    value_json TEXT,
    source TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('plan', 'promo', 'admin', 'payment', 'system')),
    valid_from INTEGER,
    valid_until INTEGER,
    created_at INTEGER NOT NULL,
    meta TEXT,
    UNIQUE (user_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_entitlements_user ON user_entitlements (user_id);

-- Payment provider shadow table (Stripe customer id, etc.) — wire when you integrate
CREATE TABLE IF NOT EXISTS billing_customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES practice_users (id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'none' CHECK (provider IN ('none', 'stripe', 'paddle', 'lemonsqueezy')),
    external_customer_id TEXT,
    default_payment_method TEXT,
    updated_at INTEGER NOT NULL,
    metadata TEXT,
    UNIQUE (user_id, provider)
);

-- Subscription rows (one active row per user per provider product if needed)
CREATE TABLE IF NOT EXISTS billing_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES practice_users (id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    external_subscription_id TEXT,
    status TEXT NOT NULL DEFAULT 'inactive' CHECK (
        status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'paused')
    ),
    current_period_end INTEGER,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_billing_sub_user ON billing_subscriptions (user_id, status);

-- Marketing / newsletter opt-in (separate from auth if you want double consent)
CREATE TABLE IF NOT EXISTS subscriber_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    user_id INTEGER REFERENCES practice_users (id) ON DELETE SET NULL,
    source TEXT,
    consent_marketing INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    meta TEXT
);

-- Security / support audit (sign-in, password change, admin actions)
CREATE TABLE IF NOT EXISTS security_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES practice_users (id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    payload_json TEXT,
    ip_hash TEXT,
    user_agent_hash TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_audit_user ON security_audit (user_id, created_at DESC);
