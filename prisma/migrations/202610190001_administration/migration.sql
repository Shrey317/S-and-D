ALTER TYPE commerce."SellingUnit" ADD VALUE 'KG';
ALTER TYPE commerce."SellingUnit" ADD VALUE 'BOX';
ALTER TABLE commerce."CheckoutSettings" ADD COLUMN cutoff VARCHAR(5) NOT NULL DEFAULT '19:00', ADD COLUMN "sameDayEnabled" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "sameDayCutoff" VARCHAR(5) NOT NULL DEFAULT '16:00', ADD COLUMN "dailyCapacity" INTEGER NOT NULL DEFAULT 0 CHECK("dailyCapacity" BETWEEN 0 AND 10000);
CREATE TABLE commerce."StoreSettings" (
 id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 1, phone VARCHAR(20) NOT NULL DEFAULT '+27835043385', address VARCHAR(240) NOT NULL DEFAULT '155 Gemsbok Street, Lenasia, 1827, Johannesburg, South Africa',
 "weekdayOpen" VARCHAR(5) NOT NULL DEFAULT '08:45', "weekdayClose" VARCHAR(5) NOT NULL DEFAULT '18:00', "sundayOpen" VARCHAR(5) NOT NULL DEFAULT '09:00', "sundayClose" VARCHAR(5) NOT NULL DEFAULT '16:00',
 announcement VARCHAR(240) NOT NULL DEFAULT 'Free delivery in eligible Lenasia areas', about VARCHAR(3000) NOT NULL DEFAULT 'Fresh produce for your everyday shop. Visit S & D Fruit and Veg in Lenasia.'
);
INSERT INTO commerce."StoreSettings"(id) VALUES('store');
CREATE TABLE commerce."AdminAudit" (id UUID PRIMARY KEY,"actorId" UUID NOT NULL,action VARCHAR(60) NOT NULL,"entityId" VARCHAR(120) NOT NULL,detail VARCHAR(1000) NOT NULL,"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "AdminAudit_createdAt_idx" ON commerce."AdminAudit"("createdAt");
CREATE TABLE commerce."InventoryAdjustment" (id UUID PRIMARY KEY,key UUID UNIQUE NOT NULL,"variantId" UUID NOT NULL REFERENCES commerce."ProductVariant"(id) ON DELETE RESTRICT,"actorId" UUID NOT NULL,before INTEGER NOT NULL CHECK(before>=0),after INTEGER NOT NULL CHECK(after>=0),reason VARCHAR(500) NOT NULL,"orderId" UUID REFERENCES commerce."Order"(id) ON DELETE RESTRICT,"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "InventoryAdjustment_variantId_createdAt_idx" ON commerce."InventoryAdjustment"("variantId","createdAt");
CREATE TABLE commerce."OrderNote" (id UUID PRIMARY KEY,"orderId" UUID NOT NULL REFERENCES commerce."Order"(id) ON DELETE RESTRICT,"actorId" UUID NOT NULL,text VARCHAR(1000) NOT NULL,"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "OrderNote_orderId_createdAt_idx" ON commerce."OrderNote"("orderId","createdAt");
CREATE TABLE commerce."Promotion" (
 id UUID PRIMARY KEY,version INTEGER NOT NULL DEFAULT 1,name VARCHAR(100) NOT NULL,code VARCHAR(40) UNIQUE,kind VARCHAR(20) NOT NULL CHECK(kind IN ('PERCENT','FIXED','BUNDLE')),value DECIMAL(14,2) NOT NULL CHECK(value>0 AND (kind<>'PERCENT' OR value<=100)),"productId" UUID REFERENCES commerce."Product"(id) ON DELETE RESTRICT,bundle JSONB NOT NULL,
 "startsAt" TIMESTAMPTZ(3) NOT NULL,"endsAt" TIMESTAMPTZ(3) NOT NULL,active BOOLEAN NOT NULL DEFAULT false,"maxUses" INTEGER NOT NULL DEFAULT 100 CHECK("maxUses">0),"perCustomer" INTEGER NOT NULL DEFAULT 1 CHECK("perCustomer">0),CHECK("endsAt">"startsAt")
);
CREATE TABLE commerce."PromotionRedemption" (id UUID PRIMARY KEY,"promotionId" UUID NOT NULL REFERENCES commerce."Promotion"(id) ON DELETE RESTRICT,"orderId" UUID UNIQUE NOT NULL REFERENCES commerce."Order"(id) ON DELETE RESTRICT,"customerId" UUID NOT NULL,discount DECIMAL(14,2) NOT NULL CHECK(discount>0),"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "PromotionRedemption_promotionId_customerId_idx" ON commerce."PromotionRedemption"("promotionId","customerId");
DO $$ DECLARE t TEXT; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sd_admin_writer') THEN CREATE ROLE sd_admin_writer NOLOGIN NOBYPASSRLS; END IF;
 FOR t IN SELECT unnest(ARRAY['StoreSettings','AdminAudit','InventoryAdjustment','OrderNote','Promotion','PromotionRedemption']) LOOP
  EXECUTE format('ALTER TABLE commerce.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON commerce.%I FROM PUBLIC',t);
 END LOOP;
 FOR t IN SELECT unnest(ARRAY['Category','Product','ProductVariant','InventoryBalance','ProductImage','Order','InventoryReservation','Payment','PaymentReceipt','Refund','PaymentEvent','PaymentAudit','AdministratorGrant','CustomerProfile','Address','CheckoutSettings','DeliveryApproval','StoreSettings','AdminAudit','InventoryAdjustment','OrderNote','Promotion','PromotionRedemption']) LOOP
  EXECUTE format('GRANT SELECT ON commerce.%I TO sd_admin_writer',t);
  EXECUTE format('CREATE POLICY admin_service ON commerce.%I TO sd_admin_writer USING(true) WITH CHECK(true)',t);
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA commerce TO sd_admin_writer;
GRANT INSERT,UPDATE ON commerce."Category",commerce."Product",commerce."ProductVariant",commerce."InventoryBalance",commerce."ProductImage",commerce."Promotion",commerce."DeliveryApproval" TO sd_admin_writer;
GRANT DELETE ON commerce."ProductImage",commerce."DeliveryApproval" TO sd_admin_writer;
GRANT UPDATE ON commerce."CheckoutSettings",commerce."StoreSettings" TO sd_admin_writer;
GRANT UPDATE (status) ON commerce."Order" TO sd_admin_writer;
GRANT UPDATE (state) ON commerce."InventoryReservation" TO sd_admin_writer;
GRANT INSERT ON commerce."AdminAudit",commerce."InventoryAdjustment",commerce."OrderNote" TO sd_admin_writer;
GRANT SELECT ON commerce."StoreSettings" TO sd_catalog_reader,sd_commerce_writer;
CREATE POLICY store_public ON commerce."StoreSettings" FOR SELECT TO sd_catalog_reader,sd_commerce_writer USING(true);
GRANT SELECT ON commerce."Promotion" TO sd_commerce_writer;
CREATE POLICY promotion_checkout ON commerce."Promotion" FOR SELECT TO sd_commerce_writer USING(active);
-- Narrow lock helpers avoid granting checkout permission to edit configuration or offers.
CREATE FUNCTION commerce.lock_checkout_settings() RETURNS VOID LANGUAGE SQL SECURITY DEFINER SET search_path=pg_catalog,commerce AS $$ SELECT id FROM commerce."CheckoutSettings" WHERE id='store' FOR UPDATE $$;
CREATE FUNCTION commerce.lock_promotion(promo UUID) RETURNS VOID LANGUAGE SQL SECURITY DEFINER SET search_path=pg_catalog,commerce AS $$ SELECT id FROM commerce."Promotion" WHERE id=promo AND active FOR UPDATE $$;
REVOKE ALL ON FUNCTION commerce.lock_checkout_settings(),commerce.lock_promotion(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION commerce.lock_checkout_settings(),commerce.lock_promotion(UUID) TO sd_commerce_writer;
GRANT SELECT,INSERT ON commerce."PromotionRedemption" TO sd_commerce_writer;
CREATE POLICY redemption_customer ON commerce."PromotionRedemption" TO sd_commerce_writer USING("customerId"=NULLIF(current_setting('app.customer_id',true),'')::uuid) WITH CHECK("customerId"=NULLIF(current_setting('app.customer_id',true),'')::uuid AND EXISTS(SELECT 1 FROM commerce."Order" o WHERE o.id="orderId"));
CREATE FUNCTION commerce.promotion_uses(promo UUID) RETURNS TABLE(total BIGINT,customer BIGINT) LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=pg_catalog,commerce AS $$
 SELECT count(*),count(*) FILTER(WHERE r."customerId"=NULLIF(current_setting('app.customer_id',true),'')::uuid) FROM commerce."PromotionRedemption" r JOIN commerce."Order" o ON o.id=r."orderId" WHERE r."promotionId"=promo AND o.status NOT IN ('EXPIRED','CANCELLED')
$$;
CREATE FUNCTION commerce.planning_load(day TEXT) RETURNS BIGINT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=pg_catalog,commerce AS $$ SELECT count(*) FROM commerce."Order" WHERE status NOT IN ('EXPIRED','CANCELLED') AND snapshot->>'planningDate'=day $$;
REVOKE ALL ON FUNCTION commerce.promotion_uses(UUID),commerce.planning_load(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION commerce.promotion_uses(UUID),commerce.planning_load(TEXT) TO sd_commerce_writer;
