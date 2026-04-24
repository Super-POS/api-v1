-- Recipe lines: which quantities scale with customer sugar % or espresso shots (idempotent).
-- Order line: store chosen sugar % and shot count for receipts and auditing.

ALTER TABLE recipe_item
  ADD COLUMN IF NOT EXISTS scale_key VARCHAR(16) NOT NULL DEFAULT 'none';

COMMENT ON COLUMN recipe_item.scale_key IS 'none = full qty_required; sugar = multiply by (sugar_pct/100); shot = multiply by shot count (1=single, 2=double)';

-- Backfill: sugar ingredient scales with user-selected sugar %; coffee beans with shot count.
UPDATE recipe_item ri
SET scale_key = 'sugar'
FROM ingredient i
WHERE ri.ingredient_id = i.id AND i.name = 'Sugar' AND (ri.scale_key IS NULL OR ri.scale_key = 'none');

UPDATE recipe_item ri
SET scale_key = 'shot'
FROM ingredient i
WHERE ri.ingredient_id = i.id AND i.name = 'Coffee Beans' AND (ri.scale_key IS NULL OR ri.scale_key = 'none');

ALTER TABLE order_details
  ADD COLUMN IF NOT EXISTS options JSONB;

COMMENT ON COLUMN order_details.options IS 'JSON: { "sugar_pct": 0-100, "shots": 1|2 } for recipe scaling';
