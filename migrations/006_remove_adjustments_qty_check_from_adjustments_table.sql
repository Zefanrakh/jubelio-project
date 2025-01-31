-- Up
ALTER TABLE adjustments DROP CONSTRAINT IF EXISTS adjustments_qty_check;

-- Down
ALTER TABLE adjustments ADD CONSTRAINT adjustments_qty_check CHECK (qty >= 1);
