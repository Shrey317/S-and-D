CREATE TABLE commerce."EmailMessage" (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"eventKey" VARCHAR(200) UNIQUE NOT NULL,"orderId" UUID NOT NULL,kind VARCHAR(40) NOT NULL,audience VARCHAR(20) NOT NULL CHECK(audience IN ('CUSTOMER','ADMIN')),payload JSONB NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','ACCEPTED','CAPTURED','FAILED','REVIEW')),attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),"availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"leaseUntil" TIMESTAMPTZ(3),"leaseToken" UUID,"firstAttemptAt" TIMESTAMPTZ(3),request JSONB,mode VARCHAR(20),"providerId" VARCHAR(100) UNIQUE,"lastError" VARCHAR(120),"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EmailMessage_status_availableAt_idx" ON commerce."EmailMessage"(status,"availableAt");
CREATE INDEX "EmailMessage_orderId_idx" ON commerce."EmailMessage"("orderId");
CREATE TABLE commerce."EmailAttempt" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"messageId" UUID NOT NULL REFERENCES commerce."EmailMessage"(id) ON DELETE RESTRICT,number INTEGER NOT NULL,status VARCHAR(20) NOT NULL,detail VARCHAR(120) NOT NULL,"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE("messageId",number));
CREATE TABLE commerce."EmailDelivery" (id VARCHAR(200) PRIMARY KEY,"providerId" VARCHAR(100) NOT NULL,type VARCHAR(40) NOT NULL,"occurredAt" TIMESTAMPTZ(3) NOT NULL,"receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "EmailDelivery_providerId_idx" ON commerce."EmailDelivery"("providerId");
CREATE TABLE commerce."AdminNotification" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"eventKey" VARCHAR(200) NOT NULL UNIQUE,"orderId" UUID NOT NULL,kind VARCHAR(40) NOT NULL,"readAt" TIMESTAMPTZ(3),"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "AdminNotification_createdAt_idx" ON commerce."AdminNotification"("createdAt");
CREATE TABLE commerce."ManualCommunication" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),key UUID NOT NULL UNIQUE,"orderId" UUID NOT NULL,"actorId" UUID NOT NULL,phone VARCHAR(20) NOT NULL,text VARCHAR(4000) NOT NULL,state VARCHAR(20) NOT NULL DEFAULT 'PREPARED' CHECK(state IN ('PREPARED','OPENED','MARKED_SENT')),"openedAt" TIMESTAMPTZ(3),"markedAt" TIMESTAMPTZ(3),"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "ManualCommunication_orderId_idx" ON commerce."ManualCommunication"("orderId");
-- History retains order UUIDs without cascading deletion. Runtime cannot delete orders or history.
DO $$ DECLARE t TEXT; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sd_communications_worker') THEN CREATE ROLE sd_communications_worker NOLOGIN NOBYPASSRLS; END IF;
 FOR t IN SELECT unnest(ARRAY['EmailMessage','EmailAttempt','EmailDelivery','AdminNotification','ManualCommunication']) LOOP
  EXECUTE format('ALTER TABLE commerce.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON commerce.%I FROM PUBLIC',t);
  EXECUTE format('GRANT SELECT ON commerce.%I TO sd_admin_writer',t);
  EXECUTE format('CREATE POLICY admin_communications ON commerce.%I TO sd_admin_writer USING(true) WITH CHECK(true)',t);
 END LOOP;
 FOR t IN SELECT unnest(ARRAY['EmailMessage','EmailAttempt','EmailDelivery','AdminNotification']) LOOP
  EXECUTE format('GRANT SELECT ON commerce.%I TO sd_communications_worker',t);
  EXECUTE format('CREATE POLICY worker_communications ON commerce.%I TO sd_communications_worker USING(true) WITH CHECK(true)',t);
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA commerce TO sd_communications_worker;
GRANT UPDATE(status,attempts,"availableAt","leaseUntil","leaseToken","firstAttemptAt",request,mode,"providerId","lastError") ON commerce."EmailMessage" TO sd_communications_worker;
GRANT INSERT,UPDATE ON commerce."EmailAttempt" TO sd_communications_worker;
GRANT INSERT ON commerce."EmailDelivery",commerce."AdminNotification" TO sd_communications_worker;
GRANT INSERT ON commerce."EmailMessage",commerce."ManualCommunication" TO sd_admin_writer;
GRANT UPDATE(state,"openedAt","markedAt") ON commerce."ManualCommunication" TO sd_admin_writer;
GRANT UPDATE("readAt") ON commerce."AdminNotification" TO sd_admin_writer;
CREATE FUNCTION commerce.queue_order_notice(o commerce."Order", event_kind TEXT, discriminator TEXT, admin_mail BOOLEAN) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,commerce AS $$
DECLARE event_key TEXT := o.id::text || ':' || event_kind || ':' || discriminator; body JSONB;
BEGIN
 body := jsonb_build_object('orderId',o.id,'snapshot',o.snapshot,'status',o.status,'paymentStatus',o."paymentStatus",'total',o.total::text,'method',o.method);
 INSERT INTO commerce."EmailMessage"("eventKey","orderId",kind,audience,payload) VALUES(event_key || ':customer',o.id,event_kind,'CUSTOMER',body) ON CONFLICT("eventKey") DO NOTHING;
 IF admin_mail THEN
  INSERT INTO commerce."EmailMessage"("eventKey","orderId",kind,audience,payload) VALUES(event_key || ':admin',o.id,event_kind,'ADMIN',body) ON CONFLICT("eventKey") DO NOTHING;
 END IF;
 INSERT INTO commerce."AdminNotification"("eventKey","orderId",kind) VALUES(event_key,o.id,event_kind) ON CONFLICT("eventKey") DO NOTHING;
END $$;
CREATE FUNCTION commerce.order_communications_trigger() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,commerce AS $$
BEGIN
 IF TG_OP='INSERT' THEN PERFORM commerce.queue_order_notice(NEW,'ORDER_RECEIVED','created',true); RETURN NEW; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  IF NEW.status IN ('COLLECTED','DELIVERED') THEN PERFORM commerce.queue_order_notice(NEW,'FULFILMENT_COMPLETED',NEW.status,false);
  ELSIF NEW.status IN ('CANCELLED','EXPIRED') THEN PERFORM commerce.queue_order_notice(NEW,'ORDER_CANCELLED',NEW.status,false); END IF;
 END IF;
 IF NEW."paymentStatus"='PAID' AND OLD."paymentStatus" IS DISTINCT FROM 'PAID' THEN PERFORM commerce.queue_order_notice(NEW,'PAYMENT_CONFIRMED','paid',false); END IF;
 IF NEW."paymentException" IS NOT NULL AND NEW."paymentException" IS DISTINCT FROM OLD."paymentException" THEN
  INSERT INTO commerce."AdminNotification"("eventKey","orderId",kind) VALUES(NEW.id::text || ':exception:' || NEW."paymentException",NEW.id,'PAYMENT_EXCEPTION') ON CONFLICT("eventKey") DO NOTHING;
  INSERT INTO commerce."EmailMessage"("eventKey","orderId",kind,audience,payload) VALUES(NEW.id::text || ':exception:' || NEW."paymentException",NEW.id,'PAYMENT_EXCEPTION','ADMIN',jsonb_build_object('orderId',NEW.id,'snapshot',NEW.snapshot,'status',NEW.status,'paymentStatus',NEW."paymentStatus",'total',NEW.total::text,'method',NEW.method)) ON CONFLICT("eventKey") DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_communications AFTER INSERT OR UPDATE OF status,"paymentStatus","paymentException" ON commerce."Order" FOR EACH ROW EXECUTE FUNCTION commerce.order_communications_trigger();
CREATE FUNCTION commerce.refund_communications_trigger() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,commerce AS $$
DECLARE o commerce."Order";
BEGIN
 IF NEW.state='COMPLETED' AND OLD.state IS DISTINCT FROM 'COMPLETED' THEN
  SELECT ord.* INTO o FROM commerce."Order" ord JOIN commerce."Payment" p ON p."orderId"=ord.id WHERE p.id=NEW."paymentId";
  PERFORM commerce.queue_order_notice(o,'REFUND_COMPLETED',NEW.id::text,false);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER refund_communications AFTER UPDATE OF state ON commerce."Refund" FOR EACH ROW EXECUTE FUNCTION commerce.refund_communications_trigger();
REVOKE ALL ON FUNCTION commerce.queue_order_notice(commerce."Order",TEXT,TEXT,BOOLEAN),commerce.order_communications_trigger(),commerce.refund_communications_trigger() FROM PUBLIC;
