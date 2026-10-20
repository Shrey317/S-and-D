CREATE TABLE commerce."Cart" (
 id UUID PRIMARY KEY, "customerId" UUID UNIQUE, "guestHash" VARCHAR(64) UNIQUE,
 "expiresAt" TIMESTAMPTZ(3) NOT NULL, consumed BOOLEAN NOT NULL DEFAULT false, version INTEGER NOT NULL DEFAULT 0,
 CHECK (("customerId" IS NULL) <> ("guestHash" IS NULL))
);
CREATE TABLE commerce."CartLine" (
 "cartId" UUID NOT NULL REFERENCES commerce."Cart"(id) ON DELETE CASCADE,
 "variantId" UUID NOT NULL REFERENCES commerce."ProductVariant"(id) ON DELETE RESTRICT,
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99), PRIMARY KEY ("cartId", "variantId")
);
CREATE TABLE commerce."Order" (
 id UUID PRIMARY KEY, "customerId" UUID NOT NULL, key UUID NOT NULL,
 fingerprint VARCHAR(64) NOT NULL, method VARCHAR(20) NOT NULL CHECK(method IN ('COLLECTION','DELIVERY')),
 status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','EXPIRED','CANCELLED','DELIVERED','COLLECTED')),
 "paymentStatus" VARCHAR(30) NOT NULL DEFAULT 'UNPAID' CHECK("paymentStatus" IN ('UNPAID','AWAITING_PAYMENT','PAID','FAILED','REFUNDED','PARTIALLY_REFUNDED')),
 total DECIMAL(14,2) NOT NULL CHECK(total>=0), snapshot JSONB NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMPTZ(3) NOT NULL,
 UNIQUE("customerId",key)
);
CREATE INDEX "Order_customerId_createdAt_idx" ON commerce."Order"("customerId","createdAt");
CREATE INDEX order_expiry ON commerce."Order"("expiresAt") WHERE status='PENDING' AND "paymentStatus"='UNPAID';
CREATE TABLE commerce."InventoryReservation" (
 "orderId" UUID NOT NULL REFERENCES commerce."Order"(id) ON DELETE RESTRICT,
 "variantId" UUID NOT NULL REFERENCES commerce."ProductVariant"(id) ON DELETE RESTRICT,
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99), state VARCHAR(20) NOT NULL DEFAULT 'HELD' CHECK(state IN ('HELD','RELEASED','CONSUMED')),
 PRIMARY KEY("orderId","variantId")
);
CREATE TABLE commerce."CheckoutSettings" (
 id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 1, "collectionEnabled" BOOLEAN NOT NULL DEFAULT true,
 "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false, "closedDates" TEXT[] NOT NULL DEFAULT '{}', suspended BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO commerce."CheckoutSettings"(id) VALUES ('store');
CREATE TABLE commerce."DeliveryApproval" (
 "addressId" UUID PRIMARY KEY, "customerId" UUID NOT NULL, "addressHash" VARCHAR(64) NOT NULL,
 "zoneVersion" INTEGER NOT NULL, "expiresAt" TIMESTAMPTZ(3) NOT NULL, reason TEXT NOT NULL
);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sd_commerce_writer') THEN CREATE ROLE sd_commerce_writer NOLOGIN NOBYPASSRLS; END IF;
END $$;
GRANT sd_catalog_reader TO sd_commerce_writer;
GRANT SELECT, INSERT, UPDATE ON commerce."Cart" TO sd_commerce_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON commerce."CartLine" TO sd_commerce_writer;
GRANT SELECT, INSERT ON commerce."Order", commerce."InventoryReservation" TO sd_commerce_writer;
GRANT UPDATE (reserved, version) ON commerce."InventoryBalance" TO sd_commerce_writer;
GRANT SELECT ON commerce."Address", commerce."DeliveryApproval", commerce."CheckoutSettings" TO sd_commerce_writer;
ALTER TABLE commerce."Cart" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."CartLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."InventoryReservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."DeliveryApproval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."CheckoutSettings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY cart_owner ON commerce."Cart" TO sd_commerce_writer
 USING ("customerId"=NULLIF(current_setting('app.customer_id',true),'')::uuid OR "guestHash"=NULLIF(current_setting('app.guest_hash',true),''))
 WITH CHECK ("customerId"=NULLIF(current_setting('app.customer_id',true),'')::uuid OR "guestHash"=NULLIF(current_setting('app.guest_hash',true),''));
CREATE POLICY cart_line_owner ON commerce."CartLine" TO sd_commerce_writer
 USING (EXISTS(SELECT 1 FROM commerce."Cart" c WHERE c.id="cartId")) WITH CHECK (EXISTS(SELECT 1 FROM commerce."Cart" c WHERE c.id="cartId"));
CREATE POLICY order_owner ON commerce."Order" TO sd_commerce_writer
 USING ("customerId"=NULLIF(current_setting('app.customer_id',true),'')::uuid) WITH CHECK ("customerId"=NULLIF(current_setting('app.customer_id',true),'')::uuid);
CREATE POLICY reservation_owner ON commerce."InventoryReservation" TO sd_commerce_writer
 USING (EXISTS(SELECT 1 FROM commerce."Order" o WHERE o.id="orderId")) WITH CHECK (EXISTS(SELECT 1 FROM commerce."Order" o WHERE o.id="orderId"));
CREATE POLICY checkout_address_owner ON commerce."Address" FOR SELECT TO sd_commerce_writer USING ("customerId"=NULLIF(current_setting('app.customer_id',true),'')::uuid);
CREATE POLICY approval_owner ON commerce."DeliveryApproval" FOR SELECT TO sd_commerce_writer USING ("customerId"=NULLIF(current_setting('app.customer_id',true),'')::uuid);
CREATE POLICY checkout_settings_read ON commerce."CheckoutSettings" FOR SELECT TO sd_commerce_writer USING (true);
CREATE POLICY reservation_inventory_update ON commerce."InventoryBalance" FOR UPDATE TO sd_commerce_writer USING (true) WITH CHECK (true);
REVOKE ALL ON commerce."Cart", commerce."CartLine", commerce."Order", commerce."InventoryReservation", commerce."CheckoutSettings", commerce."DeliveryApproval" FROM PUBLIC;

-- Narrow maintenance capability: no arguments, no customer data returned, no arbitrary SQL.
-- Same order -> inventory lock order must be used by future payment/cancellation handlers.
CREATE FUNCTION commerce.expire_reservations() RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,commerce AS $$
DECLARE ord record; held record; released INTEGER:=0; ids uuid[];
BEGIN
 SELECT array_agg(id) INTO ids FROM (SELECT id FROM commerce."Order" WHERE status='PENDING' AND "paymentStatus"='UNPAID' AND "expiresAt"<=CURRENT_TIMESTAMP ORDER BY id LIMIT 200 FOR UPDATE SKIP LOCKED) locked;
 -- Lock the entire batch's balances globally, not separately per order.
 PERFORM b."variantId" FROM commerce."InventoryBalance" b WHERE b."variantId" IN (SELECT r."variantId" FROM commerce."InventoryReservation" r WHERE r."orderId"=ANY(ids) AND r.state='HELD') ORDER BY b."variantId" FOR UPDATE;
 FOR ord IN SELECT id FROM commerce."Order" WHERE id=ANY(ids) ORDER BY id LOOP
  FOR held IN SELECT "variantId", quantity FROM commerce."InventoryReservation" WHERE "orderId"=ord.id AND state='HELD' ORDER BY "variantId" LOOP
   UPDATE commerce."InventoryBalance" SET reserved=reserved-held.quantity, version=version+1 WHERE "variantId"=held."variantId";
  END LOOP;
  UPDATE commerce."InventoryReservation" SET state='RELEASED' WHERE "orderId"=ord.id AND state='HELD';
  UPDATE commerce."Order" SET status='EXPIRED' WHERE id=ord.id;
  released:=released+1;
 END LOOP;
 RETURN released;
END $$;
REVOKE ALL ON FUNCTION commerce.expire_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION commerce.expire_reservations() TO sd_commerce_writer;
