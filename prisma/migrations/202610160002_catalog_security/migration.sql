-- Catalog constraints and least-privilege access. No credentials in migrations.
ALTER TABLE commerce."ProductVariant" ADD CONSTRAINT variant_price_nonnegative CHECK (price >= 0), ADD CONSTRAINT low_stock_nonnegative CHECK ("lowStockThreshold" >= 0);
ALTER TABLE commerce."InventoryBalance" ADD CONSTRAINT inventory_valid CHECK ("onHand" >= 0 AND reserved >= 0 AND reserved <= "onHand" AND version >= 0);
ALTER TABLE commerce."ProductImage" ADD CONSTRAINT image_valid CHECK (width > 0 AND height > 0 AND version > 0 AND position >= 0 AND format IN ('jpg','png','webp') AND "publicId" ~ '^sd-catalog/[A-Za-z0-9/_-]+$' AND length(trim(alt)) > 0 AND length(trim(provenance)) > 0);
ALTER TABLE commerce."Category" ADD CONSTRAINT category_slug_valid CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE commerce."Product" ADD CONSTRAINT product_slug_valid CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sd_catalog_reader') THEN
    CREATE ROLE sd_catalog_reader NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
REVOKE ALL ON SCHEMA commerce FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA commerce FROM PUBLIC;
GRANT USAGE ON SCHEMA commerce TO sd_catalog_reader;
GRANT SELECT ON commerce."Category", commerce."Product", commerce."ProductVariant", commerce."ProductImage", commerce."InventoryBalance" TO sd_catalog_reader;
ALTER TABLE commerce."Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."ProductVariant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."ProductImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."InventoryBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."DevelopmentMarker" ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_categories ON commerce."Category" FOR SELECT TO sd_catalog_reader USING (active);
CREATE POLICY catalog_products ON commerce."Product" FOR SELECT TO sd_catalog_reader USING (state='ACTIVE' AND EXISTS (SELECT 1 FROM commerce."Category" c WHERE c.id="categoryId" AND c.active));
CREATE POLICY catalog_variants ON commerce."ProductVariant" FOR SELECT TO sd_catalog_reader USING (active AND EXISTS (SELECT 1 FROM commerce."Product" p WHERE p.id="productId"));
CREATE POLICY catalog_images ON commerce."ProductImage" FOR SELECT TO sd_catalog_reader USING (EXISTS (SELECT 1 FROM commerce."Product" p WHERE p.id="productId"));
CREATE POLICY catalog_inventory ON commerce."InventoryBalance" FOR SELECT TO sd_catalog_reader USING (EXISTS (SELECT 1 FROM commerce."ProductVariant" v WHERE v.id="variantId"));
-- Supabase API roles receive no access to this private schema, even if accidentally exposed.
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA commerce FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA commerce FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
