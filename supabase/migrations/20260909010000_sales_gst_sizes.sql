BEGIN;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS subtotal numeric, ADD COLUMN IF NOT EXISTS gst_percent numeric NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS gst_amount numeric NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.save_original_sales_order(p_id uuid,p_header jsonb,p_lines jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
 DECLARE v_id uuid; h public.sales_orders; c public.sales_order_items; line jsonb; result jsonb; part text; fields text[]; sizes text[]; size_total numeric; calc_qty numeric=0; calc_subtotal numeric=0;
 BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required';END IF;
 IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Detail lines must be an array';END IF;
 SELECT * INTO h FROM jsonb_populate_record(NULL::public.sales_orders,p_header);
 IF jsonb_array_length(p_lines)=0 THEN RAISE EXCEPTION 'At least one item is required';END IF;
 h.gst_percent=coalesce(h.gst_percent,0);
 IF h.gst_percent<0 OR h.gst_percent>100 OR h.gst_percent::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid GST percentage';END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  SELECT * INTO c FROM jsonb_populate_record(NULL::public.sales_order_items,line);
  IF c.qty IS NULL OR c.qty<=0 OR c.price IS NULL OR c.price<0 OR c.qty::text IN ('NaN','Infinity','-Infinity') OR c.price::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid item quantity or rate';END IF;
  IF nullif(trim(c.param_size),'') IS NULL THEN RAISE EXCEPTION 'Size-wise quantities are required';END IF;
  sizes=ARRAY[]::text[];size_total=0;
  FOREACH part IN ARRAY string_to_array(c.param_size,',') LOOP
   fields=string_to_array(trim(part),'/');
   IF array_length(fields,1)<>2 OR trim(fields[1])='' OR trim(fields[2])!~ '^([0-9]+)(\.[0-9]+)?$' THEN RAISE EXCEPTION 'Use Size/Qty for every size';END IF;
   IF lower(trim(fields[1]))=ANY(sizes) OR fields[2]::numeric<=0 THEN RAISE EXCEPTION 'Duplicate size or invalid size quantity';END IF;
   sizes=array_append(sizes,lower(trim(fields[1])));size_total=size_total+fields[2]::numeric;
  END LOOP;
  IF size_total<>c.qty THEN RAISE EXCEPTION 'Size total % must equal item quantity %',size_total,c.qty;END IF;
  calc_qty=calc_qty+c.qty;calc_subtotal=calc_subtotal+round(c.qty*c.price,2);
 END LOOP;
 IF h.total_qty IS DISTINCT FROM calc_qty THEN RAISE EXCEPTION 'Order quantity must equal sum of item quantities';END IF;
 h.subtotal=calc_subtotal;h.gst_amount=round(calc_subtotal*h.gst_percent/100,2);h.total_amount=h.subtotal+h.gst_amount;
 IF p_id IS NULL THEN
  v_id=gen_random_uuid();
  INSERT INTO public.sales_orders(id,order_date,vch_no,party_name,party_type,total_qty,total_amount,subtotal,gst_percent,gst_amount,job_card_no,status,created_by,updated_by)VALUES(v_id,h.order_date,h.vch_no,h.party_name,h.party_type,h.total_qty,h.total_amount,h.subtotal,h.gst_percent,h.gst_amount,h.job_card_no,h.status,h.created_by,h.updated_by);
 ELSE
  v_id=p_id;
  PERFORM 1 FROM public.sales_orders WHERE id=v_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record not found or access denied';END IF;
  UPDATE public.sales_orders SET order_date=h.order_date,vch_no=h.vch_no,party_name=h.party_name,party_type=h.party_type,total_qty=h.total_qty,total_amount=h.total_amount,subtotal=h.subtotal,gst_percent=h.gst_percent,gst_amount=h.gst_amount,job_card_no=h.job_card_no,status=h.status,updated_by=h.updated_by WHERE id=v_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Update denied';END IF;
  DELETE FROM public.sales_order_items WHERE sales_order_id=v_id;
  IF EXISTS(SELECT 1 FROM public.sales_order_items WHERE sales_order_id=v_id) THEN RAISE EXCEPTION 'Existing detail lines could not be replaced';END IF;
 END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  SELECT * INTO c FROM jsonb_populate_record(NULL::public.sales_order_items,line);
  INSERT INTO public.sales_order_items(sales_order_id,item_name,param_size,param_colour,qty,unit,price,amount)VALUES(v_id,c.item_name,c.param_size,c.param_colour,c.qty,c.unit,c.price,round(c.qty*c.price,2));
 END LOOP;
 SELECT to_jsonb(t) INTO result FROM public.sales_orders t WHERE id=v_id;
 RETURN result;
 END $$;
 REVOKE ALL ON FUNCTION public.save_original_sales_order(uuid,jsonb,jsonb) FROM PUBLIC,anon;
 GRANT EXECUTE ON FUNCTION public.save_original_sales_order(uuid,jsonb,jsonb) TO authenticated;
 

NOTIFY pgrst,'reload schema';
COMMIT;
