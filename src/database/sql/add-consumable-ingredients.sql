-- Add Sugar, Plastic Cup, Paper Bag, Straw and recipe links (idempotent for existing DBs).

INSERT INTO ingredient (name, unit, stock, low_stock_threshold, created_at, updated_at)
SELECT v.name, v.unit, v.stock, v.low, NOW(), NOW()
FROM (VALUES
  ('Sugar', 'g', 20000::float8, 2500::float8),
  ('Plastic Cup', 'piece', 2000::float8, 200::float8),
  ('Paper Bag', 'piece', 500::float8, 60::float8),
  ('Straw', 'piece', 3000::float8, 300::float8)
) AS v(name, unit, stock, low)
WHERE NOT EXISTS (SELECT 1 FROM ingredient i WHERE i.name = v.name);

-- Drinks: products 1–15 → sugar 5g, plastic cup 1, straw 1 (per item sold)
INSERT INTO recipe_item (product_id, ingredient_id, qty_required, created_at, updated_at)
SELECT g.p, s.id, 5, NOW(), NOW()
FROM generate_series(1, 15) AS g(p)
CROSS JOIN (SELECT id FROM ingredient WHERE name = 'Sugar' LIMIT 1) s
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_item r WHERE r.product_id = g.p AND r.ingredient_id = s.id
);

INSERT INTO recipe_item (product_id, ingredient_id, qty_required, created_at, updated_at)
SELECT g.p, c.id, 1, NOW(), NOW()
FROM generate_series(1, 15) AS g(p)
CROSS JOIN (SELECT id FROM ingredient WHERE name = 'Plastic Cup' LIMIT 1) c
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_item r WHERE r.product_id = g.p AND r.ingredient_id = c.id
);

INSERT INTO recipe_item (product_id, ingredient_id, qty_required, created_at, updated_at)
SELECT g.p, t.id, 1, NOW(), NOW()
FROM generate_series(1, 15) AS g(p)
CROSS JOIN (SELECT id FROM ingredient WHERE name = 'Straw' LIMIT 1) t
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_item r WHERE r.product_id = g.p AND r.ingredient_id = t.id
);

-- Bakery products 16–18 → paper bag
INSERT INTO recipe_item (product_id, ingredient_id, qty_required, created_at, updated_at)
SELECT p, b.id, 1, NOW(), NOW()
FROM (VALUES (16), (17), (18)) AS x(p)
CROSS JOIN (SELECT id FROM ingredient WHERE name = 'Paper Bag' LIMIT 1) b
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_item r WHERE r.product_id = p AND r.ingredient_id = b.id
);
