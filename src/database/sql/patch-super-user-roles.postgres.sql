-- Patch ERP owner (superuser@pos.com) so they can switch Admin / Cashier / Super User.
-- Safe to run multiple times.

INSERT INTO user_roles (user_id, role_id, added_id, is_default, created_at)
SELECT u.id, 1, 1, false, NOW()
FROM "user" u
WHERE u.email = 'superuser@pos.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = 1
  );

INSERT INTO user_roles (user_id, role_id, added_id, is_default, created_at)
SELECT u.id, 2, 1, false, NOW()
FROM "user" u
WHERE u.email = 'superuser@pos.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = 2
  );

INSERT INTO user_roles (user_id, role_id, added_id, is_default, created_at)
SELECT u.id, 4, 1, true, NOW()
FROM "user" u
WHERE u.email = 'superuser@pos.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = 4
  );

-- If no default role is set, make Super User the default.
UPDATE user_roles ur
SET is_default = false
WHERE ur.user_id = (SELECT id FROM "user" WHERE email = 'superuser@pos.com' LIMIT 1);

UPDATE user_roles ur
SET is_default = true
WHERE ur.user_id = (SELECT id FROM "user" WHERE email = 'superuser@pos.com' LIMIT 1)
  AND ur.role_id = 4;
