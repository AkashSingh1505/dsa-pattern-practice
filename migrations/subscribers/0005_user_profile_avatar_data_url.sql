-- Inline profile photo (JPEG data URL), optional. User hub uploads; cap size in app (~400KB).
ALTER TABLE user_profiles ADD COLUMN avatar_data_url TEXT;
