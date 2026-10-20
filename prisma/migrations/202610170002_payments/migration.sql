ALTER TABLE commerce."Order" ADD COLUMN "paymentException" VARCHAR(80);
CREATE TABLE commerce."Payment" (
 id UUID PRIMARY KEY, "orderId" UUID UNIQUE NOT NULL REFERENCES commerce."Order"(id) ON DELETE RESTRICT,
 method VARCHAR(30) NOT NULL CHECK(method IN ('PAYFAST_CARD','PAYFAST_EFT','MANUAL_EFT','COD','COLLECTION')),
 state VARCHAR(30) NOT NULL DEFAULT 'UNPAID' CHECK(state IN ('UNPAID','AWAITING_PAYMENT','PAID','FAILED','EXPIRED','REVIEW','REFUNDED','PARTIALLY_REFUNDED')),
 expected DECIMAL(14,2) NOT NULL CHECK(expected>=0), received DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK(received>=0), refunded DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK(refunded>=0 AND refunded<=received),
 exception VARCHAR(80), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE commerce."PaymentReceipt" (
 id UUID PRIMARY KEY, "paymentId" UUID NOT NULL REFERENCES commerce."Payment"(id) ON DELETE RESTRICT,
 reference VARCHAR(160) UNIQUE NOT NULL, amount DECIMAL(14,2) NOT NULL CHECK(amount>0), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE commerce."PaymentEvent" (
 id UUID PRIMARY KEY, "paymentId" UUID NOT NULL REFERENCES commerce."Payment"(id) ON DELETE RESTRICT,
 key VARCHAR(64) UNIQUE NOT NULL, kind VARCHAR(40) NOT NULL, outcome VARCHAR(80) NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PaymentEvent_paymentId_createdAt_idx" ON commerce."PaymentEvent"("paymentId","createdAt");
CREATE TABLE commerce."Refund" (
 id UUID PRIMARY KEY, "paymentId" UUID NOT NULL REFERENCES commerce."Payment"(id) ON DELETE RESTRICT, key UUID UNIQUE NOT NULL,
 amount DECIMAL(14,2) NOT NULL CHECK(amount>0), state VARCHAR(20) NOT NULL DEFAULT 'REQUESTED' CHECK(state IN ('REQUESTED','COMPLETED','CANCELLED')),
 reason VARCHAR(500) NOT NULL, "externalReference" VARCHAR(160) UNIQUE, "requestedBy" UUID NOT NULL, "completedBy" UUID,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMPTZ(3),
 CHECK(state<>'COMPLETED' OR ("externalReference" IS NOT NULL AND "completedBy" IS NOT NULL AND "completedAt" IS NOT NULL))
);
CREATE TABLE commerce."PaymentAudit" (
 id UUID PRIMARY KEY, "actorId" UUID NOT NULL, "paymentId" UUID NOT NULL REFERENCES commerce."Payment"(id) ON DELETE RESTRICT,
 action VARCHAR(40) NOT NULL, detail VARCHAR(500) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PaymentAudit_paymentId_createdAt_idx" ON commerce."PaymentAudit"("paymentId","createdAt");
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sd_payment_processor') THEN CREATE ROLE sd_payment_processor NOLOGIN NOBYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA commerce TO sd_payment_processor;
GRANT SELECT ON commerce."Order",commerce."InventoryReservation",commerce."InventoryBalance",commerce."AdministratorGrant" TO sd_payment_processor;
GRANT UPDATE ("paymentStatus","paymentException",status) ON commerce."Order" TO sd_payment_processor;
GRANT UPDATE (reserved,version) ON commerce."InventoryBalance" TO sd_payment_processor;
GRANT UPDATE (state) ON commerce."InventoryReservation" TO sd_payment_processor;
GRANT SELECT,UPDATE ON commerce."Payment",commerce."Refund" TO sd_payment_processor;
GRANT INSERT ON commerce."Refund",commerce."PaymentReceipt",commerce."PaymentEvent",commerce."PaymentAudit" TO sd_payment_processor;
GRANT SELECT ON commerce."PaymentReceipt",commerce."PaymentEvent",commerce."PaymentAudit" TO sd_payment_processor;
GRANT SELECT,INSERT ON commerce."Payment" TO sd_commerce_writer;
GRANT SELECT ON commerce."Refund" TO sd_commerce_writer;
ALTER TABLE commerce."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."PaymentReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."PaymentEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."Refund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce."PaymentAudit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_customer ON commerce."Payment" TO sd_commerce_writer
 USING (EXISTS(SELECT 1 FROM commerce."Order" o WHERE o.id="orderId"))
 WITH CHECK (state IN ('UNPAID','AWAITING_PAYMENT') AND received=0 AND refunded=0 AND exception IS NULL AND EXISTS(SELECT 1 FROM commerce."Order" o WHERE o.id="orderId" AND o.total=expected));
CREATE POLICY refund_customer ON commerce."Refund" FOR SELECT TO sd_commerce_writer USING(EXISTS(SELECT 1 FROM commerce."Payment" p WHERE p.id="paymentId"));
CREATE POLICY payment_service ON commerce."Payment" TO sd_payment_processor USING(true) WITH CHECK(true);
CREATE POLICY receipt_service ON commerce."PaymentReceipt" TO sd_payment_processor USING(true) WITH CHECK(true);
CREATE POLICY event_service ON commerce."PaymentEvent" TO sd_payment_processor USING(true) WITH CHECK(true);
CREATE POLICY refund_service ON commerce."Refund" TO sd_payment_processor USING(true) WITH CHECK(true);
CREATE POLICY audit_service ON commerce."PaymentAudit" TO sd_payment_processor USING(true) WITH CHECK(true);
CREATE POLICY order_payment_service ON commerce."Order" TO sd_payment_processor USING(true) WITH CHECK(true);
CREATE POLICY reservation_payment_service ON commerce."InventoryReservation" TO sd_payment_processor USING(true) WITH CHECK(true);
CREATE POLICY inventory_payment_service ON commerce."InventoryBalance" TO sd_payment_processor USING(true) WITH CHECK(true);
CREATE POLICY admin_payment_service ON commerce."AdministratorGrant" FOR SELECT TO sd_payment_processor USING(true);
REVOKE ALL ON commerce."Payment",commerce."PaymentReceipt",commerce."PaymentEvent",commerce."Refund",commerce."PaymentAudit" FROM PUBLIC;

-- Old TEST orders retain their 20-minute expiry. COD/collection retain allocation until explicit cancellation/fulfilment.
CREATE OR REPLACE FUNCTION commerce.expire_reservations() RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,commerce AS $$
DECLARE ord record; held record; ids uuid[]; released INTEGER:=0;
BEGIN
 SELECT array_agg(id) INTO ids FROM (
  SELECT o.id FROM commerce."Order" o WHERE o.status='PENDING' AND o."paymentStatus" IN ('UNPAID','AWAITING_PAYMENT') AND o."expiresAt"<=CURRENT_TIMESTAMP
  AND NOT EXISTS(SELECT 1 FROM commerce."Payment" p WHERE p."orderId"=o.id AND (p.method IN ('COD','COLLECTION') OR p.received>0))
  ORDER BY o.id LIMIT 200 FOR UPDATE OF o SKIP LOCKED
 ) locked;
 PERFORM p.id FROM commerce."Payment" p WHERE p."orderId"=ANY(ids) ORDER BY p."orderId" FOR UPDATE;
 PERFORM b."variantId" FROM commerce."InventoryBalance" b WHERE b."variantId" IN (SELECT r."variantId" FROM commerce."InventoryReservation" r WHERE r."orderId"=ANY(ids) AND r.state='HELD') ORDER BY b."variantId" FOR UPDATE;
 FOR ord IN SELECT id FROM commerce."Order" WHERE id=ANY(ids) ORDER BY id LOOP
  FOR held IN SELECT "variantId",quantity FROM commerce."InventoryReservation" WHERE "orderId"=ord.id AND state='HELD' ORDER BY "variantId" LOOP
   UPDATE commerce."InventoryBalance" SET reserved=reserved-held.quantity,version=version+1 WHERE "variantId"=held."variantId";
  END LOOP;
  UPDATE commerce."InventoryReservation" SET state='RELEASED' WHERE "orderId"=ord.id AND state='HELD';
  UPDATE commerce."Order" SET status='EXPIRED' WHERE id=ord.id;
  UPDATE commerce."Payment" SET state='EXPIRED',"updatedAt"=CURRENT_TIMESTAMP WHERE "orderId"=ord.id;
  released:=released+1;
 END LOOP;
 RETURN released;
END $$;
