-- Extra profile fields for member hub (General + Experience).
-- Run after 0001_subscribers_expandable.sql

ALTER TABLE user_profiles ADD COLUMN gender TEXT;
ALTER TABLE user_profiles ADD COLUMN location TEXT;
ALTER TABLE user_profiles ADD COLUMN birthday TEXT;
-- JSON: { "work": "...", "education": "...", "skills": "..." } (plain text or markdown per section)
ALTER TABLE user_profiles ADD COLUMN experience_json TEXT;
