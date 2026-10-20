-- Expose only aggregate product popularity; the storefront still cannot read orders or identities.
CREATE FUNCTION commerce.public_product_popularity()
RETURNS TABLE ("productId" uuid, packs bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, commerce
AS $$
  SELECT v."productId", sum((line->>'quantity')::integer)::bigint
  FROM commerce."Order" o
  JOIN commerce."Payment" pay ON pay."orderId"=o.id
  CROSS JOIN LATERAL jsonb_array_elements(o.snapshot->'lines') line
  JOIN commerce."ProductVariant" v ON v.id::text=line->>'variantId'
  JOIN commerce."Product" p ON p.id=v."productId"
  JOIN commerce."Category" c ON c.id=p."categoryId"
  WHERE o.status IN ('COLLECTED','DELIVERED')
    AND o."paymentStatus" IN ('PAID','PARTIALLY_REFUNDED')
    AND o.snapshot->>'isTest'='false'
    AND pay.received=o.total AND pay.refunded<o.total AND pay.exception IS NULL
    AND p.state='ACTIVE' AND NOT p."isSample" AND v.active AND c.active
  GROUP BY v."productId"
$$;
REVOKE ALL ON FUNCTION commerce.public_product_popularity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION commerce.public_product_popularity() TO sd_catalog_reader;
