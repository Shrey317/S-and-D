CREATE TABLE commerce."CustomerProfile" (
  id UUID PRIMARY KEY, name VARCHAR(100) NOT NULL DEFAULT '', phone VARCHAR(20) NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE commerce."Address" (
  id UUID PRIMARY KEY, "customerId" UUID NOT NULL REFERENCES commerce."CustomerProfile"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  label VARCHAR(40) NOT NULL, recipient VARCHAR(100) NOT NULL, phone VARCHAR(20) NOT NULL,
  street VARCHAR(200) NOT NULL, suburb VARCHAR(100) NOT NULL, city VARCHAR(100) NOT NULL,
  "postalCode" VARCHAR(4) NOT NULL, instructions VARCHAR(500) NOT NULL DEFAULT '', "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT address_nonempty CHECK (length(trim(label))>0 AND length(trim(recipient))>0 AND length(trim(street))>0 AND length(trim(suburb))>0 AND length(trim(city))>0 AND "postalCode" ~ '^[0-9]{4}$')
);
CREATE INDEX "Address_customerId_idx" ON commerce."Address"("customerId");
CREATE UNIQUE INDEX address_one_default ON commerce."Address"("customerId") WHERE "isDefault";
CREATE TABLE commerce."WishlistItem" (
  "customerId" UUID NOT NULL REFERENCES commerce."CustomerProfile"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "productId" UUID NOT NULL REFERENCES commerce."Product"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("customerId", "productId")
);
CREATE TABLE commerce."AdministratorGrant" (
  "customerId" UUID PRIMARY KEY, "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, reason VARCHAR(500) NOT NULL
);
CREATE TABLE commerce."AuthRateLimit" (key VARCHAR(64) PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 1 CHECK(hits>0), "expiresAt" TIMESTAMPTZ(3) NOT NULL);
CREATE INDEX "AuthRateLimit_expiresAt_idx" ON commerce."AuthRateLimit"("expiresAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sd_account_writer') THEN
    CREATE ROLE sd_account_writer NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT sd_catalog_reader TO sd_account_writer;
GRANT SELECT, INSERT, UPDATE ON commerce."CustomerProfile" TO sd_account_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON commerce."Address" TO sd_account_writer;
GRANT SELECT, INSERT, DELETE ON commerce."WishlistItem" TO sd_account_writer;
GRANT SELECT ON commerce."AdministratorGrant" TO sd_account_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON commerce."AuthRateLimit" TO sd_account_writer;
ALTER TABLE commerce."CustomerProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."Address" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."WishlistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."AdministratorGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."AuthRateLimit" ENABLE ROW LEVEL SECURITY;
-- SET LOCAL in a server-authorized transaction is required. It never persists into pooled requests.
CREATE POLICY profile_owner ON commerce."CustomerProfile" TO sd_account_writer
  USING (id = NULLIF(current_setting('app.customer_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.customer_id', true), '')::uuid);
CREATE POLICY address_owner ON commerce."Address" TO sd_account_writer
  USING ("customerId" = NULLIF(current_setting('app.customer_id', true), '')::uuid)
  WITH CHECK ("customerId" = NULLIF(current_setting('app.customer_id', true), '')::uuid);
CREATE POLICY wishlist_owner ON commerce."WishlistItem" TO sd_account_writer
  USING ("customerId" = NULLIF(current_setting('app.customer_id', true), '')::uuid)
  WITH CHECK ("customerId" = NULLIF(current_setting('app.customer_id', true), '')::uuid);
CREATE POLICY administrator_self_read ON commerce."AdministratorGrant" FOR SELECT TO sd_account_writer
  USING ("customerId" = NULLIF(current_setting('app.customer_id', true), '')::uuid);
CREATE POLICY rate_limits_server_only ON commerce."AuthRateLimit" TO sd_account_writer USING (true) WITH CHECK (true);
REVOKE ALL ON commerce."CustomerProfile", commerce."Address", commerce."WishlistItem", commerce."AdministratorGrant", commerce."AuthRateLimit" FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA commerce FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
