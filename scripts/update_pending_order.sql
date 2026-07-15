-- Run once in the Supabase SQL Editor before using PUT /api/shop/orders/:id.
-- The row lock and transaction prevent a shop edit racing with supplier confirmation.
CREATE OR REPLACE FUNCTION public.update_pending_order(
  p_order_id BIGINT,
  p_shop_id BIGINT,
  p_items JSONB,
  p_delivery_address TEXT,
  p_delivery_city TEXT,
  p_estimated_delivery_date DATE,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_catalog public.supplier_catalog%ROWTYPE;
  v_item JSONB;
  v_catalog_item_id BIGINT;
  v_quantity INTEGER;
  v_total NUMERIC := 0;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ORDER_NOT_FOUND';
  END IF;
  IF v_order.status <> 'Pending' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ORDER_NOT_EDITABLE';
  END IF;
  IF v_order.payment_status = 'Paid' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ORDER_ALREADY_PAID';
  END IF;
  IF v_order.payment_intent_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ORDER_PAYMENT_IN_PROGRESS';
  END IF;
  IF jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) < 1
     OR jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_ORDER_ITEMS';
  END IF;
  IF p_delivery_address IS NULL OR length(trim(p_delivery_address)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DELIVERY_ADDRESS_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS i(catalog_item_id BIGINT, quantity INTEGER)
    GROUP BY i.catalog_item_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DUPLICATE_ORDER_ITEM';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_catalog_item_id := (v_item ->> 'catalog_item_id')::BIGINT;
    v_quantity := (v_item ->> 'quantity')::INTEGER;

    IF v_quantity IS NULL OR v_quantity <= 0 OR v_quantity > 1000000 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_ITEM_QUANTITY';
    END IF;

    SELECT * INTO v_catalog
    FROM public.supplier_catalog
    WHERE id = v_catalog_item_id
      AND supplier_id = v_order.supplier_id
      AND is_active = TRUE
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CATALOG_ITEM_UNAVAILABLE';
    END IF;
    IF v_quantity < v_catalog.minimum_order_quantity THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BELOW_MINIMUM_ORDER_QUANTITY';
    END IF;
    IF v_quantity > v_catalog.stock_available THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INSUFFICIENT_CATALOG_STOCK';
    END IF;

    v_total := v_total + (v_catalog.wholesale_price * v_quantity);
  END LOOP;

  DELETE FROM public.order_items WHERE order_id = v_order.id;

  INSERT INTO public.order_items (
    order_id, catalog_item_id, product_name, quantity, unit_price, total_price
  )
  SELECT
    v_order.id,
    catalog.id,
    catalog.product_name,
    requested.quantity,
    catalog.wholesale_price,
    catalog.wholesale_price * requested.quantity
  FROM jsonb_to_recordset(p_items) AS requested(catalog_item_id BIGINT, quantity INTEGER)
  JOIN public.supplier_catalog AS catalog ON catalog.id = requested.catalog_item_id;

  UPDATE public.orders
  SET total_amount = v_total,
      delivery_address = trim(p_delivery_address),
      delivery_city = NULLIF(trim(p_delivery_city), ''),
      estimated_delivery_date = p_estimated_delivery_date,
      notes = NULLIF(trim(p_notes), ''),
      updated_at = NOW()
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.update_pending_order(BIGINT, BIGINT, JSONB, TEXT, TEXT, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_pending_order(BIGINT, BIGINT, JSONB, TEXT, TEXT, DATE, TEXT) TO service_role;
