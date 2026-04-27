-- Run once on existing DBs (sync already adds the column for fresh installs)
ALTER TABLE modifier_options
  ADD COLUMN IF NOT EXISTS ingredient_recipe JSONB NOT NULL DEFAULT '[]';
