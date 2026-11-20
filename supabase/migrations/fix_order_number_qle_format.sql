-- Align the server-generated order_number with Flutter's IdGenerator format
-- (QLE-XXXXXXXX). The previous UUID/date/hash string could be rejected by
-- downstream consumers (FCM topics / payment references) and did not match the
-- format the Flutter app generates client-side.
--
-- Apply with: Supabase MCP apply_migration (name: fix_order_number_qle_format)
-- or `supabase db push` once the CLI is available.

DROP FUNCTION IF EXISTS public.create_order_geo_guard(uuid, uuid, double precision, double precision, jsonb, numeric, numeric, numeric, numeric, text, text, timestamp with time zone, uuid, text, numeric, numeric, numeric, numeric, numeric, boolean, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.create_order_geo_guard(
    p_user_id uuid,
    p_store_id uuid,
    p_delivery_latitude double precision,
    p_delivery_longitude double precision,
    p_items jsonb,
    p_subtotal numeric,
    p_delivery_fee numeric,
    p_discount numeric,
    p_total numeric,
    p_payment_method text,
    p_payment_status text,
    p_scheduled_delivery timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_promo_code_id uuid DEFAULT NULL::uuid,
    p_type text DEFAULT 'Liquor'::text,
    p_base_subtotal numeric DEFAULT 0,
    p_base_price_adjustment numeric DEFAULT 0,
    p_store_share numeric DEFAULT 0,
    p_queless_share numeric DEFAULT 0,
    p_service_fee numeric DEFAULT 0,
    p_ai_assisted boolean DEFAULT false,
    p_ai_conversation_id uuid DEFAULT NULL::uuid,
    p_delivery_address jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(order_id uuid, order_number text, status_code character varying, user_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_geo RECORD;
    v_order_number text;
    v_order_id uuid;
    v_now timestamptz := clock_timestamp();
    v_store_share numeric;
    v_queless_share numeric;
BEGIN
    SELECT * INTO v_geo
    FROM public.check_delivery_eligibility(
        p_delivery_latitude, p_delivery_longitude, p_store_id
    );

    IF NOT v_geo.can_order OR NOT v_geo.can_deliver THEN
        RETURN QUERY SELECT NULL::uuid, NULL::text, v_geo.status_code::varchar, v_geo.user_message;
        RETURN;
    END IF;

    SELECT cs.store_share, cs.queless_share
      INTO v_store_share, v_queless_share
    FROM public.compute_order_shares(
        p_subtotal, p_base_subtotal, p_delivery_fee,
        p_discount, p_service_fee, p_total
    ) cs;

    -- Flutter-aligned order number: QLE-XXXXXXXX (uppercase hex, 8 chars).
    v_order_number := 'QLE-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

    INSERT INTO public.orders (
        user_id, order_number, items, subtotal, delivery_fee, discount, total,
        status, delivery_address, payment_method, payment_status,
        scheduled_delivery, tracking_updates, created_at, updated_at,
        store_id, promo_code_id, type, base_subtotal, base_price_adjustment,
        store_share, queless_share, service_fee, ai_assisted, ai_conversation_id
    ) VALUES (
        p_user_id, v_order_number, p_items, p_subtotal, p_delivery_fee, p_discount, p_total,
        'pending',
        COALESCE(p_delivery_address, '{}'::jsonb),
        p_payment_method, p_payment_status,
        p_scheduled_delivery,
        jsonb_build_array(jsonb_build_object(
            'status', 'pending',
            'message', 'Order placed successfully',
            'timestamp', v_now::text
        )),
        v_now, v_now,
        p_store_id, p_promo_code_id, p_type, p_base_subtotal, p_base_price_adjustment,
        v_store_share, v_queless_share, p_service_fee, p_ai_assisted, p_ai_conversation_id
    )
    RETURNING orders.id INTO v_order_id;

    RETURN QUERY SELECT
        v_order_id,
        v_order_number,
        'OK'::varchar,
        'Order created successfully.';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_order_geo_guard(uuid, uuid, double precision, double precision, jsonb, numeric, numeric, numeric, numeric, text, text, timestamp with time zone, uuid, text, numeric, numeric, numeric, numeric, numeric, boolean, uuid, jsonb) TO anon, authenticated, service_role, postgres;
