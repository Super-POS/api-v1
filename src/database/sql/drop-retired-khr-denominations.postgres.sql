-- Run once on existing DBs to remove retired KHR denominations (200 R, 200,000 R).
ALTER TABLE cash_drawer DROP COLUMN IF EXISTS khr_200;
ALTER TABLE cash_drawer DROP COLUMN IF EXISTS khr_200000;
ALTER TABLE cash_drawer_log DROP COLUMN IF EXISTS khr_200;
ALTER TABLE cash_drawer_log DROP COLUMN IF EXISTS khr_200000;
