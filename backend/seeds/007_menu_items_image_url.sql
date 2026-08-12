-- Optional image path/URL for POS and menu management cards.
-- Applied at server startup via ensureMenuItemsImageSchema().

ALTER TABLE menu_items ADD COLUMN image_url VARCHAR(512) NULL AFTER price;
