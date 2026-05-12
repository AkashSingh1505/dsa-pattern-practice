-- Per-user graph visibility for member library cards and publish/private toggles.
ALTER TABLE user_graphs ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public'));
